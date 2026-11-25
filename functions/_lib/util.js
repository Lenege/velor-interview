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
export function slugify(s, fallbackPrefix = "i") {
  const map = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",і:"i",ї:"yi",є:"ye",ґ:"g" };
  const t = String(s || "").toLowerCase().split("").map((c) => (map[c] !== undefined ? map[c] : c)).join("");
  const a = t.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
  return a.length >= 2 ? a : fallbackPrefix + "-" + Math.random().toString(36).slice(2, 8);
}
export const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
