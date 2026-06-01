function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function handleOptions(event) {
  if (event.httpMethod !== "OPTIONS") return null;
  return json(204, {});
}

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    const error = new Error(`Missing environment variables: ${missing.join(", ")}`);
    error.statusCode = 500;
    throw error;
  }
}

function parseJsonBody(event) {
  if (!event.body) return {};
  return JSON.parse(event.body);
}

module.exports = {
  handleOptions,
  json,
  parseJsonBody,
  requireEnv,
};
