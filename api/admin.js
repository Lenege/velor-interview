import { getJSON, setJSON, sadd, smembers } from "../lib/store.js";
import { json, readBody, isAdmin, validId } from "../lib/util.js";
import { handoffPrompt, transcriptText } from "../lib/prompts.js";
import { callClaude } from "../lib/claude.js";

function slug(s) {
  const a = (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return a.length >= 2 ? a : "i-" + Math.random().toString(36).slice(2, 8);
}

export default async function handler(req, res) {
  if (!process.env.ADMIN_PASSWORD) return json(res, 500, { error: "admin_password_not_set" });
  if (!isAdmin(req)) return json(res, 401, { error: "unauthorized" });
  try {
    if (req.method === "GET") {
      const op = String(req.query?.op || "");
      if (op === "ping") return json(res, 200, { ok: true });
      if (op === "briefs") {
        const ids = await smembers("briefs");
        const out = [];
        for (const id of ids) {
          const b = await getJSON("brief:" + id);
          if (!b) continue;
          const sids = await smembers("sessions:" + id);
          out.push({ id, ...b, sessions: sids.length });
        }
        out.sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
        return json(res, 200, { briefs: out });
      }
      if (op === "sessions") {
        const b = String(req.query?.b || "");
        if (!validId(b)) return json(res, 400, { error: "bad_id" });
        const sids = await smembers("sessions:" + b);
        const out = [];
        for (const s of sids) {
          const sess = await getJSON(`session:${b}:${s}`);
          if (sess) out.push({ sid: s, ...sess, transcript: transcriptText(sess.messages || []) });
        }
        out.sort((x, y) => String(y.updatedAt).localeCompare(String(x.updatedAt)));
        return json(res, 200, { sessions: out });
      }
      return json(res, 400, { error: "bad_op" });
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      if (body.op === "create") {
        const title = String(body.title || "").trim().slice(0, 140);
        const context = String(body.context || "").trim().slice(0, 30000);
        if (!title || !context) return json(res, 400, { error: "missing_fields" });
        let id = slug(body.id || title);
        if (await getJSON("brief:" + id)) id = id.slice(0, 33) + "-" + Math.random().toString(36).slice(2, 6);
        const brief = {
          title, context,
          lang: body.lang === "en" ? "en" : "ru",
          intro: String(body.intro || "").trim().slice(0, 1000),
          active: true, createdAt: new Date().toISOString(),
        };
        await setJSON("brief:" + id, brief);
        await sadd("briefs", id);
        return json(res, 200, { id });
      }
      if (body.op === "update") {
        const id = String(body.id || "");
        const b = await getJSON("brief:" + id);
        if (!b) return json(res, 404, { error: "not_found" });
        for (const k of ["title", "context", "intro"]) if (typeof body[k] === "string") b[k] = body[k].trim();
        if (body.lang === "en" || body.lang === "ru") b.lang = body.lang;
        if (typeof body.active === "boolean") b.active = body.active;
        await setJSON("brief:" + id, b);
        return json(res, 200, { ok: true });
      }
      if (body.op === "handoff") {
        const id = String(body.b || ""), s = String(body.s || "");
        const brief = await getJSON("brief:" + id);
        const sess = await getJSON(`session:${id}:${s}`);
        if (!brief || !sess) return json(res, 404, { error: "not_found" });
        sess.handoff = await callClaude({
          system: "You write precise editorial handoffs for YouTube scriptwriters.",
          messages: [{ role: "user", content: handoffPrompt(brief, transcriptText(sess.messages || [])) }],
          model: process.env.CLAUDE_HANDOFF_MODEL || process.env.CLAUDE_MODEL,
          maxTokens: 4000,
        });
        delete sess.handoffError;
        await setJSON(`session:${id}:${s}`, sess);
        return json(res, 200, { handoff: sess.handoff });
      }
      return json(res, 400, { error: "bad_op" });
    }
    json(res, 405, { error: "method" });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}
