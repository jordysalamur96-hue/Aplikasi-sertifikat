const crypto = require("node:crypto");
const http = require("node:http");
const { mkdir, readFile, rename, rm, writeFile } = require("node:fs/promises");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const DEFAULT_DATA_DIR = path.join(ROOT, "data");
const REQUIRED_FIELDS = ["nomor", "nama", "kecamatan", "kelurahan", "lokasi", "luas", "tahun"];

function loadEnvFile(envFile = path.join(ROOT, ".env")) {
  try {
    const content = readFileSync(envFile, "utf8");
    return Object.fromEntries(content.split(/\r?\n/).flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return [];
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return [[key, value]];
    }));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function getConfig(overrides = {}) {
  const env = { ...loadEnvFile(overrides.envFile), ...process.env };
  return {
    host: overrides.host || env.HOST || "0.0.0.0",
    port: Number(overrides.port || env.PORT || 3000),
    dataDir: path.resolve(overrides.dataDir || env.DATA_DIR || DEFAULT_DATA_DIR),
    username: overrides.username || env.LOCAL_ADMIN_EMAIL || "admin@example.com",
    password: overrides.password || env.LOCAL_ADMIN_PASSWORD || "admin12345",
    tokenSecret: overrides.tokenSecret || env.TOKEN_SECRET || crypto.randomBytes(32).toString("hex"),
  };
}

function sendJson(response, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function sendNoContent(response, status = 204) {
  response.writeHead(status);
  response.end();
}

function safeJoin(baseDir, requestPath) {
  const base = path.resolve(baseDir);
  const relativePath = String(requestPath || "").replace(/^[\\/]+/, "");
  const target = path.resolve(base, relativePath);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw Object.assign(new Error("Path tidak valid."), { statusCode: 400 });
  }
  return target;
}

function normalizeFilename(filename) {
  const ext = path.extname(filename || "sertifikat.pdf").toLowerCase() || ".pdf";
  const base = path.basename(filename || "sertifikat.pdf", ext).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "sertifikat";
  return `${Date.now()}-${crypto.randomUUID()}-${base}${ext}`;
}

