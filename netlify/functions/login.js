const { getSupabaseConfig } = require("./lib/supabase");
const { handleOptions, json, parseJsonBody } = require("./lib/http");

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const { email, password } = parseJsonBody(event);

    if (!email || !password) {
      return json(400, { error: "Email dan password wajib diisi." });
    }

    const { url, key } = getSupabaseConfig(false);
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      return json(response.status, {
        error: data.error_description || data.msg || "Login gagal.",
      });
    }

    return json(200, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      user: data.user,
    });
  } catch (error) {
    return json(error.statusCode || 500, {
      error: error.message || "Login gagal.",
      details: error.details,
    });
  }
};
