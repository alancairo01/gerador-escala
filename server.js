const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(STATE_FILE)) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({}, null, 2), "utf8");
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(res, code, payload) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readBody(req, callback) {
  let body = "";
  req.on("data", chunk => {
    body += chunk.toString();
    if (body.length > 10 * 1024 * 1024) {
      req.destroy();
    }
  });
  req.on("end", () => callback(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/api/state") {
    try {
      const raw = fs.readFileSync(STATE_FILE, "utf8");
      sendJson(res, 200, JSON.parse(raw || "{}"));
    } catch (error) {
      sendJson(res, 500, { error: "Não foi possível ler o estado salvo." });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/state") {
    readBody(req, body => {
      try {
        const payload = JSON.parse(body || "{}");
        fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), "utf8");
        sendJson(res, 200, { ok: true, savedAt: new Date().toISOString() });
      } catch (error) {
        sendJson(res, 400, { error: "JSON inválido." });
      }
    });
    return;
  }

  let requestedPath = decodeURIComponent(url.pathname);
  if (requestedPath === "/") requestedPath = "/index.html";

  const filePath = path.normalize(path.join(ROOT, requestedPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Acesso negado");
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Arquivo não encontrado");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log("");
  console.log("✅ Gerador de Escala Automática iniciado");
  console.log(`🌐 Abra no navegador: http://localhost:${PORT}`);
  console.log("💾 As escalas serão salvas em: data/state.json");
  console.log("");
});
