const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createServer, getConfig } = require("../server");

async function withTestServer(fn) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "sertifikat-local-"));
  const app = createServer({
    dataDir,
    username: "admin@example.test",
    password: "rahasia123",
    tokenSecret: "test-secret",
  });

  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${app.address().port}`;

  try {
    await fn({ baseUrl, dataDir });
  } finally {
    await new Promise((resolve) => app.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

test("serves the frontend homepage", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Sistem Arsip Sertifikat/i);
  });
});

test("does not expose private project files as static assets", async () => {
  await withTestServer(async ({ baseUrl, dataDir }) => {
    await writeFile(path.join(dataDir, "certificates.json"), JSON.stringify({ certificates: [{ nomor: "RAHASIA" }] }), "utf8");

    const forbiddenPaths = ["/.env", "/server.js", "/tests/server.test.js", "/data/certificates.json"];
    for (const requestPath of forbiddenPaths) {
      const response = await fetch(`${baseUrl}${requestPath}`);
      const body = await response.text();

      assert.equal(response.status, 404, `${requestPath} should not be publicly served`);
      assert.doesNotMatch(body, /LOCAL_ADMIN_|RAHASIA|function createServer|admin@example\.test/);
    }
  });
});

test("loads local admin credentials from a .env file", async () => {
  const configDir = await mkdtemp(path.join(tmpdir(), "sertifikat-env-"));
  const envFile = path.join(configDir, ".env");
  await writeFile(envFile, [
    "LOCAL_ADMIN_EMAIL=eta123@gmail.com",
    "LOCAL_ADMIN_PASSWORD=eta123",
    "TOKEN_SECRET=secret-dari-env",
    "PORT=3999",
  ].join("\n") + "\n", "utf8");

  try {
    const config = getConfig({ envFile });

    assert.equal(config.username, "eta123@gmail.com");
    assert.equal(config.password, "eta123");
    assert.equal(config.tokenSecret, "secret-dari-env");
    assert.equal(config.port, 3999);
  } finally {
    await rm(configDir, { recursive: true, force: true });
  }
});

test("login returns a bearer token for the configured local admin", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const { response, body } = await jsonRequest(`${baseUrl}/api/login`, {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.test", password: "rahasia123" }),
    });

    assert.equal(response.status, 200);
    assert.match(body.accessToken, /^local-/);
    assert.equal(body.user.email, "admin@example.test");
  });
});

test("protected certificate API returns 401 for malformed bearer tokens", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const { response, body } = await jsonRequest(`${baseUrl}/api/certificates`, {
      headers: { Authorization: "Bearer local-payload.bad" },
    });

    assert.equal(response.status, 401);
    assert.match(body.error, /Token login tidak valid|Token login tidak tersedia/);
  });
});

test("certificate API stores metadata and PDF in the local data directory", async () => {
  await withTestServer(async ({ baseUrl, dataDir }) => {
    const login = await jsonRequest(`${baseUrl}/api/login`, {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.test", password: "rahasia123" }),
    });
    const token = login.body.accessToken;

    const pdfBase64 = Buffer.from("%PDF-1.4\n% test pdf\n").toString("base64");
    const create = await jsonRequest(`${baseUrl}/api/certificates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nomor: "SH-PK/2026/001",
        nama: "Tanah Kantor",
        kecamatan: "Tuban",
        kelurahan: "Latsari",
        lokasi: "Jl. Contoh",
        luas: "100 m2",
        tahun: "2026",
        keterangan: "Unit test",
        pdf: {
          filename: "sertifikat-test.pdf",
          mimeType: "application/pdf",
          base64Data: pdfBase64,
        },
      }),
    });

    assert.equal(create.response.status, 201);
    assert.equal(create.body.data.nomor, "SH-PK/2026/001");
    assert.equal(create.body.data.has_pdf, true);
    assert.match(create.body.data.local_pdf_url, /^\/uploads\//);

    const dbFile = path.join(dataDir, "certificates.json");
    const savedJson = JSON.parse(await readFile(dbFile, "utf8"));
    assert.equal(savedJson.certificates.length, 1);

    const list = await jsonRequest(`${baseUrl}/api/certificates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(list.response.status, 200);
    assert.equal(list.body.data.length, 1);

    const pdf = await fetch(`${baseUrl}${create.body.data.local_pdf_url}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.equal(await pdf.text(), "%PDF-1.4\n% test pdf\n");

    const publicPdf = await fetch(`${baseUrl}${create.body.data.local_pdf_url}`);
    assert.equal(publicPdf.status, 401);
  });
});

