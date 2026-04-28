# cc-okyte-web

Browser-based CCAF practice & exam app for non-technical teammates. Deployed at **cc.okyte.com**.

Pulls study content from the [consultadd-claude-architect](https://github.com/bdevz/elo) repo via a pinned git submodule, compiles the markdown question bank into a typed JSON bundle at build time, and serves a Next.js 14 app on Vercel.

## What teammates can do

- Sign in with their first name + a shared team password
- Take practice questions one at a time (filter by domain / scenario / difficulty)
- Run paginated mock exams (10 questions per page, autosaved)
- Read all the domain guides, cheatsheets, and scenario walkthroughs
- Ask an AI coach to explain CCAF concepts (grounded in the domain guides)
- See their own progress dashboard (accuracy by domain, recent mocks)

## Local development

```bash
git clone --recurse-submodules https://github.com/bdevz/cc-okyte-web.git
cd cc-okyte-web
cp .env.example .env.local        # fill in DATABASE_URL, SESSION_SECRET, SHARED_PASSWORD_HASH
npm install
npm run db:push                   # migrate schema
npm run db:seed                   # whitelist users from seeds/users.ts
npm run dev                       # http://localhost:3000
```

`npm run build` runs the prebuild content compiler that walks `vendor/consultadd-claude-architect/` and emits `content/{questions,docs,scenarios}.json`.

## Architecture

| Layer | Tech |
|---|---|
| Framework | Next.js 14 App Router |
| Styling | Tailwind 3 + shadcn/ui |
| Database | Vercel Postgres (Neon) + Drizzle ORM |
| Auth | jose JWT in httpOnly cookie + bcryptjs shared password |
| Content | gray-matter + Zod-validated frontmatter, compiled at build |
| AI Coach | @anthropic-ai/sdk with prompt-cached domain guides |
| Tests | Vitest (unit) + Playwright (E2E) |

## Phasing

**Phase A (this slice):** auth + dashboard + practice loop with content compiler.
**Phase A continued:** mock exam, learn (with search), AI coach, admin.
**Phase B:** admin-triggered AI question generation into `_pending/`, in-app password rotation.