async function ensureDataFiles(config) {
  await mkdir(config.dataDir, { recursive: true });
  await mkdir(path.join(config.dataDir, "uploads"), { recursive: true });
  const dbPath = path.join(config.dataDir, "certificates.json");
  try {
    await readFile(dbPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(dbPath, JSON.stringify({ certificates: [] }, null, 2) + "\n", "utf8");
  }
}

async function readDatabase(config) {
  await ensureDataFiles(config);
  const dbPath = path.join(config.dataDir, "certificates.json");
  const content = await readFile(dbPath, "utf8");
  const parsed = JSON.parse(content || "{}");
  return { certificates: Array.isArray(parsed.certificates) ? parsed.certificates : [] };
}

async function writeDatabase(config, database) {
  await ensureDataFiles(config);
  const dbPath = path.join(config.dataDir, "certificates.json");
  const tempPath = `${dbPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, JSON.stringify({ certificates: database.certificates || [] }, null, 2) + "\n", "utf8");
  await rename(tempPath, dbPath);
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function signToken(config, email) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + 12 * 60 * 60 * 1000 }), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", config.tokenSecret).update(payload).digest("base64url");
  return `local-${payload}.${signature}`;
}

function verifyToken(config, request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token.startsWith("local-") || !token.includes(".")) {
    throw Object.assign(new Error("Token login tidak tersedia."), { statusCode: 401 });
  }

  try {
    const [payload, signature] = token.slice("local-".length).split(".");
    const expected = crypto.createHmac("sha256", config.tokenSecret).update(payload).digest("base64url");
    if (!signature || Buffer.byteLength(signature) !== Buffer.byteLength(expected)) {
      throw new Error("Signature length mismatch");
    }
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new Error("Signature mismatch");
    }
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || data.exp < Date.now()) {
      throw Object.assign(new Error("Sesi login sudah kedaluwarsa."), { statusCode: 401 });
    }
    return data;
  } catch (error) {
    if (error.statusCode === 401) throw error;
    throw Object.assign(new Error("Token login tidak valid."), { statusCode: 401 });
  }
}

function isValidPdfPayload(pdf) {
  if (!pdf?.base64Data) return false;
  try {
    return Buffer.from(pdf.base64Data, "base64").subarray(0, 5).toString("utf8") === "%PDF-";
  } catch {
    return false;
  }
}

function validateCertificate(payload, requirePdf) {
  const missing = REQUIRED_FIELDS.filter((field) => !payload[field]);
  if (missing.length) return `Field wajib belum lengkap: ${missing.join(", ")}`;

  const year = Number(payload.tahun);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return "Tahun sertifikat harus berupa angka 1900 sampai 2100.";

  if (requirePdf && !payload.pdf?.base64Data) return "File PDF wajib diupload.";
  if (payload.pdf) {
    if (payload.pdf.mimeType !== "application/pdf") return "File harus berformat PDF.";
    if (!isValidPdfPayload(payload.pdf)) return "Isi file harus berupa PDF yang valid.";
  }
  return null;
}

function mapCertificatePayload(payload, existing = {}, pdfFile = null) {
  const now = new Date().toISOString();
  return {
    id: existing.id || payload.id || crypto.randomUUID(),
    nomor: payload.nomor,
    nama: payload.nama,
    kecamatan: payload.kecamatan,
    kelurahan: payload.kelurahan,
    lokasi: payload.lokasi,
    luas: payload.luas,
    tahun: Number(payload.tahun),
    status: "Hak Pakai",
    keterangan: payload.keterangan || "",
    pdf_name: pdfFile?.originalName || existing.pdf_name || "",
    pdf_mime_type: pdfFile?.mimeType || existing.pdf_mime_type || "",
    pdf_size: pdfFile?.size ?? existing.pdf_size ?? 0,
    local_pdf_path: pdfFile?.relativePath || existing.local_pdf_path || "",
    local_pdf_url: pdfFile?.url || existing.local_pdf_url || "",
    has_pdf: Boolean(pdfFile || existing.has_pdf),
    created_at: existing.created_at || now,
    updated_at: now,
  };
}

async function storePdf(config, pdf) {
  if (!pdf?.base64Data) return null;
  const storedName = normalizeFilename(pdf.filename);
  const relativePath = path.join("uploads", storedName).replaceAll("\\", "/");
  const targetPath = safeJoin(config.dataDir, relativePath);
  const buffer = Buffer.from(pdf.base64Data, "base64");
  await writeFile(targetPath, buffer);
  return {
    originalName: pdf.filename || storedName,
    mimeType: pdf.mimeType || "application/pdf",
    size: buffer.length,
    relativePath,
    url: `/uploads/${encodeURIComponent(storedName)}`,
  };
}

async function handleLogin(config, request, response) {
  const { email, password } = await readJsonBody(request);
  if (email !== config.username || password !== config.password) {
    return sendJson(response, 401, { error: "Email atau password salah." });
  }
  return sendJson(response, 200, {
    accessToken: signToken(config, email),
    expiresIn: 12 * 60 * 60,
    user: { email },
  });
}

async function listCertificates(config, response) {
  const database = await readDatabase(config);
  const rows = [...database.certificates].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return sendJson(response, 200, { data: rows });
}

async function createCertificate(config, request, response) {
  const payload = await readJsonBody(request);
  const validationError = validateCertificate(payload, true);
  if (validationError) return sendJson(response, 400, { error: validationError });

  const database = await readDatabase(config);
  const pdfFile = await storePdf(config, payload.pdf);
  const row = mapCertificatePayload(payload, {}, pdfFile);
  database.certificates.unshift(row);
  await writeDatabase(config, database);
  return sendJson(response, 201, { data: row });
}

async function updateCertificate(config, request, response) {
  const payload = await readJsonBody(request);
  if (!payload.id) return sendJson(response, 400, { error: "ID sertifikat wajib diisi." });
  const validationError = validateCertificate(payload, false);
  if (validationError) return sendJson(response, 400, { error: validationError });

  const database = await readDatabase(config);
  const index = database.certificates.findIndex((row) => row.id === payload.id);
  if (index === -1) return sendJson(response, 404, { error: "Data sertifikat tidak ditemukan." });

  const existing = database.certificates[index];
  const pdfFile = payload.pdf?.base64Data ? await storePdf(config, payload.pdf) : null;
  const oldPdfPath = pdfFile ? existing.local_pdf_path : "";
  const row = mapCertificatePayload(payload, existing, pdfFile);
  database.certificates[index] = row;
  await writeDatabase(config, database);
  if (oldPdfPath && oldPdfPath !== row.local_pdf_path) await rm(safeJoin(config.dataDir, oldPdfPath), { force: true });
  return sendJson(response, 200, { data: row });
}

async function deleteCertificate(config, url, response) {
  const id = url.searchParams.get("id");
  if (!id) return sendJson(response, 400, { error: "ID sertifikat wajib diisi." });
  const database = await readDatabase(config);
  const row = database.certificates.find((item) => item.id === id);
  database.certificates = database.certificates.filter((item) => item.id !== id);
  await writeDatabase(config, database);
  if (row?.local_pdf_path) await rm(safeJoin(config.dataDir, row.local_pdf_path), { force: true });
  return sendJson(response, 200, { ok: true });
}

async function serveUpload(config, requestPath, response) {
  const filename = decodeURIComponent(requestPath.replace(/^\/uploads\//, ""));
  const target = safeJoin(path.join(config.dataDir, "uploads"), filename);

  try {
    const content = await readFile(target);
    response.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Length": content.length,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(content);
  } catch (error) {
    sendJson(response, 404, { error: "File PDF tidak ditemukan." });
  }
}

async function serveStatic(requestPath, response) {
  const pathname = requestPath === "/" ? "/index.html" : decodeURIComponent(requestPath);
  const publicFiles = new Map([
    ["/index.html", { file: "index.html", type: "text/html; charset=utf-8" }],
    ["/styles.css", { file: "styles.css", type: "text/css; charset=utf-8" }],
    ["/script.js", { file: "script.js", type: "application/javascript; charset=utf-8" }],
  ]);
  const asset = publicFiles.get(pathname);

  if (!asset) return sendJson(response, 404, { error: "Halaman tidak ditemukan." });

  try {
    const content = await readFile(path.join(ROOT, asset.file));
    response.writeHead(200, { "Content-Type": asset.type, "X-Content-Type-Options": "nosniff" });
    response.end(content);
  } catch (error) {
    sendJson(response, 404, { error: "Halaman tidak ditemukan." });
  }
}

function createServer(overrides = {}) {
  const config = getConfig(overrides);
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");

    try {
      if (request.method === "OPTIONS") return sendNoContent(response);
      if (url.pathname === "/api/login" && request.method === "POST") return handleLogin(config, request, response);

      if (url.pathname === "/api/certificates") {
        verifyToken(config, request);
        if (request.method === "GET") return listCertificates(config, response);
        if (request.method === "POST") return createCertificate(config, request, response);
        if (request.method === "PUT") return updateCertificate(config, request, response);
        if (request.method === "DELETE") return deleteCertificate(config, url, response);
        return sendJson(response, 405, { error: "Method not allowed" });
      }

      if (url.pathname.startsWith("/uploads/")) {
        verifyToken(config, request);
        return await serveUpload(config, url.pathname, response);
      }
      return await serveStatic(url.pathname, response);
    } catch (error) {
      return sendJson(response, error.statusCode || 500, { error: error.message || "Backend error" });
    }
  });
}

if (require.main === module) {
  const config = getConfig();
  ensureDataFiles(config).then(() => {
    const server = createServer(config);
    server.listen(config.port, config.host, () => {
      console.log(`Aplikasi Sertifikat berjalan di http://${config.host}:${config.port}/`);
      console.log(`Data lokal: ${config.dataDir}`);
    });
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { createServer, getConfig };