test("certificate API rejects invalid year and non-PDF content", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const login = await jsonRequest(`${baseUrl}/api/login`, {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.test", password: "rahasia123" }),
    });
    const auth = { Authorization: `Bearer ${login.body.accessToken}` };
    const basePayload = {
      nomor: "SH-PK/2026/003",
      nama: "Validasi",
      kecamatan: "Tuban",
      kelurahan: "Latsari",
      lokasi: "Jl. Validasi",
      luas: "100 m2",
      tahun: "2026",
      pdf: { filename: "validasi.pdf", mimeType: "application/pdf", base64Data: Buffer.from("%PDF-1.4\n% valid\n").toString("base64") },
    };

    const invalidYear = await jsonRequest(`${baseUrl}/api/certificates`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ ...basePayload, tahun: "1800" }),
    });
    assert.equal(invalidYear.response.status, 400);
    assert.match(invalidYear.body.error, /Tahun/);

    const invalidPdf = await jsonRequest(`${baseUrl}/api/certificates`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        ...basePayload,
        pdf: { filename: "bukan-pdf.pdf", mimeType: "application/pdf", base64Data: Buffer.from("not a pdf").toString("base64") },
      }),
    });
    assert.equal(invalidPdf.response.status, 400);
    assert.match(invalidPdf.body.error, /PDF/);
  });
});

test("certificate API updates and deletes a stored certificate", async () => {
  await withTestServer(async ({ baseUrl }) => {
    const login = await jsonRequest(`${baseUrl}/api/login`, {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.test", password: "rahasia123" }),
    });
    const token = login.body.accessToken;
    const auth = { Authorization: `Bearer ${token}` };
    const pdfBase64 = Buffer.from("%PDF-1.4\n% update test\n").toString("base64");

    const create = await jsonRequest(`${baseUrl}/api/certificates`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        nomor: "SH-PK/2026/002",
        nama: "Nama Awal",
        kecamatan: "Tuban",
        kelurahan: "Latsari",
        lokasi: "Jl. Contoh",
        luas: "100 m2",
        tahun: "2026",
        pdf: { filename: "awal.pdf", mimeType: "application/pdf", base64Data: pdfBase64 },
      }),
    });
    const id = create.body.data.id;

    const update = await jsonRequest(`${baseUrl}/api/certificates`, {
      method: "PUT",
      headers: auth,
      body: JSON.stringify({
        id,
        nomor: "SH-PK/2026/002",
        nama: "Nama Revisi",
        kecamatan: "Tuban",
        kelurahan: "Latsari",
        lokasi: "Jl. Contoh Revisi",
        luas: "120 m2",
        tahun: "2026",
        keterangan: "Sudah direvisi",
      }),
    });
    assert.equal(update.response.status, 200);
    assert.equal(update.body.data.nama, "Nama Revisi");
    assert.equal(update.body.data.has_pdf, true);

    const oldPdfUrl = create.body.data.local_pdf_url;
    const replacementPdfBase64 = Buffer.from("%PDF-1.4\n% replacement pdf\n").toString("base64");
    const replacePdf = await jsonRequest(`${baseUrl}/api/certificates`, {
      method: "PUT",
      headers: auth,
      body: JSON.stringify({
        id,
        nomor: "SH-PK/2026/002",
        nama: "Nama Revisi",
        kecamatan: "Tuban",
        kelurahan: "Latsari",
        lokasi: "Jl. Contoh Revisi",
        luas: "120 m2",
        tahun: "2026",
        keterangan: "PDF diganti",
        pdf: { filename: "pengganti.pdf", mimeType: "application/pdf", base64Data: replacementPdfBase64 },
      }),
    });
    assert.equal(replacePdf.response.status, 200);
    assert.notEqual(replacePdf.body.data.local_pdf_url, oldPdfUrl);

    const oldPdf = await fetch(`${baseUrl}${oldPdfUrl}`, { headers: auth });
    assert.equal(oldPdf.status, 404);

    const remove = await jsonRequest(`${baseUrl}/api/certificates?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: auth,
    });
    assert.equal(remove.response.status, 200);

    const list = await jsonRequest(`${baseUrl}/api/certificates`, { headers: auth });
    assert.equal(list.body.data.length, 0);
  });
});
