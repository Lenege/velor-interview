export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const s = Buffer.concat(chunks).toString("utf8");
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}
export function isAdmin(req) {
  const pass = process.env.ADMIN_PASSWORD;
  const got = req.headers["x-admin-key"];
  return !!pass && typeof got === "string" && got === pass;
}
export const validId = (s) => typeof s === "string" && /^[a-z0-9-]{2,64}$/.test(s);
export const validSid = (s) => typeof s === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(s);
