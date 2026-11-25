import { store } from "../_lib/store.js";
import { json, readBody, validId, validSid } from "../_lib/util.js";
import { handoffPrompt, transcriptText } from "../_lib/prompts.js";
import { callClaude } from "../_lib/claude.js";
export async function makeHandoff(env, db, b, s) {
  const brief = await db.getJSON("brief:" + b); const key = `session:${b}:${s}`; const sess = await db.getJSON(key);
  if (!brief || !sess) return null;
  try {
    sess.handoff = await callClaude(env, {
      system: "You write precise editorial handoffs for YouTube scriptwriters.",
      messages: [{ role: "user", content: handoffPrompt(brief, transcriptText(sess.messages || [])) }],
      model: env.CLAUDE_HANDOFF_MODEL || env.CLAUDE_MODEL, maxTokens: 4000,
    });
    delete sess.handoffError;
  } catch (e) { sess.handoffError = String(e.message || e); }
  await db.setJSON(key, sess);
  return sess;
}
export async function onRequestPost({ request, env, waitUntil }) {
  const body = await readBody(request);
  const b = String(body.b || ""), s = String(body.s || "");
  if (!validId(b) || !validSid(s)) return json(400, { error: "bad_params" });
  const db = store(env); const key = `session:${b}:${s}`;
  const sess = await db.getJSON(key);
  if (!sess) return json(404, { error: "not_found" });
  sess.status = "done"; sess.finishedAt = new Date().toISOString();
  await db.setJSON(key, sess);
  waitUntil(makeHandoff(env, db, b, s)); // handoff is built after the response
  return json(200, { ok: true });
}
