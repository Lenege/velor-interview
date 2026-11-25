import { store } from "../_lib/store.js";
import { json, readBody, validId, validSid } from "../_lib/util.js";
import { systemPrompt, START_LINE } from "../_lib/prompts.js";
import { callClaude } from "../_lib/claude.js";
const MAX_MESSAGES = 160, MAX_TEXT = 8000;
export async function onRequestPost({ request, env }) {
  const body = await readBody(request);
  const b = String(body.b || ""), s = String(body.s || "");
  if (!validId(b) || !validSid(s)) return json(400, { error: "bad_params" });
  const db = store(env);
  try {
    const brief = await db.getJSON("brief:" + b);
    if (!brief) return json(404, { error: "not_found" });
    if (brief.active === false) return json(403, { error: "closed" });
    const key = `session:${b}:${s}`;
    const sess = (await db.getJSON(key)) || { messages: [], status: "active", startedAt: new Date().toISOString() };
    if (sess.status === "done") return json(409, { error: "done" });
    if (typeof body.name === "string" && body.name.trim()) sess.name = body.name.trim().slice(0, 80);
    const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
    if (text) sess.messages.push({ role: "user", content: text, at: new Date().toISOString() });
    if (sess.messages.length >= MAX_MESSAGES) return json(429, { error: "too_long" });
    sess.updatedAt = new Date().toISOString();
    await db.setJSON(key, sess); // save the answer before calling the model
    const reply = await callClaude(env, {
      system: systemPrompt(brief),
      messages: [{ role: "user", content: START_LINE }, ...sess.messages.map((m) => ({ role: m.role, content: m.content }))],
      maxTokens: 700,
    });
    sess.messages.push({ role: "assistant", content: reply, at: new Date().toISOString() });
    sess.updatedAt = new Date().toISOString();
    await db.setJSON(key, sess);
    return json(200, { reply, messages: sess.messages });
  } catch (e) { return json(500, { error: String(e.message || e) }); }
}
