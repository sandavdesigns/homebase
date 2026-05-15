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
  schemaVersion: 3,
  title: "Davids Startseite",
  subtitle: "Neon-Kommandozentrale fuer Alltag, Server und Shop",
  categories: defaultCategories,
  links: [
    {
      id: crypto.randomUUID(),
      title: "AdGuard",
      url: "http://192.168.1.20/",
      category: "Netzwerk",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Immich",
      url: "https://photo.sandav.de/",
      category: "Medien",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Nginx",
      url: "http://192.168.1.19:81/",
      category: "Server",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Home Assistant",
      url: "http://192.168.1.5:8123/",
      category: "Smart Home",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Homematic",
      url: "http://192.168.1.4/login.htm",
      category: "Smart Home",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Valetudo",
      url: "http://192.168.1.186/",
      category: "Smart Home",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Homeserver (DS214)",
      url: "http://192.168.1.180:5000/",
      category: "Server",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Docker",
      url: "https://192.168.1.27:9443/",
      category: "Server",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "iDRAC pve-node01",
      url: "https://192.168.1.162/",
      category: "Server",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "iDRAC pve-node02",
      url: "https://192.168.1.146/",
      category: "Server",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "PVE Node01",
      url: "https://192.168.1.15:8006/",
      category: "Server",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "FritzBox 7530",
      url: "http://192.168.1.2/",
      category: "Netzwerk",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "FritzBox 7590",
      url: "http://192.168.1.1/",
      category: "Netzwerk",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Mikrotik",
      url: "http://192.168.1.7/",
      category: "Netzwerk",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Ebay",
      url: "https://www.ebay.de/sh/ovw",
      category: "Business",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Etsy",
      url: "https://www.etsy.com/de/your/shops/me/dashboard?ref=hdr-mcpa",
      category: "Business",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Kasuwa",
      url: "https://www.kasuwa.de/shop/sandavdesigns",
      category: "Business",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "SandavDesigns",
      url: "https://sandavdesigns.de/",
      category: "Business",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Billbee",
      url: "https://app.billbee.io/app_v2/",
      category: "Business",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "YouTube",
      url: "https://youtube.com/",
      category: "Medien",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "SVG-3D Tool",
      url: "http://192.168.1.27:4173/",
      category: "Werkstatt",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "SD-Lernsystem",
      url: "http://192.168.1.27:8080/",
      category: "Werkstatt",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Vaultwarden",
      url: "https://vaultwarden.sandav.de/",
      category: "Sicherheit",
      note: ""
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
  const safeData = normalizeData({ ...data, schemaVersion: data.schemaVersion || 3 });
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(safeData, null, 2)}\n`);
  return safeData;
}

function normalizeData(data) {
  const title = String(data.title || "Startseite").slice(0, 80);
  const subtitle = String(data.subtitle || "").slice(0, 140);
  const links = Array.isArray(data.links) ? data.links : [];
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
    schemaVersion: Number(data.schemaVersion || 1),
    title,
    subtitle,
    categories: normalizeCategories(data.categories, normalizedLinks),
    links: normalizedLinks
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

  normalized.schemaVersion = 3;
  normalized.subtitle = normalized.subtitle || defaultData.subtitle;
  normalized.categories = normalizeCategories(originalVersion < 2 ? [] : normalized.categories, normalized.links);

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
      sendJson(res, 200, readData());
      return;
    }

    if (url.pathname === "/api/homebase" && req.method === "PUT") {
      const body = await readRequestBody(req);
      const saved = writeData(JSON.parse(body));
      sendJson(res, 200, saved);
      return;
    }

    if (url.pathname === "/api/homebase/export" && req.method === "GET") {
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
