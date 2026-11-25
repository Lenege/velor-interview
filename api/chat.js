import { getJSON, setJSON, sadd } from "../lib/store.js";
import { json, readBody, validId, validSid } from "../lib/util.js";
import { systemPrompt, START_LINE } from "../lib/prompts.js";
import { callClaude } from "../lib/claude.js";

const MAX_MESSAGES = 160;
const MAX_TEXT = 8000;

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method" });
  const body = await readBody(req);
  const b = String(body.b || ""), s = String(body.s || "");
  if (!validId(b) || !validSid(s)) return json(res, 400, { error: "bad_params" });
  try {
    const brief = await getJSON("brief:" + b);
    if (!brief) return json(res, 404, { error: "not_found" });
    if (brief.active === false) return json(res, 403, { error: "closed" });

    const key = `session:${b}:${s}`;
    let sess = (await getJSON(key)) || { messages: [], status: "active", startedAt: new Date().toISOString() };
    if (sess.status === "done") return json(res, 409, { error: "done" });
    if (typeof body.name === "string" && body.name.trim()) sess.name = body.name.trim().slice(0, 80);

    const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
    if (text) sess.messages.push({ role: "user", content: text, at: new Date().toISOString() });
    if (sess.messages.length >= MAX_MESSAGES) return json(res, 429, { error: "too_long" });

    // Save the answer first so it is never lost, even if the model call fails.
    sess.updatedAt = new Date().toISOString();
    await setJSON(key, sess);
    await sadd("sessions:" + b, s);

    const history = sess.messages.map((m) => ({ role: m.role, content: m.content }));
    const reply = await callClaude({
      system: systemPrompt(brief),
      messages: [{ role: "user", content: START_LINE }, ...history],
      maxTokens: 700,
    });

    sess.messages.push({ role: "assistant", content: reply, at: new Date().toISOString() });
    sess.updatedAt = new Date().toISOString();
    await setJSON(key, sess);
    json(res, 200, { reply, messages: sess.messages });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}
