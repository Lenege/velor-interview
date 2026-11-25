import { store } from "../_lib/store.js";
import { json, readBody, isAdmin, validId, validSid, slugify, str } from "../_lib/util.js";
import { transcriptText, presentationPrompt } from "../_lib/prompts.js";
import { callClaudeJSON, checkKey } from "../_lib/claude.js";
import { clientFacts, ensureClient, extractFacts, makeHandoff, mergeFacts } from "../_lib/kb.js";

const answersOf = (sess) => (sess.messages || []).filter((m) => m.role === "user").length;

function sessionStatus(sess) {
  if (sess.status === "done") return sess.handoff ? "script" : "done";
  return answersOf(sess) ? "progress" : "waiting";
}

async function briefSummary(db, id, b) {
  const keys = await db.list(`session:${id}:`);
  let answers = 0, progress = 0, done = 0, script = 0, last = b.updatedAt || b.createdAt || "";
  for (const k of keys) {
    const s = await db.getJSON(k); if (!s) continue;
    answers += answersOf(s);
    const st = sessionStatus(s);
    if (st === "progress") progress++; if (st === "done" || st === "script") done++; if (st === "script") script++;
    if (String(s.updatedAt || "") > String(last)) last = s.updatedAt;
  }
  const status = script ? "script" : done ? "done" : progress ? "progress" : "waiting";
  return {
    id, title: b.title, lang: b.lang, active: b.active !== false, removed: !!b.removed,
    speaker: b.speaker || "", client: b.client || "", clientId: b.clientId || "",
    summary: (b.presentation && b.presentation.concept && b.presentation.concept.summary) || b.intro || "",
    hasPresentation: !!b.presentation, createdAt: b.createdAt, updatedAt: last,
    sessions: keys.length, answers, status,
  };
}

async function youtubeInfo(url) {
  try {
    const r = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(url));
    if (!r.ok) return {};
    const j = await r.json();
    return { title: j.title || "", channel: j.author_name || "", thumb: j.thumbnail_url || "" };
  } catch { return {}; }
}

function cleanPresentation(p) {
  if (!p || typeof p !== "object") return null;
  const t = (v, n = 4000) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const o = (v) => (v && typeof v === "object" ? v : {});
  const c = o(p.concept), v = o(p.vision), h = o(p.hook), m = o(p.midroll), e = o(p.endcta), n = o(p.next);
  return {
    concept: { title: t(c.title, 200), summary: t(c.summary), audience: t(c.audience) },
    vision: { text: t(v.text), feel: t(v.feel) },
    hook: { note: t(h.note), draft: t(h.draft) },
    midroll: { enabled: m.enabled !== false && !!(t(m.approach) || t(m.note)), note: t(m.note), approach: t(m.approach), confirm: t(m.confirm) },
    endcta: { note: t(e.note), options: (Array.isArray(e.options) ? e.options : []).slice(0, 4).map((x) => ({ label: t(o(x).label, 200), text: t(o(x).text) })).filter((x) => x.label || x.text) },
    next: { good: t(n.good), need: t(n.need), covers: (Array.isArray(n.covers) ? n.covers : []).map((x) => t(x, 400)).filter(Boolean).slice(0, 10) },
  };
}

async function applyBriefFields(db, b, body) {
  if (typeof body.title === "string") b.title = str(body.title, 140);
  if (typeof body.context === "string") b.context = str(body.context, 30000);
  if (typeof body.intro === "string") b.intro = str(body.intro, 1000);
  if (typeof body.speaker === "string") b.speaker = str(body.speaker, 80);
  if (typeof body.writtenBy === "string") b.writtenBy = str(body.writtenBy, 80);
  if (body.lang === "en" || body.lang === "ru") b.lang = body.lang;
  if (typeof body.active === "boolean") b.active = body.active;
  if (typeof body.client === "string") {
    const name = str(body.client, 80);
    if (name) { const cid = slugify(name, "c"); b.client = name; b.clientId = cid; await ensureClient(db, cid, name); }
    else { b.client = ""; b.clientId = ""; }
  }
  if (body.reference && typeof body.reference === "object") {
    const url = str(body.reference.url, 500);
    if (!url) b.reference = null;
    else {
      const prev = b.reference || {};
      const info = url !== prev.url || !prev.title ? await youtubeInfo(url) : prev;
      b.reference = { url, note: str(body.reference.note, 2000), title: str(body.reference.title, 200) || info.title || "", channel: info.channel || prev.channel || "", thumb: info.thumb || prev.thumb || "" };
    }
  }
  if (body.presentation !== undefined) b.presentation = body.presentation ? cleanPresentation(body.presentation) : null;
  b.updatedAt = new Date().toISOString();
  return b;
}

