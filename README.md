## Getting Started

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase Setup

This project stores per-screen selections in Supabase with:
- `player_id`
- `player_name`
- `tags`
- `comment`

### 1) Create table

Run the SQL in:

```txt
supabase/schema.sql
```

### 2) Configure environment variables

Set these values in `.env`:

```txt
ACCESS_CODE=...
AUTH_SECRET=...
AUTH_SESSION_TTL_SECONDS=43200

SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_TABLE=player_tag_submissions
```

Important:
- `SUPABASE_SERVICE_ROLE_KEY` must be the **service_role** key (not `sb_publishable_...` / anon).
- Keep the service role key server-side only.
- Set `AUTH_SECRET` to a long random secret (at least 32 chars).

## Security Hardening (Implemented)

- Signed `httpOnly` auth session cookie (not plain access code in cookie).
- Stricter cookie policy: `sameSite=strict`, `secure` in production.
- Rate limiting on:
  - login endpoint (`/api/auth`)
  - submit endpoint (`/api/submit`)
  - heavy location detail fetches with playlist preview (`/api/locations?includePlaylistPreview=1`)
- Additional security headers via `next.config.ts`.

Note:
- The built-in rate limiter is in-memory per runtime instance. On Vercel it is best-effort and not global.
- For strict distributed limits, use a shared store (for example Redis/Upstash).
