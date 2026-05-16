const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || "/data";
const DATA_FILE = path.join(DATA_DIR, "homebase.json");
const FAVICON_DIR = path.join(DATA_DIR, "favicons");
const PUBLIC_DIR = path.join(__dirname, "public");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const STATUS_TARGETS = parseStatusTargets(process.env.HOMEBASE_STATUS_TARGETS || "[]");
const sessions = new Map();

const defaultCategories = [
  "Business",
  "Server",
  "Netzwerk",
  "Smart Home",
  "Sicherheit",
  "Werkstatt",
  "Medien"
].map((name) => ({ id: crypto.randomUUID(), name }));

const defaultData = {
  schemaVersion: 4,
  setupComplete: false,
  title: "Homebase",
  subtitle: "Deine Startseite fuer Links, Profile und kleine Widgets",
  theme: "retro",
  activeProfileId: "default",
  widgets: {
    clock: true,
    notes: []
  },
  preferences: {
    showCategoryCounts: false,
    showLinkStatus: true,
    showNotes: true,
    openLinksInNewTab: true
  },
  admin: {
    enabled: Boolean(ADMIN_PASSWORD)
  },
  profiles: [
    {
      id: "default",
      name: "Privat",
      categories: [{ id: crypto.randomUUID(), name: "Links" }],
      links: []
    }
  ]
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(FAVICON_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

function readData() {
  ensureDataFile();
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const migrated = migrateData(data);
  if (JSON.stringify(migrated) !== JSON.stringify(data)) {
    fs.writeFileSync(DATA_FILE, `${JSON.stringify(migrated, null, 2)}\n`);
  }
  return migrated;
}

function writeData(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const existing = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) : {};
  const safeData = normalizeData({
    ...data,
    admin: {
      ...existing.admin,
      ...data.admin
    },
    schemaVersion: data.schemaVersion || 4
  });
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(safeData, null, 2)}\n`);
  return safeData;
}

function normalizeData(data) {
  const title = String(data.title || "Startseite").slice(0, 80);
  const subtitle = String(data.subtitle || "").slice(0, 140);
  const rawProfiles = Array.isArray(data.profiles) && data.profiles.length
    ? data.profiles
    : [
        {
          id: data.activeProfileId || "default",
          name: "Start",
          categories: data.categories,
          links: data.links
        }
      ];
  const profiles = rawProfiles.map(normalizeProfile).filter((profile) => profile.links.length || profile.categories.length);
  if (!profiles.length) profiles.push(normalizeProfile(defaultData.profiles[0]));
  const activeProfileId = profiles.some((profile) => profile.id === data.activeProfileId)
    ? String(data.activeProfileId)
    : profiles[0].id;
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0];

  return {
    schemaVersion: Number(data.schemaVersion || 1),
    setupComplete: data.setupComplete !== false,
    title,
    subtitle,
    theme: normalizeTheme(data.theme),
    activeProfileId,
    widgets: normalizeWidgets(data.widgets),
    preferences: normalizePreferences(data.preferences),
    admin: {
      enabled: Boolean(ADMIN_PASSWORD || data.admin?.passwordHash),
      passwordHash: String(data.admin?.passwordHash || "")
    },
    profiles,
    categories: activeProfile.categories,
    links: activeProfile.links
  };
}

function normalizeProfile(profile) {
  const links = Array.isArray(profile.links) ? profile.links : [];
  const normalizedLinks = links
    .map((link) => ({
      id: String(link.id || crypto.randomUUID()),
      title: String(link.title || "Ohne Titel").slice(0, 80),
      url: normalizeUrl(String(link.url || "")),
      category: String(link.category || "Links").slice(0, 40),
      note: String(link.note || "").slice(0, 120),
      statusWidget: normalizeStatusWidget(link.statusWidget, link.url)
    }))
    .filter((link) => link.url);

  return {
    id: String(profile.id || crypto.randomUUID()),
    name: String(profile.name || "Start").slice(0, 50),
    categories: normalizeCategories(profile.categories, normalizedLinks),
    links: normalizedLinks
  };
}

function normalizeTheme(theme) {
  return ["retro", "time-circuit", "dark", "light", "terminal"].includes(theme) ? theme : "retro";
}

function normalizeWidgets(widgets) {
  const legacyNote = String(widgets?.quickNote || "").trim();
  const notes = Array.isArray(widgets?.notes)
    ? widgets.notes
    : legacyNote
      ? [{ id: crypto.randomUUID(), text: legacyNote }]
      : [];

  return {
    clock: widgets?.clock !== false,
    notes: notes
      .map((note) => ({
        id: String(note.id || crypto.randomUUID()),
        text: String(note.text || "").trim().slice(0, 500)
      }))
      .filter((note) => note.text)
  };
}

function normalizePreferences(preferences) {
  return {
    showCategoryCounts: preferences?.showCategoryCounts === true,
    showLinkStatus: preferences?.showLinkStatus !== false,
    showNotes: preferences?.showNotes !== false,
    openLinksInNewTab: preferences?.openLinksInNewTab !== false
  };
}

function normalizeStatusWidget(widget, fallbackUrl = "") {
  const enabled = widget?.enabled === true;
  return {
    enabled,
    type: ["basic", "proxmox", "unraid", "amp"].includes(String(widget?.type || "").toLowerCase())
      ? String(widget.type).toLowerCase()
      : "basic",
    url: normalizeUrl(String(widget?.url || fallbackUrl || "")),
    statusPath: String(widget?.statusPath || "").slice(0, 160),
    tokenId: String(widget?.tokenId || "").slice(0, 160),
    tokenSecret: String(widget?.tokenSecret || "").slice(0, 260),
    apiKey: String(widget?.apiKey || "").slice(0, 260),
    username: String(widget?.username || "").slice(0, 160),
    password: String(widget?.password || "").slice(0, 260),
    headerName: String(widget?.headerName || "").slice(0, 80),
    headerValue: String(widget?.headerValue || "").slice(0, 260),
    debug: widget?.debug === true
  };
}

function normalizeCategories(categories, links) {
  const seen = new Set();
  const normalizedCategories = (Array.isArray(categories) ? categories : [])
    .map((category) => ({
      id: String(category.id || crypto.randomUUID()),
      name: String(category.name || "").trim().slice(0, 40)
    }))
    .filter((category) => {
      if (!category.name || seen.has(category.name)) return false;
      seen.add(category.name);
      return true;
    });

  for (const link of links) {
    if (!seen.has(link.category)) {
      normalizedCategories.push({ id: crypto.randomUUID(), name: link.category });
      seen.add(link.category);
    }
  }

  const categoryList = normalizedCategories.length ? normalizedCategories : defaultCategories;
  return categoryList.sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
}

function migrateData(data) {
  const normalized = normalizeData(data);
  const originalVersion = normalized.schemaVersion;

  const categoriesByTitle = new Map([
    ["AdGuard", "Netzwerk"],
    ["FritzBox 7530", "Netzwerk"],
    ["FritzBox 7590", "Netzwerk"],
    ["Mikrotik", "Netzwerk"],
    ["Home Assistant", "Smart Home"],
    ["Homematic", "Smart Home"],
    ["Valetudo", "Smart Home"],
    ["Homeserver (DS214)", "Server"],
    ["Docker", "Server"],
    ["iDRAC pve-node01", "Server"],
    ["iDRAC pve-node02", "Server"],
    ["PVE Node01", "Server"],
    ["Nginx", "Server"],
    ["Immich", "Medien"],
    ["YouTube", "Medien"],
    ["SVG-3D Tool", "Werkstatt"],
    ["SD-Lernsystem", "Werkstatt"],
    ["Vaultwarden", "Sicherheit"]
  ]);

  if (originalVersion < 2) {
    normalized.links = normalized.links.map((link) => ({
      ...link,
      category: categoriesByTitle.get(link.title) || link.category
    }));
  }

  normalized.schemaVersion = 4;
  normalized.subtitle = normalized.subtitle || defaultData.subtitle;
  const activeProfile = normalized.profiles.find((profile) => profile.id === normalized.activeProfileId) || normalized.profiles[0];
  activeProfile.categories = normalizeCategories(originalVersion < 2 ? [] : activeProfile.categories, activeProfile.links);
  normalized.categories = activeProfile.categories;
  normalized.links = activeProfile.links;

  return normalized;
}

function normalizeUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (/^[\w.-]+(:\d+)?(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((cookie) => cookie.trim().split("="))
      .filter(([key, value]) => key && value)
  );
}

function isAuthed(req) {
  const data = readDataWithoutMigration();
  if (!ADMIN_PASSWORD && !data.admin?.passwordHash) return true;
  const sessionId = parseCookies(req).homebase_session;
  const session = sessionId ? sessions.get(sessionId) : null;
  if (!session) return false;
  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return false;
  }
  return true;
}

function requireAuth(req, res) {
  if (isAuthed(req)) return true;
  sendJson(res, 401, { error: "Admin login required" });
  return false;
}

function readDataWithoutMigration() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (ADMIN_PASSWORD && password === ADMIN_PASSWORD) return true;
  if (!storedHash) return false;
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;
  const actualHash = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}

function setSessionCookie(res, sessionId) {
  res.setHeader("Set-Cookie", `homebase_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "homebase_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

function toPublicData(data, req) {
  const { passwordHash, ...publicAdmin } = data.admin || {};
  const authenticated = isAuthed(req);
  const publicData = authenticated ? data : redactStatusSecrets(data);
  return {
    ...publicData,
    admin: {
      ...publicAdmin,
      enabled: Boolean(ADMIN_PASSWORD || passwordHash)
    },
    auth: {
      enabled: Boolean(ADMIN_PASSWORD || passwordHash),
      authenticated
    }
  };
}

function redactStatusSecrets(data) {
  const redactLink = (link) => link.statusWidget ? {
    ...link,
    statusWidget: {
      ...link.statusWidget,
      tokenId: "",
      tokenSecret: "",
      apiKey: "",
      username: "",
      password: "",
      headerValue: ""
    }
  } : link;
  const profiles = (data.profiles || []).map((profile) => ({
    ...profile,
    links: (profile.links || []).map(redactLink)
  }));
  return {
    ...data,
    profiles,
    links: (data.links || []).map(redactLink)
  };
}

function sendFaviconFallback(res) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#160b27"/><path d="M14 44h36M18 20h28M20 32h24" stroke="#26f4ff" stroke-width="5" stroke-linecap="round"/><path d="M14 44h36M18 20h28M20 32h24" stroke="#ff3df2" stroke-width="2" stroke-linecap="round"/></svg>`;
  res.writeHead(200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "public, max-age=86400"
  });
  res.end(svg);
}

