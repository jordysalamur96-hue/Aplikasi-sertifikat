const { requireEnv } = require("./http");

function getSupabaseConfig(useServiceRole = true) {
  requireEnv(["SUPABASE_URL", useServiceRole ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_ANON_KEY"]);

  return {
    url: process.env.SUPABASE_URL.replace(/\/$/, ""),
    key: useServiceRole ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_ANON_KEY,
  };
}

async function supabaseRequest(path, options = {}) {
  const { url, key } = getSupabaseConfig(options.useServiceRole !== false);
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.message || data?.error_description || "Supabase request failed");
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

async function verifyAuth(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }

  const { url, key } = getSupabaseConfig(false);
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();

  if (!response.ok) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    error.details = data;
    throw error;
  }

  return data;
}

module.exports = {
  getSupabaseConfig,
  supabaseRequest,
  verifyAuth,
};
