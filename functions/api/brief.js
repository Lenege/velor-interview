import { store } from "../_lib/store.js";
import { json, validId } from "../_lib/util.js";
export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!validId(id)) return json(400, { error: "bad_id" });
  const b = await store(env).getJSON("brief:" + id);
  if (!b) return json(404, { error: "not_found" });
  return json(200, { id, title: b.title, lang: b.lang, intro: b.intro || "", active: b.active !== false });
}
