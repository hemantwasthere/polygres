# Polygres Synapse

Personal knowledge graph demo: capture notes, auto-link people/topics/projects, explore a graph, and search by meaning + keywords. Built to showcase [Polygres](https://polygres.com/) (Postgres + graph + vector in one DB). Works without Polygres extensions via SQL fallbacks.

## Quick start

```bash
npm install
docker compose up -d    # optional — Polygres/pgGraph image on port 5432
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Default database URL (Docker):

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/synapse
```

Copy `.env.example` to `.env.local` if you need a custom URL.

## Check if your database is running

Your app reads `DATABASE_URL` from `.env.local` (or falls back to port 5432).

**1. See which URL the app uses**

```bash
grep DATABASE_URL .env.local
```

**2. Check if Postgres is listening**

```bash
# Docker (port 5432)
docker ps --filter name=polygres-synapse-db
lsof -i :5432

# Homebrew fallback (port 55432)
lsof -i :55432
```

**3. Test the connection**

```bash
psql "$DATABASE_URL" -c "SELECT current_database(), version();"
```

Or with your current setup:

```bash
psql "postgres://localhost:55432/synapse" -c "SELECT count(*) FROM knowledge_nodes;"
```

**4. Check Polygres extensions (optional)**

```bash
psql "$DATABASE_URL" -c "SELECT extname FROM pg_extension WHERE extname IN ('graph','vector');"
```

Empty result = app uses fallbacks (recursive SQL graph + local cosine search). Still fully functional.

**Start / stop local Homebrew Postgres** (no Docker):

```bash
npm run db:local:start   # port 55432, data in .local-postgres/
npm run db:local:stop
```

## Local database modes

| Setup | Port | pgGraph | pgvector |
| --- | --- | --- | --- |
| `docker compose up -d` | 5432 | yes | if in image |
| Homebrew Postgres (`db:local:start`) | 55432 | no | no |
| Neon / Supabase / Railway | hosted | no | yes (Neon) |

## Commands

```bash
npm run dev          # Next.js dev server
npm run build        # production build
npm run db:setup     # schema + seed + embeddings
npm run db:seed      # re-seed data
npm run db:reset     # drop and recreate tables
npm test             # embedding tests
```

## Deploy

### Can you deploy on Vercel?

**Yes — the Next.js app deploys on Vercel.** The database does not run on Vercel; you point the app at a hosted Postgres with `DATABASE_URL`.

1. Push repo to GitHub.
2. Import project in [Vercel](https://vercel.com).
3. Add environment variables:
   - `DATABASE_URL` — your hosted Postgres connection string
   - `NEXT_PUBLIC_APP_URL` — e.g. `https://your-app.vercel.app`
4. Deploy. After first deploy, run schema setup once against that database (from your machine or CI):

```bash
DATABASE_URL="your-neon-connection-string" npm run db:setup
```

### Will Polygres run on Vercel?

**No.** Vercel only hosts the app. Polygres/pgGraph is a Postgres extension — it must run inside a Postgres server you control or rent.

### Neon, Supabase, etc.

| Provider | Works? | Notes |
| --- | --- | --- |
| [Neon](https://neon.tech) | yes | pgvector supported; enable it in Neon dashboard. No pgGraph — app uses SQL graph fallback. |
| Supabase | yes | pgvector available. No pgGraph. |
| Railway / Render Postgres | yes | Plain Postgres; fallbacks only unless you run Evokoa's Docker image yourself. |
| Evokoa Polygres / `ghcr.io/evokoa/pggraph` | yes (full) | Only if you host that Postgres image (Docker, VM, k8s). Best for native graph + vector. |

**Neon example**

1. Create a Neon project and copy the connection string.
2. In Neon SQL editor: `CREATE EXTENSION IF NOT EXISTS vector;` (optional, speeds up semantic search).
3. Set `DATABASE_URL` in Vercel to the Neon string (use the pooled connection string for serverless).
4. Run `DATABASE_URL="..." npm run db:setup` locally once to create tables and seed data.

The app does not need OpenAI or any external API — embeddings are computed locally.

### What you lose without Polygres

Without pgGraph: graph traversal uses recursive SQL (fine for small/medium graphs).

Without pgvector: semantic search uses a `double precision[]` column and cosine similarity in SQL (works, slower at scale).

Without both (e.g. plain Neon with pgvector only): you get fast vector search + SQL graph fallback — a good production compromise.

## API

- `POST /api/capture` — save a note, extract entities, update graph
- `GET /api/search?q=...` — hybrid search
- `GET /api/graph?focusId=...` — graph neighborhood
- `POST /api/ask` — evidence-backed answer
- `GET /api/status` — metrics + extension capability flags

## Stack

Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, `pg`.
