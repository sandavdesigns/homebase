const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || "/data";
const DATA_FILE = path.join(DATA_DIR, "homebase.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const defaultData = {
  title: "Davids Startseite",
  subtitle: "Alles Wichtige an einem Ort",
  links: [
    {
      id: crypto.randomUUID(),
      title: "AdGuard",
      url: "http://192.168.1.20/",
      category: "Dienste",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Immich",
      url: "https://photo.sandav.de/",
      category: "Dienste",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Nginx",
      url: "http://192.168.1.19:81/",
      category: "Dienste",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Home Assistant",
      url: "http://192.168.1.5:8123/",
      category: "Dienste",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Homematic",
      url: "http://192.168.1.4/login.htm",
      category: "Dienste",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Valetudo",
      url: "http://192.168.1.186/",
      category: "Dienste",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Homeserver (DS214)",
      url: "http://192.168.1.180:5000/",
      category: "Dienste",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Docker",
      url: "https://192.168.1.27:9443/",
      category: "Dienste",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "iDRAC pve-node01",
      url: "https://192.168.1.162/",
      category: "Dienste",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "iDRAC pve-node02",
      url: "https://192.168.1.146/",
      category: "Dienste",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "PVE Node01",
      url: "https://192.168.1.15:8006/",
      category: "Dienste",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "FritzBox 7530",
      url: "http://192.168.1.2/",
      category: "Dienste",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "FritzBox 7590",
      url: "http://192.168.1.1/",
      category: "Dienste",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Mikrotik",
      url: "http://192.168.1.7/",
      category: "Dienste",
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
      category: "Tools",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "SD-Lernsystem",
      url: "http://192.168.1.27:8080/",
      category: "Tools",
      note: ""
    },
    {
      id: crypto.randomUUID(),
      title: "Vaultwarden",
      url: "https://vaultwarden.sandav.de/",
      category: "Tools",
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
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

function readData() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeData(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const safeData = normalizeData(data);
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(safeData, null, 2)}\n`);
  return safeData;
}

function normalizeData(data) {
  const title = String(data.title || "Startseite").slice(0, 80);
  const subtitle = String(data.subtitle || "").slice(0, 140);
  const links = Array.isArray(data.links) ? data.links : [];

  return {
    title,
    subtitle,
    links: links
      .map((link) => ({
        id: String(link.id || crypto.randomUUID()),
        title: String(link.title || "Ohne Titel").slice(0, 80),
        url: normalizeUrl(String(link.url || "")),
        category: String(link.category || "Links").slice(0, 40),
        note: String(link.note || "").slice(0, 120)
      }))
      .filter((link) => link.url)
  };
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
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600"
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