async function serveFavicon(res, targetUrl) {
  const parsed = parseHttpUrl(targetUrl);
  if (!parsed) {
    sendFaviconFallback(res);
    return;
  }

  fs.mkdirSync(FAVICON_DIR, { recursive: true });
  const cacheKey = crypto.createHash("sha256").update(parsed.origin).digest("hex");
  const cacheFile = path.join(FAVICON_DIR, `${cacheKey}.bin`);
  const metaFile = path.join(FAVICON_DIR, `${cacheKey}.json`);

  if (fs.existsSync(cacheFile) && fs.existsSync(metaFile)) {
    const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
    res.writeHead(200, {
      "Content-Type": meta.contentType || "image/x-icon",
      "Cache-Control": "public, max-age=604800"
    });
    fs.createReadStream(cacheFile).pipe(res);
    return;
  }

  try {
    const icon = await fetchBestFavicon(parsed);
    fs.writeFileSync(cacheFile, icon.buffer);
    fs.writeFileSync(metaFile, JSON.stringify({ contentType: icon.contentType }, null, 2));
    res.writeHead(200, {
      "Content-Type": icon.contentType,
      "Cache-Control": "public, max-age=604800"
    });
    res.end(icon.buffer);
  } catch {
    sendFaviconFallback(res);
  }
}

