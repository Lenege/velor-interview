import { store } from "../_lib/store.js";
import { json, readBody, isAdmin, validId } from "../_lib/util.js";
import { transcriptText } from "../_lib/prompts.js";
import { makeHandoff } from "./finish.js";
function slug(s) {
  const a = (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return a.length >= 2 ? a : "i-" + Math.random().toString(36).slice(2, 8);
}
export async function onRequest({ request, env }) {
  if (!env.ADMIN_PASSWORD) return json(500, { error: "admin_password_not_set" });
  if (!isAdmin(request, env)) return json(401, { error: "unauthorized" });
  const db = store(env);
  try {
    if (request.method === "GET") {
      const p = new URL(request.url).searchParams; const op = p.get("op");
      if (op === "ping") return json(200, { ok: true });
      if (op === "briefs") {
        const keys = await db.list("brief:"); const out = [];
        for (const k of keys) {
          const id = k.slice(6); const b = await db.getJSON(k); if (!b) continue;
          const sk = await db.list(`session:${id}:`);
          out.push({ id, title: b.title, lang: b.lang, intro: b.intro, active: b.active, createdAt: b.createdAt, sessions: sk.length });
        }
        out.sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
        return json(200, { briefs: out });
      }
      if (op === "sessions") {
        const b = p.get("b") || ""; if (!validId(b)) return json(400, { error: "bad_id" });
        const keys = await db.list(`session:${b}:`); const out = [];
        for (const k of keys) { const sess = await db.getJSON(k); if (sess) out.push({ sid: k.split(":")[2], ...sess, transcript: transcriptText(sess.messages || []) }); }
        out.sort((x, y) => String(y.updatedAt).localeCompare(String(x.updatedAt)));
        return json(200, { sessions: out });
      }
      return json(400, { error: "bad_op" });
    }
    if (request.method === "POST") {
      const body = await readBody(request);
      if (body.op === "create") {
        const title = String(body.title || "").trim().slice(0, 140);
        const context = String(body.context || "").trim().slice(0, 30000);
        if (!title || !context) return json(400, { error: "missing_fields" });
        let id = slug(body.id || title);
        if (await db.getJSON("brief:" + id)) id = id.slice(0, 33) + "-" + Math.random().toString(36).slice(2, 6);
        await db.setJSON("brief:" + id, { title, context, lang: body.lang === "en" ? "en" : "ru", intro: String(body.intro || "").trim().slice(0, 1000), active: true, createdAt: new Date().toISOString() });
        return json(200, { id });
      }
      if (body.op === "update") {
        const id = String(body.id || ""); const b = await db.getJSON("brief:" + id);
        if (!b) return json(404, { error: "not_found" });
        for (const k of ["title", "context", "intro"]) if (typeof body[k] === "string") b[k] = body[k].trim();
        if (body.lang === "en" || body.lang === "ru") b.lang = body.lang;
        if (typeof body.active === "boolean") b.active = body.active;
        await db.setJSON("brief:" + id, b);
        return json(200, { ok: true });
      }
      if (body.op === "handoff") {
        const sess = await makeHandoff(env, db, String(body.b || ""), String(body.s || ""));
        if (!sess) return json(404, { error: "not_found" });
        if (sess.handoffError) return json(500, { error: sess.handoffError });
        return json(200, { handoff: sess.handoff });
      }
      return json(400, { error: "bad_op" });
    }
    return json(405, { error: "method" });
  } catch (e) { return json(500, { error: String(e.message || e) }); }
}
