export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
export async function readBody(request) { try { return await request.json(); } catch { return {}; } }
export function isAdmin(request, env) {
  const pass = env.ADMIN_PASSWORD; const got = request.headers.get("x-admin-key");
  return !!pass && typeof got === "string" && got === pass;
}
export const validId = (s) => typeof s === "string" && /^[a-z0-9-]{2,64}$/.test(s);
export const validSid = (s) => typeof s === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(s);