async function fetchBestFavicon(pageUrl) {
  const html = await requestBuffer(pageUrl.href, { accept: "text/html,*/*", limit: 250_000 }).catch(() => null);
  const candidates = [];

  if (html?.buffer) {
    const htmlText = html.buffer.toString("utf8");
    candidates.push(...extractIconUrls(htmlText, pageUrl));
  }

  candidates.push(new URL("/favicon.ico", pageUrl.origin).href);
  candidates.push(new URL("/apple-touch-icon.png", pageUrl.origin).href);

  const uniqueCandidates = [...new Set(candidates)];
  for (const candidate of uniqueCandidates) {
    try {
      const response = await requestBuffer(candidate, { accept: "image/*,*/*", limit: 500_000 });
      if (response.buffer.length > 0 && response.contentType.startsWith("image/")) return response;
    } catch {
      // Try the next declared or conventional favicon location.
    }
  }

  throw new Error("No favicon found");
}

function extractIconUrls(html, pageUrl) {
  const urls = [];
  const linkPattern = /<link\b[^>]*>/gi;
  const attrPattern = /\s([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const [tag] of html.matchAll(linkPattern)) {
    const attrs = {};
    for (const match of tag.matchAll(attrPattern)) {
      attrs[match[1].toLowerCase()] = match[3] || match[4] || match[5] || "";
    }
    const rel = attrs.rel || "";
    const href = attrs.href || "";
    if (href && /\b(icon|apple-touch-icon)\b/i.test(rel)) {
      urls.push(new URL(href, pageUrl.href).href);
    }
  }
  return urls;
}

function parseStatusTargets(raw) {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    const targets = Array.isArray(parsed) ? parsed : [parsed];
    return targets
      .map((target) => ({
        id: String(target.id || target.name || crypto.randomUUID()).slice(0, 80),
        name: String(target.name || target.type || "Status").slice(0, 80),
        type: String(target.type || "basic").toLowerCase(),
        url: normalizeUrl(String(target.url || "")),
        statusPath: String(target.statusPath || ""),
        apiKey: String(target.apiKey || ""),
        username: String(target.username || ""),
        password: String(target.password || ""),
        tokenId: String(target.tokenId || ""),
        tokenSecret: String(target.tokenSecret || ""),
        headerName: String(target.headerName || ""),
        headerValue: String(target.headerValue || "")
      }))
      .filter((target) => target.url && parseHttpUrl(target.url));
  } catch (error) {
    console.error(`HOMEBASE_STATUS_TARGETS konnte nicht gelesen werden: ${error.message}`);
    return [];
  }
}

function publicStatusTarget(target) {
  return {
    id: target.id,
    name: target.name,
    type: target.type,
    url: target.url
  };
}

function getConfiguredStatusTargets(data) {
  const linkTargets = [];
  for (const profile of data.profiles || []) {
    for (const link of profile.links || []) {
      if (!link.statusWidget?.enabled) continue;
      linkTargets.push({
        ...link.statusWidget,
        id: link.id,
        name: link.title,
        url: link.statusWidget.url || link.url
      });
    }
  }
  return [...STATUS_TARGETS, ...linkTargets].filter((target) => target.url && parseHttpUrl(target.url));
}

async function readStatusTargets() {
  const targets = getConfiguredStatusTargets(readData());
  const items = await Promise.all(targets.map(readStatusTarget));
  return {
    configured: targets.length,
    updatedAt: new Date().toISOString(),
    items
  };
}

async function readStatusTarget(target) {
  const base = {
    ...publicStatusTarget(target),
    ok: false,
    status: "offline",
    details: [],
    metrics: []
  };

  try {
    if (target.type === "proxmox") return await readProxmoxStatus(target, base);
    if (target.type === "unraid" && target.apiKey) return await readUnraidStatus(target, base);
    if (target.type === "amp" && target.username && target.password) return await readAmpStatus(target, base);
    return await readGenericServiceStatus(target, base);
  } catch (error) {
    return {
      ...base,
      message: error.message || "Nicht erreichbar"
    };
  }
}

