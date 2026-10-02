# Student Task Manager

A student workspace for assignments, job applications, and personal work, built with TypeScript, Node.js, NestJS, Supabase, React, and shadcn/ui. The interface uses a compact, Linear-inspired Kanban board with editable tasks, Markdown descriptions, tags, deadlines, effort estimates, and completion tracking.

## Try the local demo

Use Node.js 22.12 or newer and npm. Run these commands from the repository root:

```sh
npm install
npm run dev:demo
```

Open [localhost:5173](http://localhost:5173). Without Supabase frontend environment values, the app opens an explicitly labeled demo with sample tasks. Changes persist in this browser's local storage. Demo data does not create an account, sync between devices, or migrate automatically into an authenticated workspace. Clearing browser storage removes it.

To use Google sign-in and database persistence, follow [the setup guide](docs/setup.md), then run `npm run dev` to start the frontend on port 5173 and the NestJS API on port 3001.

## What is included

- Task creation, editing, deletion, Markdown preview, optional hours and due date, and multiple tags.
- Default To-Do, In-Progress, and Done columns; drag tasks between columns or change status in the task editor.
- Tag filtering, recommended task ordering, completion percentage, and remaining effort.
- Blue accents and a top-right light/dark toggle that follows device appearance until a choice is saved in the browser.
- Settings with account name/email, tag creation/editing/deletion, and customizable columns with a destination for tasks when deleting a column.
- Supabase Google OAuth wiring, profile/default-workspace initialization, owner-scoped row-level security, and transactional task/tag updates.
- A NestJS API that verifies Supabase access tokens, validates request data, and accesses the database under the student's own session.

Google OAuth and account-backed persistence require a configured Supabase project and Google OAuth application. Deployment instructions are included; no live project or deployment is created by this repository.

## Project structure

| Path                          | Purpose                                                                |
| ----------------------------- | ---------------------------------------------------------------------- |
| `apps/web`                    | React/Vite frontend and local shadcn/ui components                     |
| `apps/api`                    | NestJS HTTP API                                                        |
| `packages/shared`             | TypeScript contracts, prioritization, and completion calculations      |
| `supabase/migrations`         | PostgreSQL schema, ownership policies, signup trigger, and atomic RPCs |
| `supabase/tests/security.sql` | Database assertions with rolled-back fixtures                          |
| `tests`                       | Browser tests and disposable PostgreSQL auth harness                   |
| `docs`                        | Setup, architecture, and PRD requirement mapping                       |

## Development and verification

```sh
npm run dev:demo      # frontend with local demo data
npm run dev           # configured NestJS API + frontend
npm run build         # shared package, API, then frontend
npm run typecheck
npm test              # shared calculations, API, frontend unit tests
npm run test:db        # disposable PostgreSQL security/integrity assertions
npm run test:e2e       # Playwright local-demo browser flows
```

Playwright requires its Chromium browser (`npx playwright install chromium`). `test:db` requires local PostgreSQL 17 binaries discoverable through `pg_config`; it starts and cleans up its own temporary cluster and uses a small auth-schema stand-in. It verifies the actual migration, RLS policies, cross-user foreign-key integrity, transactional updates, timestamps, and cascades. It does not verify the live Supabase Auth service or Google's OAuth flow. The same assertion file can run against a local Supabase database; see [setup](docs/setup.md).

The browser suite exercises the local demo. Production authentication, live Supabase integration, Vercel deployment, and the PRD's under-one-second rendering target require configured integration testing and performance measurements. See [requirement coverage](docs/requirements.md) for the exact scope.

The official [Supabase CLI guide](https://supabase.com/docs/guides/local-development/cli/getting-started), [Google sign-in guide](https://supabase.com/docs/guides/auth/social-login/auth-google), [Vercel monorepo guide](https://vercel.com/docs/monorepos), and [NestJS hosting guide](https://vercel.com/docs/frameworks/backend/nestjs) explain the external setup used here.

Licensed under the repository's [Apache 2.0 license](LICENSE).
