import { store } from "../_lib/store.js";
import { json, validId } from "../_lib/util.js";
// Public view of a brief for the interview page. Never exposes the private context.
export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!validId(id)) return json(400, { error: "bad_id" });
  const b = await store(env).getJSON("brief:" + id);
  if (!b || b.removed) return json(404, { error: "not_found" });
  return json(200, {
    id, title: b.title, lang: b.lang, intro: b.intro || "", active: b.active !== false,
    speaker: b.speaker || "", client: b.client || "", writtenBy: b.writtenBy || "",
    reference: b.reference || null, presentation: b.presentation || null,
  });
}
