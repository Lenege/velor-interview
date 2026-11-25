# Velor Interview

Interview pages for Velor briefs: interview.mediavelor.com/<brief-id>; admin panel at /admin.
Hosting: Cloudflare Pages (build output: `public`, functions in `functions/`).

## Pages settings
- Build command: none. Build output directory: `public`.
- Bindings → KV namespace: variable name `KV`.
- Variables and secrets: `ANTHROPIC_API_KEY` (secret), `ADMIN_PASSWORD` (secret), optional `CLAUDE_MODEL`, `CLAUDE_HANDOFF_MODEL`.
