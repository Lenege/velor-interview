# Velor Interview

Interview pages for Velor briefs: interview.mediavelor.com/<brief-id>, admin at /admin.

## Environment variables (Vercel → Project → Settings → Environment Variables)
- ANTHROPIC_API_KEY: Claude API key (platform.claude.com)
- ADMIN_PASSWORD: password for /admin
- KV_REST_API_URL, KV_REST_API_TOKEN: created automatically by the Upstash for Redis integration (Vercel → Storage)
- CLAUDE_MODEL (optional): defaults to claude-sonnet-5-5
- CLAUDE_HANDOFF_MODEL (optional): model for the final handoff