async function readUnraidStatus(target, base) {
  const response = await requestJsonPost(new URL(target.statusPath || "/graphql", target.url).href, {
    headers: { "x-api-key": target.apiKey },
    body: {
      query: `query HomebaseStatus {
        info {
          os { distro release uptime }
          cpu { cores threads }
        }
        array {
          state
          capacity { disks { used total free } }
        }
        dockerContainers {
          id
          state
        }
      }`
    }
  });

  if (response.errors?.length) throw new Error(response.errors[0].message || "Unraid API Fehler");
  const data = response.data || {};
  const containers = Array.isArray(data.dockerContainers) ? data.dockerContainers : [];
  const runningContainers = containers.filter((container) => String(container.state).toLowerCase() === "running").length;
  const diskCapacity = data.array?.capacity?.disks || {};
  const used = Number(diskCapacity.used || 0);
  const total = Number(diskCapacity.total || 0);
  const metrics = [
    { label: "Array", value: String(data.array?.state || "unknown") },
    { label: "Docker", value: `${runningContainers}/${containers.length}` }
  ];
  if (total > 0) metrics.push({ label: "Speicher", value: `${Math.round((used / total) * 100)}%` });
  if (data.info?.cpu?.cores) metrics.push({ label: "CPU", value: `${data.info.cpu.cores} Cores` });

  return {
    ...base,
    ok: true,
    status: "online",
    message: data.info?.os?.release ? `Unraid ${data.info.os.release}` : "API erreichbar",
    metrics
  };
}

async function readAmpStatus(target, base) {
  const login = await requestJsonPost(new URL("/API/Core/Login", target.url).href, {
    body: {
      username: target.username,
      password: target.password,
      token: "",
      rememberMe: false
    }
  });
  const sessionId = login.sessionID || login.SESSIONID || login.sessionId || login.result?.sessionID;
  if (!sessionId) throw new Error("AMP Login fehlgeschlagen");

  const status = await requestJsonPost(new URL("/API/Core/GetStatus", target.url).href, {
    body: { SESSIONID: sessionId }
  });
  const metrics = [];
  const source = status.result || status;
  const instances = filterAmpServerInstances(await readAmpInstances(target, sessionId));
  const instanceStatuses = filterAmpServerInstances(await readAmpInstanceStatuses(target, sessionId));
  const instanceStatusDetails = await Promise.all(instances.map((instance) => readAmpInstanceCoreStatus(target, sessionId, instance)));
  let mergedInstances = mergeAmpInstances(instances.length ? instances : instanceStatuses, instanceStatuses, instanceStatusDetails);
  mergedInstances = await Promise.all(mergedInstances.map((instance) => readAmpApplicationStatus(target, instance)));
  const totalInstances = mergedInstances.length;
  if (totalInstances) {
    const online = Math.min(mergedInstances.filter(isAmpInstanceOnline).length, totalInstances);
    metrics.push({ label: "Server", value: `${online}/${totalInstances}` });
  }
  const cpu = totalInstances
    ? averageNumbers(mergedInstances.map(readAmpCpuPercent))
    : readAmpCpuPercent(source);
  const memory = totalInstances
    ? sumNumbers(mergedInstances.map(readAmpMemoryMb))
    : readAmpMemoryMb(source);
  const users = totalInstances
    ? sumNumbers(mergedInstances.map(readAmpUsersOnline))
    : readAmpUsersOnline(source);
  if (cpu !== undefined) metrics.push({ label: "CPU", value: formatAmpMetric(cpu, "%") });
  if (memory !== undefined) metrics.push({ label: "RAM", value: formatAmpMetric(memory, "MB") });
  if (users !== undefined) metrics.push({ label: "User", value: String(users).slice(0, 24) });

  return {
    ...base,
    ok: true,
    status: "online",
    message: getAmpStatusMessage(source),
    metrics,
    debug: target.debug === true ? getAmpDebugLines(source, mergedInstances) : []
  };
}

async function readAmpInstances(target, sessionId) {
  try {
    const response = await requestJsonPost(new URL("/API/ADSModule/GetInstances", target.url).href, {
      body: { SESSIONID: sessionId }
    });
    return extractAmpInstances(response);
  } catch {
    return [];
  }
}

async function readAmpInstanceStatuses(target, sessionId) {
  try {
    const response = await requestJsonPost(new URL("/API/ADSModule/GetInstanceStatuses", target.url).href, {
      body: { SESSIONID: sessionId }
    });
    return extractAmpInstances(response);
  } catch {
    return [];
  }
}

async function readAmpInstanceCoreStatus(target, sessionId, instance) {
  const instanceId = getAmpInstanceId(instance);
  if (!instanceId) return {};
  const instanceBase = new URL(`/API/ADSModule/Servers/${encodeURIComponent(instanceId)}/API/`, target.url).href;
  const directStatus = await readAmpProxiedCoreStatus(instanceBase, sessionId);
  if (Object.keys(directStatus).length) return { ...directStatus, InstanceID: instanceId, DebugSource: "proxy" };
  try {
    const login = await requestJsonPost(new URL(`/API/ADSModule/Servers/${encodeURIComponent(instanceId)}/API/Core/Login`, target.url).href, {
      body: {
        SESSIONID: sessionId,
        username: target.username,
        password: target.password,
        token: "",
        rememberMe: true
      }
    });
    const instanceSessionId = login.sessionID || login.SESSIONID || login.sessionId || login.result?.sessionID;
    if (!instanceSessionId) return {};
    const loginStatus = await readAmpProxiedCoreStatus(instanceBase, instanceSessionId);
    return { ...loginStatus, InstanceID: instanceId, DebugSource: "instance-login" };
  } catch {
    return {};
  }
}

async function readAmpProxiedCoreStatus(instanceBase, sessionId) {
  const status = await requestJsonPost(new URL("Core/GetStatus", instanceBase).href, {
    body: { SESSIONID: sessionId }
  }).catch(() => ({}));
  const updates = await requestJsonPost(new URL("Core/GetUpdates", instanceBase).href, {
    body: { SESSIONID: sessionId }
  }).catch(() => ({}));
  const statusSource = status.result || status;
  const updateSource = updates.result || updates;
  const liveStatus = updateSource.Status || updateSource.status || {};
  if (!Object.keys(statusSource).length && !Object.keys(updateSource).length) return {};
  return {
    ...(liveStatus || {}),
    ...status,
    ...statusSource,
    Updates: updateSource
  };
}

