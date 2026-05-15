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
      note: String(link.note || "").slice(0, 120)
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
  return ["retro", "dark", "light", "terminal"].includes(theme) ? theme : "retro";
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
  return {
    ...data,
    admin: {
      ...publicAdmin,
      enabled: Boolean(ADMIN_PASSWORD || passwordHash)
    },
    auth: {
      enabled: Boolean(ADMIN_PASSWORD || passwordHash),
      authenticated: isAuthed(req)
    }
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

function requestBuffer(targetUrl, { accept, limit }) {
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
        headers: { Accept: accept, "User-Agent": "Homebase/1.0" },
        rejectUnauthorized: false,
        timeout: 5000
      },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          requestBuffer(new URL(response.headers.location, parsed.href).href, { accept, limit }).then(resolve, reject);
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

function requestHead(targetUrl) {
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
        headers: { "User-Agent": "Homebase/1.0" },
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
