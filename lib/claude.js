export async function callClaude({ system, messages, model, maxTokens = 1024 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("api_key_missing");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model || process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || "claude_error_" + r.status);
  return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}
