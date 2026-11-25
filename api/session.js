import { getJSON } from "../lib/store.js";
import { json, validId, validSid } from "../lib/util.js";

export default async function handler(req, res) {
  const b = String(req.query?.b || ""), s = String(req.query?.s || "");
  if (!validId(b) || !validSid(s)) return json(res, 400, { error: "bad_params" });
  try {
    const sess = await getJSON(`session:${b}:${s}`);
    json(res, 200, sess ? { messages: sess.messages, status: sess.status, name: sess.name || "" } : { messages: [], status: "new" });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}
