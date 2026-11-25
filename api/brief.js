import { getJSON } from "../lib/store.js";
import { json, validId } from "../lib/util.js";

export default async function handler(req, res) {
  const id = String(req.query?.id || "");
  if (!validId(id)) return json(res, 400, { error: "bad_id" });
  try {
    const b = await getJSON("brief:" + id);
    if (!b) return json(res, 404, { error: "not_found" });
    json(res, 200, { id, title: b.title, lang: b.lang, intro: b.intro || "", active: b.active !== false });
  } catch (e) {
    json(res, 500, { error: String(e.message || e) });
  }
}
