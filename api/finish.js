import { getJSON, setJSON } from "../lib/store.js";
import { json, readBody, validId, validSid } from "../lib/util.js";
import { handoffPrompt, transcriptText } from "../lib/prompts.js";
import { callClaude } from "../lib/claude.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  const body = await readBody(req);
  const b = String(body.b || ""), s = String(body.s || "");
  if (!validId(b) || !validSid(s)) return json(res, 400, { error: "bad_params" });
  try {
    const brief = await getJSON("brief:" + b);
    const key = `session:${b}:${s}`;
    const sess = await getJSON(key);
    if (!brief || !sess) return json(res, 404, { error: "not_found" });
    sess.status = "done";
    sess.finishedAt = new Date().toISOString();
    await setJSON(key, sess);
    try {
      sess.handoff = await callClaude({
        system: "You write precise editorial handoffs for YouTube scriptwriters.",
        messages: [{ role: "user", content: handoffPrompt(brief, transcriptText(sess.messages)) }],
        model: process.env.CLAUDE_HANDOFF_MODEL || process.env.CLAUDE_MODEL,
        maxTokens: 4000,
      });
      await setJSON(key, sess);
    } catch (e) {
      sess.handoffError = String(e.message || e);
      await setJSON(key, sess);
    }
    json(res, 200, { ok: true });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}
