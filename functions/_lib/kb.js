// Client knowledge base: answers already given in earlier interviews, reused so nobody is asked twice.
import { callClaude, callClaudeJSON } from "./claude.js";
import { factsPrompt, handoffPrompt, transcriptText } from "./prompts.js";

export async function clientFacts(db, brief) {
  if (!brief || !brief.clientId) return [];
  const c = await db.getJSON("client:" + brief.clientId);
  return (c && Array.isArray(c.facts)) ? c.facts : [];
}

export async function ensureClient(db, id, name) {
  const key = "client:" + id;
  let c = await db.getJSON(key);
  if (!c) { c = { name: name || id, facts: [], createdAt: new Date().toISOString() }; await db.setJSON(key, c); }
  else if (name && c.name !== name) { c.name = name; await db.setJSON(key, c); }
  return c;
}

export function mergeFacts(existing, incoming, source) {
  const out = existing.slice();
  const norm = (t) => String(t || "").trim().toLowerCase();
  for (const f of incoming || []) {
    const topic = String(f.topic || "").trim().slice(0, 120), answer = String(f.answer || "").trim().slice(0, 2000);
    if (!topic || !answer) continue;
    const fact = { topic, answer, source, at: new Date().toISOString() };
    const i = out.findIndex((x) => norm(x.topic) === norm(topic));
    if (i >= 0) out[i] = fact; else out.push(fact);
  }
  return out.slice(-200);
}

// Pulls reusable facts from one finished session into the client's knowledge base.
export async function extractFacts(env, db, b, s) {
  const brief = await db.getJSON("brief:" + b); const key = `session:${b}:${s}`; const sess = await db.getJSON(key);
  if (!brief || !sess || !brief.clientId) return { added: 0, skipped: "no_client" };
  if (!(sess.messages || []).some((m) => m.role === "user")) return { added: 0 };
  const ckey = "client:" + brief.clientId;
  const client = (await db.getJSON(ckey)) || { name: brief.client || brief.clientId, facts: [] };
  const found = await callClaudeJSON(env, {
    system: "You extract structured facts from interviews. Output JSON only.",
    messages: [{ role: "user", content: factsPrompt(brief, transcriptText(sess.messages), client.facts || []) }],
    maxTokens: 3000,
  });
  const list = Array.isArray(found) ? found : [];
  client.facts = mergeFacts(client.facts || [], list, { brief: b, title: brief.title, session: s });
  client.updatedAt = new Date().toISOString();
  await db.setJSON(ckey, client);
  sess.factsAt = new Date().toISOString(); sess.factsCount = list.length;
  await db.setJSON(key, sess);
  return { added: list.length };
}

export async function makeHandoff(env, db, b, s) {
  const brief = await db.getJSON("brief:" + b); const key = `session:${b}:${s}`; const sess = await db.getJSON(key);
  if (!brief || !sess) return null;
  try {
    sess.handoff = await callClaude(env, {
      system: "You write precise editorial handoffs for YouTube scriptwriters.",
      messages: [{ role: "user", content: handoffPrompt(brief, transcriptText(sess.messages || [])) }],
      model: env.CLAUDE_HANDOFF_MODEL || env.CLAUDE_MODEL, maxTokens: 4000,
    });
    delete sess.handoffError;
  } catch (e) { sess.handoffError = String(e.message || e); }
  const fresh = (await db.getJSON(key)) || sess; // keep fields written meanwhile (facts)
  fresh.handoff = sess.handoff; if (sess.handoffError) fresh.handoffError = sess.handoffError; else delete fresh.handoffError;
  await db.setJSON(key, fresh);
  return fresh;
}
