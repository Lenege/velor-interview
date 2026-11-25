import { store } from "../_lib/store.js";
import { json, validId, validSid } from "../_lib/util.js";
export async function onRequestGet({ request, env }) {
  const p = new URL(request.url).searchParams; const b = p.get("b") || "", s = p.get("s") || "";
  if (!validId(b) || !validSid(s)) return json(400, { error: "bad_params" });
  const sess = await store(env).getJSON(`session:${b}:${s}`);
  return json(200, sess ? { messages: sess.messages, status: sess.status, name: sess.name || "", progress: sess.status === "done" ? 100 : (sess.progress || Math.min(80, sess.messages.filter((m) => m.role === "user").length * 4)) } : { messages: [], status: "new" });
}