async function readAmpApplicationStatus(_target, instance) {
  return instance;
}

function extractAmpInstances(response) {
  const candidates = [
    response.result,
    response.Result,
    response.instances,
    response.Instances,
    response.availableInstances,
    response.AvailableInstances,
    response.data,
    response.Data,
    response
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const instances = candidate.flatMap((item) => isAmpInstanceLike(item) ? [item] : extractAmpInstances(item));
      if (instances.length) return instances;
    }
    if (candidate && typeof candidate === "object") {
      if (Array.isArray(candidate.AvailableInstances)) return candidate.AvailableInstances.filter(isAmpInstanceLike);
      if (isAmpInstanceLike(candidate)) return [candidate];
      const values = Object.values(candidate).filter((value) => value && typeof value === "object");
      const instances = values.flatMap((value) => {
        if (isAmpInstanceLike(value)) return [value];
        if (Array.isArray(value.AvailableInstances)) return value.AvailableInstances;
        return [];
      }).filter(isAmpInstanceLike);
      if (instances.length) return instances;
    }
  }
  return [];
}

function filterAmpServerInstances(instances) {
  const filtered = instances.filter(isAmpServerInstance);
  return filtered.length ? filtered : instances.filter((instance) => !isAmpDaemonInstance(instance));
}

function mergeAmpInstances(primaryInstances, ...sources) {
  const map = new Map();
  for (const instance of primaryInstances) {
    if (!instance || typeof instance !== "object") continue;
    const key = getAmpInstanceKey(instance) || crypto.randomUUID();
    map.set(key, { ...instance });
  }
  for (const source of sources.flat()) {
    if (!source || typeof source !== "object" || !Object.keys(source).length) continue;
    const key = getAmpInstanceKey(source);
    if (key && map.has(key)) map.set(key, { ...map.get(key), ...source });
    else if (!key && map.size === 1) {
      const [existingKey] = map.keys();
      map.set(existingKey, { ...map.get(existingKey), ...source });
    } else if (!primaryInstances.length && key) map.set(key, { ...(map.get(key) || {}), ...source });
  }
  return [...map.values()];
}

function isAmpServerInstance(instance) {
  if (!instance || typeof instance !== "object" || isAmpDaemonInstance(instance)) return false;
  if (instance.Disabled === true || instance.Suspended === true) return false;
  const moduleName = getAmpModuleName(instance);
  if (!moduleName) return true;
  return !/\b(ads|amp|admin|daemon)\b/i.test(moduleName);
}

function isAmpDaemonInstance(instance) {
  if (!instance || typeof instance !== "object") return false;
  if (instance.Daemon === true || instance.daemon === true) return true;
  const moduleName = getAmpModuleName(instance);
  const name = String(instance.InstanceName || instance.FriendlyName || instance.DisplayName || instance.Name || "").toLowerCase();
  return /\b(ads|amp|admin|daemon)\b/i.test(moduleName) || /\b(ads|amp|admin|daemon)\b/i.test(name);
}

function getAmpModuleName(instance) {
  return String(
    instance?.ModuleDisplayName ??
    instance?.ModuleName ??
    instance?.Module ??
    instance?.moduleDisplayName ??
    instance?.moduleName ??
    instance?.module ??
    ""
  );
}

function getAmpInstanceKey(instance) {
  return String(
    getAmpInstanceId(instance) ||
    instance?.InstanceName ||
    instance?.FriendlyName ||
    instance?.DisplayName ||
    instance?.Name ||
    instance?.name ||
    ""
  ).toLowerCase();
}

function getAmpInstanceId(instance) {
  return String(
    instance?.InstanceID ??
    instance?.InstanceId ??
    instance?.instanceId ??
    instance?.id ??
    instance?.Id ??
    ""
  );
}

function isAmpInstanceLike(value) {
  return Boolean(value && typeof value === "object" && (
    value.InstanceID ||
    value.InstanceName ||
    value.FriendlyName ||
    value.DisplayName ||
    value.Module ||
    value.ModuleName ||
    value.AppState ||
    value.app_state ||
    value.State ||
    value.state ||
    value.Status ||
    value.status ||
    value.Running !== undefined
    || value.running !== undefined
    || value.IsRunning !== undefined
    || value.is_running !== undefined
  ));
}

function isAmpInstanceOnline(instance) {
  if (instance.AppOnline === true) return true;
  if (instance.AppOnline === false) return false;
  const portStatus = readAmpRequiredPortStatus(instance);
  if (portStatus !== undefined) return portStatus;
  const appState = readAmpApplicationState(instance);
  if (appState !== undefined) return appState === 20 || /\b(ready|running|started|online)\b/i.test(String(appState));
  const runningValue = instance.Running ?? instance.running ?? instance.IsRunning ?? instance.is_running;
  if (runningValue === false || runningValue === 0 || String(runningValue).toLowerCase() === "false") return false;
  return false;
}

