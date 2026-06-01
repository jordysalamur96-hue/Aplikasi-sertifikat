const crypto = require("crypto");
const { requireEnv } = require("./http");

const driveScope = "https://www.googleapis.com/auth/drive.file";

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getPrivateKey() {
  return process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
}

async function getAccessToken() {
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    return getOAuthAccessToken();
  }

  requireEnv(["GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY"]);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: process.env.GOOGLE_CLIENT_EMAIL,
    scope: driveScope,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsignedJwt), getPrivateKey());
  const jwt = `${unsignedJwt}.${base64Url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error_description || data.error || "Google OAuth failed");
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  return data.access_token;
}

async function getOAuthAccessToken() {
  requireEnv(["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"]);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error_description || data.error || "Google OAuth refresh failed");
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  return data.access_token;
}

async function uploadPdfToDrive({ filename, mimeType, base64Data }) {
  requireEnv(["GOOGLE_DRIVE_FOLDER_ID"]);

  const token = await getAccessToken();
  const boundary = `netlify-${Date.now()}`;
  const metadata = {
    name: filename,
    parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    mimeType,
  };
  const fileBuffer = Buffer.from(base64Data, "base64");
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
    },
  );

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || "Google Drive upload failed");
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  if (process.env.PUBLIC_GOOGLE_DRIVE_FILES !== "false") {
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });
  }

  return {
    fileId: data.id,
    name: data.name,
    mimeType: data.mimeType,
    viewUrl: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    previewUrl: `https://drive.google.com/file/d/${data.id}/preview`,
    downloadUrl: data.webContentLink || `https://drive.google.com/uc?id=${data.id}&export=download`,
    size: fileBuffer.length,
  };
}

module.exports = {
  uploadPdfToDrive,
};
