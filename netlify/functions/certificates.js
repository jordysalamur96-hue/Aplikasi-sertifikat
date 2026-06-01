const { handleOptions, json, parseJsonBody } = require("./lib/http");
const { supabaseRequest, verifyAuth } = require("./lib/supabase");
const { uploadPdfToDrive } = require("./lib/google-drive");

const table = "/rest/v1/certificates";

function normalizeCertificatePayload(payload, driveFile = null) {
  return {
    nomor: payload.nomor,
    nama: payload.nama,
    kecamatan: payload.kecamatan,
    kelurahan: payload.kelurahan,
    lokasi: payload.lokasi,
    luas: payload.luas,
    tahun: Number(payload.tahun),
    status: "Hak Pakai",
    keterangan: payload.keterangan || "",
    ...(driveFile
      ? {
          pdf_name: driveFile.name,
          pdf_mime_type: driveFile.mimeType,
          pdf_size: driveFile.size,
          google_drive_file_id: driveFile.fileId,
          google_drive_view_url: driveFile.previewUrl,
          google_drive_download_url: driveFile.downloadUrl,
          has_pdf: true,
        }
      : {}),
  };
}

function validateCertificate(payload, requirePdf) {
  const requiredFields = ["nomor", "nama", "kecamatan", "kelurahan", "lokasi", "luas", "tahun"];
  const missing = requiredFields.filter((field) => !payload[field]);

  if (missing.length) {
    return `Field wajib belum lengkap: ${missing.join(", ")}`;
  }

  if (requirePdf && !payload.pdf?.base64Data) {
    return "File PDF wajib diupload.";
  }

  if (payload.pdf && payload.pdf.mimeType !== "application/pdf") {
    return "File harus berformat PDF.";
  }

  return null;
}

async function listCertificates() {
  const query = [
    "select=*",
    "has_pdf=eq.true",
    "order=created_at.desc",
  ].join("&");
  const rows = await supabaseRequest(`${table}?${query}`);
  return json(200, { data: rows });
}

async function createCertificate(event) {
  const payload = parseJsonBody(event);
  const validationError = validateCertificate(payload, true);

  if (validationError) {
    return json(400, { error: validationError });
  }

  const driveFile = await storePdf(payload.pdf);
  const insertPayload = normalizeCertificatePayload(payload, driveFile);
  const rows = await supabaseRequest(table, {
    method: "POST",
    body: JSON.stringify(insertPayload),
  });

  return json(201, { data: rows[0] });
}

async function updateCertificate(event) {
  const payload = parseJsonBody(event);

  if (!payload.id) {
    return json(400, { error: "ID sertifikat wajib diisi." });
  }

  const validationError = validateCertificate(payload, false);

  if (validationError) {
    return json(400, { error: validationError });
  }

  const driveFile = payload.pdf?.base64Data ? await storePdf(payload.pdf) : null;
  const updatePayload = normalizeCertificatePayload(payload, driveFile);
  const rows = await supabaseRequest(`${table}?id=eq.${encodeURIComponent(payload.id)}`, {
    method: "PATCH",
    body: JSON.stringify(updatePayload),
  });

  return json(200, { data: rows[0] });
}

async function storePdf(pdf) {
  if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
    return uploadPdfToDrive({
      filename: pdf.filename,
      mimeType: pdf.mimeType,
      base64Data: pdf.base64Data,
    });
  }

  const fileSize = Buffer.from(pdf.base64Data, "base64").length;

  return {
    fileId: null,
    name: pdf.filename,
    mimeType: pdf.mimeType,
    viewUrl: null,
    previewUrl: null,
    downloadUrl: null,
    size: fileSize,
  };
}

async function deleteCertificate(event) {
  const id = event.queryStringParameters?.id;

  if (!id) {
    return json(400, { error: "ID sertifikat wajib diisi." });
  }

  await supabaseRequest(`${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  return json(200, { ok: true });
}

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  try {
    await verifyAuth(event);

    if (event.httpMethod === "GET") return listCertificates();
    if (event.httpMethod === "POST") return createCertificate(event);
    if (event.httpMethod === "PUT") return updateCertificate(event);
    if (event.httpMethod === "DELETE") return deleteCertificate(event);

    return json(405, { error: "Method not allowed" });
  } catch (error) {
    return json(error.statusCode || 500, {
      error: error.message || "Backend error",
      details: error.details,
    });
  }
};