function readAmpRequiredPortStatus(instance) {
  const ports = [
    ...(Array.isArray(instance?.Updates?.Ports) ? instance.Updates.Ports : []),
    ...(Array.isArray(instance?.Updates?.ports) ? instance.Updates.ports : []),
    ...(Array.isArray(instance?.Ports) ? instance.Ports : []),
    ...(Array.isArray(instance?.ports) ? instance.ports : [])
  ];
  const relevantPorts = ports.filter((port) => {
    const label = String(port.Name || port.name || port.Description || port.description || "").toLowerCase();
    if (/amp|admin|web|metrics|rcon|query/.test(label)) return false;
    return port.Required === true || port.required === true || /minecraft|game|server/.test(label);
  });
  if (!relevantPorts.length) return undefined;
  return relevantPorts.some((port) => port.Listening === true || port.listening === true);
}

function readAmpApplicationState(instance) {
  const candidates = [
    instance?.Status?.State,
    instance?.status?.state,
    instance?.Updates?.Status?.State,
    instance?.Updates?.Status?.state,
    instance?.Updates?.status?.State,
    instance?.Updates?.status?.state,
    instance?.State,
    instance?.state,
    typeof instance?.Status === "object" ? undefined : instance?.Status,
    typeof instance?.status === "object" ? undefined : instance?.status,
    instance?.CurrentState,
    instance?.current_state,
    instance?.AppState,
    instance?.app_state
  ].filter((value) => value !== undefined && value !== null && value !== "");
  if (!candidates.length) return undefined;
  const numeric = candidates.map((value) => Number(value)).find((value) => Number.isFinite(value));
  if (numeric !== undefined) return numeric;
  const text = String(candidates[0]).toLowerCase();
  if (/\b(stopped|sleeping|offline|suspended|failed|stopping|maintenance|indeterminate)\b/.test(text)) return 0;
  if (/\b(ready|running|started|online)\b/.test(text)) return 20;
  return text;
}

function readAmpCpuPercent(source) {
  return ignoreZeroMetric(readAmpMetricValue(source, [
    "CPUUsage",
    "CPU",
    "CPU Usage",
    "CPU Usage %",
    "Processor Usage"
  ], ["Percent", "percent", "RawValue", "rawValue", "Value", "value"]));
}

function readAmpMemoryMb(source) {
  return ignoreZeroMetric(readAmpMetricValue(source, [
    "MemoryUsageMB",
    "Memory",
    "Memory Usage",
    "RAM",
    "RAM Usage"
  ], ["RawValue", "rawValue", "Value", "value", "MB", "mb"]));
}

function readAmpUsersOnline(source) {
  if (source?.AppPlayers !== undefined) return source.AppPlayers;
  return ignoreZeroMetric(readAmpMetricValue(source, [
    "UsersOnline",
    "Active Users",
    "Users",
    "Players",
    "Players Online"
  ], ["RawValue", "rawValue", "Value", "value"]));
}

function readAmpMetricValue(source, names, fields) {
  if (!source || typeof source !== "object") return undefined;
  const sources = [
    source,
    source.Status,
    source.status,
    source.Updates?.Status,
    source.Updates?.status
  ].filter((candidate) => candidate && typeof candidate === "object");
  for (const candidate of sources) {
    for (const name of names) {
      const direct = toFiniteNumber(candidate[name]);
      if (direct !== undefined) return direct;
    }
    const metrics = candidate.Metrics || candidate.metrics || {};
    const metricEntries = Object.entries(metrics);
    for (const name of names) {
      const metric = findAmpMetric(metrics, metricEntries, name);
      if (!metric || typeof metric !== "object") continue;
      for (const field of fields) {
        const value = toFiniteNumber(metric[field]);
        if (value !== undefined) return value;
      }
    }
  }
  return undefined;
}

function findAmpMetric(metrics, entries, name) {
  return metrics[name] ||
    metrics[name.toLowerCase()] ||
    entries.find(([key]) => normalizeAmpMetricName(key) === normalizeAmpMetricName(name))?.[1] ||
    entries.find(([key]) => normalizeAmpMetricName(key).includes(normalizeAmpMetricName(name)))?.[1];
}

function normalizeAmpMetricName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function averageNumbers(values) {
  const numbers = values.map(toFiniteNumber).filter((value) => value !== undefined);
  if (!numbers.length) return undefined;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function sumNumbers(values) {
  const numbers = values.map(toFiniteNumber).filter((value) => value !== undefined);
  if (!numbers.length) return undefined;
  return numbers.reduce((sum, value) => sum + value, 0);
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function ignoreZeroMetric(value) {
  return value === 0 ? undefined : value;
}

function getAmpDebugLines(source, instances) {
  const lines = [];
  lines.push(`ADS state=${shortDebugValue(source?.State ?? source?.state ?? source?.Status ?? source?.status ?? "n/a")}`);
  instances.slice(0, 8).forEach((instance, index) => {
    const name = instance.FriendlyName || instance.InstanceName || instance.DisplayName || instance.Name || `Instanz ${index + 1}`;
    const state = readAmpApplicationState(instance);
    const raw = [
      `app=${shortDebugValue(instance.AppState ?? instance.app_state)}`,
      `state=${shortDebugValue(instance.State ?? instance.state)}`,
      `live=${shortDebugValue(instance.Updates?.Status?.State ?? instance.Updates?.status?.state ?? instance.Status?.State ?? instance.status?.state)}`,
      `ports=${shortDebugValue(formatAmpDebugPorts(instance))}`,
      `running=${shortDebugValue(instance.Running ?? instance.running ?? instance.IsRunning ?? instance.is_running)}`,
      `src=${shortDebugValue(instance.DebugSource || "list")}`
    ].join(" ");
    lines.push(`${name}: online=${isAmpInstanceOnline(instance)} resolved=${shortDebugValue(state)} ${raw}`);
  });
  return lines;
}

function formatAmpDebugPorts(instance) {
  const ports = [
    ...(Array.isArray(instance?.Updates?.Ports) ? instance.Updates.Ports : []),
    ...(Array.isArray(instance?.Updates?.ports) ? instance.Updates.ports : []),
    ...(Array.isArray(instance?.Ports) ? instance.Ports : []),
    ...(Array.isArray(instance?.ports) ? instance.ports : [])
  ];
  if (!ports.length) return "-";
  return ports.slice(0, 4).map((port) => {
    const name = String(port.Name || port.name || "port").replace(/\s+/g, "");
    const number = port.Port || port.port || port.PortNumber || port.port_number || "?";
    const listening = port.Listening ?? port.listening;
    return `${name}:${number}:${listening === true ? "on" : "off"}`;
  }).join(",");
}

function shortDebugValue(value) {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "object") return "{...}";
  return String(value).slice(0, 24);
}

function getAmpStatusMessage(source) {
  const status = source.Status || source.StateName || source.StateDescription || "";
  if (status && !/^\d+$/.test(String(status))) return String(status).slice(0, 40);
  return "AMP erreichbar";
}

function formatAmpMetric(value, fallbackUnit = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value).slice(0, 24);
  const rounded = Math.round(number * 10) / 10;
  return `${rounded}${fallbackUnit}`;
}

