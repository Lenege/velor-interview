import { store } from "../_lib/store.js";
import { json, readBody, validId, validSid } from "../_lib/util.js";
import { extractFacts, makeHandoff } from "../_lib/kb.js";
export async function onRequestPost({ request, env, waitUntil }) {
  const body = await readBody(request);
  const b = String(body.b || ""), s = String(body.s || "");
  if (!validId(b) || !validSid(s)) return json(400, { error: "bad_params" });
  const db = store(env); const key = `session:${b}:${s}`;
  const sess = await db.getJSON(key);
  if (!sess) return json(404, { error: "not_found" });
  sess.status = "done"; sess.finishedAt = new Date().toISOString();
  await db.setJSON(key, sess);
  // Best effort after the response: save reusable facts first, then the script handoff.
  // Both can be re-run from the studio if they did not finish in time.
  waitUntil((async () => {
    try { await extractFacts(env, db, b, s); } catch (e) {}
    try { await makeHandoff(env, db, b, s); } catch (e) {}
  })());
  return json(200, { ok: true });
}