export async function onRequest({ request, env }) {
  if (!env.ADMIN_PASSWORD) return json(500, { error: "admin_password_not_set" });
  if (!isAdmin(request, env)) return json(401, { error: "unauthorized" });
  const db = store(env);
  try {
    if (request.method === "GET") {
      const p = new URL(request.url).searchParams; const op = p.get("op");
      if (op === "ping") return json(200, { ok: true, ai: await checkKey(env) });
      if (op === "usage") {
        const month = new Date().toISOString().slice(0, 7);
        return json(200, { month, ...((await db.getJSON("usage:" + month)) || { input: 0, output: 0, calls: 0 }) });
      }
      if (op === "briefs") {
        const keys = await db.list("brief:"); const out = [];
        for (const k of keys) { const b = await db.getJSON(k); if (b) out.push(await briefSummary(db, k.slice(6), b)); }
        out.sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
        return json(200, { briefs: out });
      }
      if (op === "brief") {
        const id = p.get("id") || ""; if (!validId(id)) return json(400, { error: "bad_id" });
        const b = await db.getJSON("brief:" + id); if (!b) return json(404, { error: "not_found" });
        return json(200, { brief: { id, ...b }, summary: await briefSummary(db, id, b) });
      }
      if (op === "sessions") {
        const b = p.get("b") || ""; if (!validId(b)) return json(400, { error: "bad_id" });
        const keys = await db.list(`session:${b}:`); const out = [];
        for (const k of keys) { const s = await db.getJSON(k); if (s) out.push({ sid: k.split(":")[2], ...s, answers: answersOf(s), state: sessionStatus(s), transcript: transcriptText(s.messages || []) }); }
        out.sort((x, y) => String(y.updatedAt).localeCompare(String(x.updatedAt)));
        return json(200, { sessions: out });
      }
      if (op === "clients") {
        const keys = await db.list("client:"); const briefs = [];
        for (const k of await db.list("brief:")) { const b = await db.getJSON(k); if (b && !b.removed) briefs.push(b); }
        const out = [];
        for (const k of keys) {
          const c = await db.getJSON(k); if (!c) continue; const id = k.slice(7);
          out.push({ id, name: c.name, facts: (c.facts || []).length, interviews: briefs.filter((b) => b.clientId === id).length, updatedAt: c.updatedAt || c.createdAt });
        }
        out.sort((x, y) => String(x.name).localeCompare(String(y.name)));
        return json(200, { clients: out });
      }
      if (op === "client") {
        const id = p.get("id") || ""; if (!validId(id)) return json(400, { error: "bad_id" });
        const c = await db.getJSON("client:" + id); if (!c) return json(404, { error: "not_found" });
        const interviews = [];
        for (const k of await db.list("brief:")) { const b = await db.getJSON(k); if (b && b.clientId === id && !b.removed) interviews.push({ id: k.slice(6), title: b.title }); }
        return json(200, { client: { id, ...c, interviews } });
      }
      return json(400, { error: "bad_op" });
    }

    if (request.method === "POST") {
      const body = await readBody(request);
      if (body.op === "create") {
        if (!str(body.title, 140) || !str(body.context, 30000)) return json(400, { error: "missing_fields" });
        let id = slugify(body.id || body.title);
        if (await db.getJSON("brief:" + id)) id = id.slice(0, 33) + "-" + Math.random().toString(36).slice(2, 6);
        const b = await applyBriefFields(db, { lang: "ru", active: true, createdAt: new Date().toISOString(), writtenBy: "Velor Media" }, body);
        await db.setJSON("brief:" + id, b);
        return json(200, { id });
      }
      if (body.op === "update") {
        const id = String(body.id || ""); if (!validId(id)) return json(400, { error: "bad_id" });
        const b = await db.getJSON("brief:" + id); if (!b) return json(404, { error: "not_found" });
        await applyBriefFields(db, b, body);
        await db.setJSON("brief:" + id, b);
        return json(200, { ok: true, brief: { id, ...b } });
      }
      if (body.op === "remove" || body.op === "restore") {
        const id = String(body.id || ""); const b = await db.getJSON("brief:" + id); if (!b) return json(404, { error: "not_found" });
        b.removed = body.op === "remove"; if (b.removed) b.active = false; b.updatedAt = new Date().toISOString();
        await db.setJSON("brief:" + id, b); return json(200, { ok: true });
      }
      if (body.op === "present") {
        // Draft a pre-interview presentation from the brief (not saved until the studio saves it).
        const id = String(body.id || ""); const b = await db.getJSON("brief:" + id); if (!b) return json(404, { error: "not_found" });
        const facts = await clientFacts(db, b);
        const draft = await callClaudeJSON(env, {
          system: "You write concise pre-interview presentations for YouTube experts. Output JSON only.",
          messages: [{ role: "user", content: presentationPrompt(b, facts) }], maxTokens: 3500,
        });
        return json(200, { presentation: cleanPresentation(draft) });
      }
      if (body.op === "handoff") {
        const sess = await makeHandoff(env, db, String(body.b || ""), String(body.s || ""));
        if (!sess) return json(404, { error: "not_found" });
        if (sess.handoffError) return json(500, { error: sess.handoffError });
        return json(200, { handoff: sess.handoff });
      }
      if (body.op === "facts") {
        const b = String(body.b || ""), s = String(body.s || "");
        if (!validId(b) || !validSid(s)) return json(400, { error: "bad_params" });
        const r = await extractFacts(env, db, b, s);
        if (r.skipped === "no_client") return json(400, { error: "no_client" });
        return json(200, r);
      }
      if (body.op === "client-save") {
        const id = String(body.id || ""); if (!validId(id)) return json(400, { error: "bad_id" });
        const c = (await db.getJSON("client:" + id)) || { createdAt: new Date().toISOString() };
        if (typeof body.name === "string" && body.name.trim()) c.name = str(body.name, 80);
        if (Array.isArray(body.facts)) {
          c.facts = body.facts.map((f) => ({ topic: str(f.topic, 120), answer: str(f.answer, 2000), source: f.source || { manual: true }, at: f.at || new Date().toISOString() })).filter((f) => f.topic && f.answer).slice(0, 200);
        }
        if (Array.isArray(body.add)) c.facts = mergeFacts(c.facts || [], body.add, { manual: true });
        c.updatedAt = new Date().toISOString();
        await db.setJSON("client:" + id, c);
        return json(200, { ok: true, client: { id, ...c } });
      }
      return json(400, { error: "bad_op" });
    }
    return json(405, { error: "method" });
  } catch (e) { return json(500, { error: String(e.message || e) }); }
}
