// Cloudflare KV, bound to the Pages project as "KV".
export const store = (env) => ({
  async getJSON(key) { const v = await env.KV.get(key); return v ? JSON.parse(v) : null; },
  async setJSON(key, value) { await env.KV.put(key, JSON.stringify(value)); },
  async del(key) { await env.KV.delete(key); },
  async list(prefix) {
    const out = []; let cursor;
    do { const r = await env.KV.list({ prefix, cursor }); out.push(...r.keys.map((k) => k.name)); cursor = r.list_complete ? null : r.cursor; } while (cursor);
    return out;
  },
});