async function readGenericServiceStatus(target, base) {
  const statusUrl = target.statusPath ? new URL(target.statusPath, target.url).href : target.url;
  const headers = target.headerName && target.headerValue ? { [target.headerName]: target.headerValue } : {};
  const result = await requestHead(statusUrl, headers).catch(async () => {
    const json = await requestJson(statusUrl, { headers });
    return { ok: true, status: 200, statusText: "OK", json };
  });

  const metrics = [];
  if (result.json && typeof result.json === "object") {
    const value = result.json.status || result.json.state || result.json.version || result.json.name;
    if (value) metrics.push({ label: "API", value: String(value).slice(0, 40) });
  }

  return {
    ...base,
    ok: result.ok,
    status: result.ok ? "online" : "warning",
    message: result.ok ? "Erreichbar" : `HTTP ${result.status || 0}`,
    metrics
  };
}

async function readProxmoxStatus(target, base) {
  const headers = target.tokenId && target.tokenSecret
    ? { Authorization: `PVEAPIToken=${target.tokenId}=${target.tokenSecret}` }
    : {};
  const version = await requestJson(new URL("/api2/json/version", target.url).href, { headers });
  const metrics = [];
  if (version.data?.version) metrics.push({ label: "Version", value: String(version.data.version) });

  if (!headers.Authorization) {
    return {
      ...base,
      ok: true,
      status: "online",
      message: "API erreichbar",
      metrics
    };
  }

  const resources = await requestJson(new URL("/api2/json/cluster/resources", target.url).href, { headers });
  const data = Array.isArray(resources.data) ? resources.data : [];
  const nodes = data.filter((item) => item.type === "node");
  const guests = data.filter((item) => item.type === "qemu" || item.type === "lxc");
  const onlineNodes = nodes.filter((item) => item.status === "online").length;
  const runningGuests = guests.filter((item) => item.status === "running").length;
  const totalMemory = nodes.reduce((sum, item) => sum + Number(item.maxmem || 0), 0);
  const usedMemory = nodes.reduce((sum, item) => sum + Number(item.mem || 0), 0);

  metrics.push({ label: "Nodes", value: `${onlineNodes}/${nodes.length || 0}` });
  metrics.push({ label: "VM/CT", value: `${runningGuests}/${guests.length || 0}` });
  if (totalMemory > 0) metrics.push({ label: "RAM", value: `${Math.round((usedMemory / totalMemory) * 100)}%` });

  return {
    ...base,
    ok: onlineNodes > 0 || nodes.length === 0,
    status: onlineNodes === nodes.length ? "online" : "warning",
    message: onlineNodes === nodes.length ? "Cluster online" : "Teilweise erreichbar",
    details: nodes.slice(0, 4).map((node) => ({
      label: node.node || node.id || "Node",
      value: node.status || "unknown"
    })),
    metrics
  };
}

async function requestJson(targetUrl, { headers = {} } = {}) {
  const response = await requestBuffer(targetUrl, {
    accept: "application/json,*/*",
    headers,
    limit: 1_000_000
  });
  return JSON.parse(response.buffer.toString("utf8"));
}

function requestJsonPost(targetUrl, { headers = {}, body = {} } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = parseHttpUrl(targetUrl);
    if (!parsed) {
      reject(new Error("Invalid URL"));
      return;
    }

    const payload = JSON.stringify(body);
    const transport = parsed.protocol === "https:" ? https : http;
    const request = transport.request(
      parsed,
      {
        method: "POST",
        headers: {
          Accept: "application/json,*/*",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "User-Agent": "Homebase/1.0",
          ...headers
        },
        rejectUnauthorized: false,
        timeout: 5000
      },
      (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          response.resume();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("timeout", () => request.destroy(new Error("Request timeout")));
    request.on("error", reject);
    request.end(payload);
  });
}

