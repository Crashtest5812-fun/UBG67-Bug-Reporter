const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const REPORTS_FILE = path.join(DATA_DIR, "reports.json");
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";

const ctestPassword = process.env.CTEST5812_PASSWORD;
const liamPassword = process.env.LSTUNG67_PASSWORD;
if (!ctestPassword || !liamPassword) {
  console.error("Set CTEST5812_PASSWORD and LSTUNG67_PASSWORD before starting the server.");
  process.exit(1);
}
const accounts = new Map([
  ["CTest5812", ctestPassword],
  ["LStung67", liamPassword]
]);
const accountNames = new Map([
  ["CTest5812", "Crashtest5812"],
  ["LStung67", "Liam Soto"]
]);
const sessions = new Map();

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(REPORTS_FILE)) fs.writeFileSync(REPORTS_FILE, "[]");

function readReports() {
  try {
    const reports = JSON.parse(fs.readFileSync(REPORTS_FILE, "utf8"));
    return Array.isArray(reports) ? reports : [];
  } catch {
    return [];
  }
}

function writeReports(reports) {
  fs.writeFileSync(REPORTS_FILE, `${JSON.stringify(reports, null, 2)}\n`);
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(value));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const [name, ...rest] = part.trim().split("=");
    return [name, decodeURIComponent(rest.join("="))];
  }));
}

function authenticated(request) {
  const token = parseCookies(request).crashtest_session;
  return Boolean(token && sessions.has(token));
}

function requireAuth(request, response) {
  if (authenticated(request)) return true;
  sendJson(response, 401, { error: "Please sign in first." });
  return false;
}

function safeTimingEqual(a, b) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function createReportId(reports) {
  const highest = reports.reduce((value, report) => {
    const match = /^BUG-(\d+)$/.exec(report.id || "");
    return match ? Math.max(value, Number(match[1])) : value;
  }, 100);
  return `BUG-${highest + 1}`;
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/health" && request.method === "GET") {
    return sendJson(response, 200, { ok: true, service: "Crashtest Support" });
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    try {
      const { username, password } = await readJson(request);
      const expected = accounts.get(username);
      if (!expected || !safeTimingEqual(String(password || ""), expected)) {
        return sendJson(response, 401, { error: "That username and password did not match." });
      }
      const token = crypto.randomBytes(32).toString("hex");
      sessions.set(token, { username, createdAt: Date.now() });
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": `crashtest_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
        "Cache-Control": "no-store"
      });
      return response.end(JSON.stringify({ username, displayName: accountNames.get(username) }));
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/auth/session" && request.method === "GET") {
    const token = parseCookies(request).crashtest_session;
    const session = token ? sessions.get(token) : null;
    return sendJson(response, session ? 200 : 401, session ? {
      username: session.username,
      displayName: accountNames.get(session.username)
    } : { error: "Signed out" });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const token = parseCookies(request).crashtest_session;
    if (token) sessions.delete(token);
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": "crashtest_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
      "Cache-Control": "no-store"
    });
    return response.end(JSON.stringify({ ok: true }));
  }

  if (url.pathname === "/api/reports" && request.method === "POST") {
    try {
      const report = await readJson(request);
      if (!String(report.title || "").trim() || !String(report.description || "").trim()) {
        return sendJson(response, 400, { error: "Issue summary and description are required." });
      }
      const reports = readReports();
      const entry = {
        id: createReportId(reports),
        title: String(report.title).trim().slice(0, 120),
        category: String(report.category || "Other").trim(),
        severity: String(report.severity || "Medium").trim(),
        status: "Open",
        area: String(report.area || "").trim(),
        gameTitle: String(report.gameTitle || "").trim(),
        pageUrl: String(report.pageUrl || "").trim(),
        description: String(report.description).trim(),
        steps: String(report.steps || "").trim(),
        expected: String(report.expected || "").trim(),
        actual: String(report.actual || "").trim(),
        environment: String(report.environment || "").trim(),
        reporter: String(report.reporter || "").trim(),
        email: String(report.email || "").trim(),
        createdAt: new Date().toISOString()
      };
      reports.unshift(entry);
      writeReports(reports);
      return sendJson(response, 201, entry);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/reports" && request.method === "GET") {
    if (!requireAuth(request, response)) return;
    return sendJson(response, 200, readReports());
  }

  const statusMatch = /^\/api\/reports\/([^/]+)$/.exec(url.pathname);
  if (statusMatch && request.method === "PATCH") {
    if (!requireAuth(request, response)) return;
    try {
      const body = await readJson(request);
      if (!["Open", "In development", "Resolved"].includes(body.status)) {
        return sendJson(response, 400, { error: "Invalid status." });
      }
      const reports = readReports();
      const report = reports.find((item) => item.id === decodeURIComponent(statusMatch[1]));
      if (!report) return sendJson(response, 404, { error: "Report not found." });
      report.status = body.status;
      writeReports(reports);
      return sendJson(response, 200, report);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(ROOT, `.${requestedPath}`);
  if (!filePath.startsWith(ROOT + path.sep)) return sendJson(response, 403, { error: "Forbidden" });
  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) return sendJson(response, 404, { error: "Not found" });
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Crashtest Support running at http://localhost:${PORT}`);
});
