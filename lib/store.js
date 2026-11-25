// Upstash Redis over REST. Works with the env vars the Vercel Upstash integration creates.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function cmd(...args) {
  if (!URL_ || !TOKEN) throw new Error("storage_not_configured");
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

export async function getJSON(key) {
  const v = await cmd("GET", key);
  return v ? JSON.parse(v) : null;
}
export async function setJSON(key, value) {
  await cmd("SET", key, JSON.stringify(value));
}
export async function sadd(key, member) { await cmd("SADD", key, member); }
export async function smembers(key) { return (await cmd("SMEMBERS", key)) || []; }
export async function del(key) { await cmd("DEL", key); }