function requestBuffer(targetUrl, { accept, limit, headers = {} }) {
  return new Promise((resolve, reject) => {
    const parsed = parseHttpUrl(targetUrl);
    if (!parsed) {
      reject(new Error("Invalid URL"));
      return;
    }

    const transport = parsed.protocol === "https:" ? https : http;
    const request = transport.request(
      parsed,
      {
        headers: { Accept: accept, "User-Agent": "Homebase/1.0", ...headers },
        rejectUnauthorized: false,
        timeout: 5000
      },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          requestBuffer(new URL(response.headers.location, parsed.href).href, { accept, headers, limit }).then(resolve, reject);
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          response.resume();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const chunks = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > limit) {
            response.destroy(new Error("Response too large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: String(response.headers["content-type"] || "application/octet-stream").split(";")[0]
          });
        });
      }
    );
    request.on("timeout", () => request.destroy(new Error("Request timeout")));
    request.on("error", reject);
    request.end();
  });
}

function requestHead(targetUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = parseHttpUrl(targetUrl);
    if (!parsed) {
      reject(new Error("Invalid URL"));
      return;
    }
    const transport = parsed.protocol === "https:" ? https : http;
    const request = transport.request(
      parsed,
      {
        method: "HEAD",
        headers: { "User-Agent": "Homebase/1.0", ...headers },
        rejectUnauthorized: false,
        timeout: 5000
      },
      (response) => {
        response.resume();
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 400,
          status: response.statusCode,
          statusText: response.statusMessage || ""
        });
      }
    );
    request.on("timeout", () => request.destroy(new Error("Request timeout")));
    request.on("error", reject);
    request.end();
  });
}

function parseHttpUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const requestPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": mimeTypes[".html"] });
        res.end(fallback);
      });
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/homebase" && req.method === "GET") {
      sendJson(res, 200, toPublicData(readData(), req));
      return;
    }

    if (url.pathname === "/api/homebase" && req.method === "PUT") {
      if (!requireAuth(req, res)) return;
      const body = await readRequestBody(req);
      const saved = writeData(JSON.parse(body));
      sendJson(res, 200, toPublicData(saved, req));
      return;
    }

    if (url.pathname === "/api/setup" && req.method === "POST") {
      const current = readData();
      if (current.setupComplete && (ADMIN_PASSWORD || current.admin?.passwordHash) && !isAuthed(req)) {
        sendJson(res, 409, { error: "Setup already completed" });
        return;
      }
      const body = JSON.parse(await readRequestBody(req));
      const firstProfile = normalizeProfile({
        id: "default",
        name: body.profileName || "Start",
        categories: (Array.isArray(body.categories) ? body.categories : ["Links"]).map((name) => ({ name })),
        links: []
      });
      const saved = writeData({
        ...current,
        setupComplete: true,
        title: body.title || current.title,
        subtitle: body.subtitle || current.subtitle,
        theme: body.theme || current.theme,
        admin: body.password ? { passwordHash: hashPassword(body.password) } : current.admin,
        activeProfileId: firstProfile.id,
        profiles: [firstProfile]
      });
      if (body.password) {
        const sessionId = crypto.randomUUID();
        sessions.set(sessionId, { expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
        setSessionCookie(res, sessionId);
      }
      sendJson(res, 200, toPublicData(saved, req));
      return;
    }

    if (url.pathname === "/api/import" && req.method === "POST") {
      if (!requireAuth(req, res)) return;
      const body = JSON.parse(await readRequestBody(req));
      const saved = writeData({ ...body, setupComplete: true });
      sendJson(res, 200, toPublicData(saved, req));
      return;
    }

    if (url.pathname === "/api/auth/status" && req.method === "GET") {
      const data = readData();
      sendJson(res, 200, { enabled: Boolean(ADMIN_PASSWORD || data.admin?.passwordHash), authenticated: isAuthed(req) });
      return;
    }

    if (url.pathname === "/api/auth/login" && req.method === "POST") {
      const body = JSON.parse(await readRequestBody(req));
      const data = readData();
      if (!ADMIN_PASSWORD && !data.admin?.passwordHash || verifyPassword(body.password, data.admin?.passwordHash)) {
        const sessionId = crypto.randomUUID();
        sessions.set(sessionId, { expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
        setSessionCookie(res, sessionId);
        sendJson(res, 200, { enabled: Boolean(ADMIN_PASSWORD || data.admin?.passwordHash), authenticated: true });
        return;
      }
      sendJson(res, 401, { error: "Invalid password" });
      return;
    }

    if (url.pathname === "/api/auth/logout" && req.method === "POST") {
      const sessionId = parseCookies(req).homebase_session;
      if (sessionId) sessions.delete(sessionId);
      clearSessionCookie(res);
      const data = readData();
      sendJson(res, 200, { enabled: Boolean(ADMIN_PASSWORD || data.admin?.passwordHash), authenticated: false });
      return;
    }

    if (url.pathname === "/api/link-status" && req.method === "GET") {
      const target = url.searchParams.get("url") || "";
      const parsed = parseHttpUrl(target);
      if (!parsed) {
        sendJson(res, 200, { ok: false, status: 0, error: "Invalid URL" });
        return;
      }
      try {
        const result = await requestHead(parsed.href);
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, 200, { ok: false, status: 0, error: error.message });
      }
      return;
    }

    if (url.pathname === "/api/status" && req.method === "GET") {
      sendJson(res, 200, await readStatusTargets());
      return;
    }

    if (url.pathname === "/api/homebase/export" && req.method === "GET") {
      if (!requireAuth(req, res)) return;
      const data = JSON.stringify(readData(), null, 2);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=homebase.json"
      });
      res.end(data);
      return;
    }

    if (url.pathname === "/api/favicon" && req.method === "GET") {
      await serveFavicon(res, url.searchParams.get("url") || "");
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Bad request" });
  }
});

ensureDataFile();
server.listen(PORT, HOST, () => {
  console.log(`Homebase running on http://${HOST}:${PORT}`);
});
