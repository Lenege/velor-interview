// Anthropic Messages API. Records token usage per month in KV ("usage:YYYY-MM").
export async function callClaude(env, { system, messages, model, maxTokens = 1024 }) {
  if (!env.ANTHROPIC_API_KEY) throw new Error("api_key_missing");
  const useModel = model || env.CLAUDE_MODEL || "claude-sonnet-5-5";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: useModel, max_tokens: maxTokens, system, messages }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || "claude_error_" + r.status);
  try { await addUsage(env, j.usage); } catch {}
  return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}
export async function callClaudeJSON(env, opts) {
  const text = await callClaude(env, opts);
  const s = text.indexOf("{"), a = text.indexOf("[");
  const start = s === -1 ? a : a === -1 ? s : Math.min(s, a);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (start === -1 || end <= start) throw new Error("bad_json_from_model");
  return JSON.parse(text.slice(start, end + 1));
}
async function addUsage(env, u) {
  if (!u || !env.KV) return;
  const key = "usage:" + new Date().toISOString().slice(0, 7);
  const cur = JSON.parse((await env.KV.get(key)) || "null") || { input: 0, output: 0, calls: 0 };
  cur.input += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  cur.output += u.output_tokens || 0; cur.calls += 1;
  await env.KV.put(key, JSON.stringify(cur));
}
export async function checkKey(env) {
  if (!env.ANTHROPIC_API_KEY) return false;
  try {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" } });
    return r.ok;
  } catch { return false; }
}
