# Setup and deployment

## Local demo

Node.js 22.12+ and npm are required. From the repository root:

```sh
npm install
npm run dev:demo
```

The frontend runs at `http://localhost:5173`. Leave `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` unset for demo mode. Browser-local demo data is separate from an authenticated student's database data. The API is unnecessary for this mode.

## Use a local Supabase database

The checked-in `supabase/config.toml` already initializes this project, so another `supabase init` is unnecessary. Use the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) with a running Docker-compatible container runtime:

```sh
npx supabase start
npx supabase db reset
npx supabase status
```

`db reset` recreates the local database and applies migrations; use it only for disposable local data. The commands above target the local project. The API URL is `http://127.0.0.1:54321`, PostgreSQL uses port 54322, and Studio uses port 54323. Copy the anon/publishable key shown by `status` into the environment files below. Do not use a service-role/secret key.

```sh
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Set these values for a local Supabase stack:

```dotenv
# apps/api/.env
PORT=3001
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<local-anon-or-publishable-key>
```

```dotenv
# apps/web/.env.local
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<same-local-anon-or-publishable-key>
VITE_API_URL=/api
```

The development `/api` proxy forwards to port 3001. `FRONTEND_URL` is one exact origin for CORS. Frontend `VITE_*` values are public build-time configuration. Google client secrets remain in Supabase Auth configuration, never in frontend environment values.

## Configure Google sign-in

Create a Google Cloud OAuth web application, configure its consent screen and testing audience, and request `openid`, email, and profile scopes. Add `http://localhost:5173` as an authorized JavaScript origin. Add the Supabase callback as an authorized redirect URI:

- Local Supabase: `http://127.0.0.1:54321/auth/v1/callback`
- Hosted Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`

For a local stack, set `auth.external.google.enabled = true` in `supabase/config.toml`, provide `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` in the environment running the CLI, and restart Supabase. The checked-in Google provider is disabled until credentials are supplied.

For a hosted project, enable Google under Supabase Authentication providers and enter the client ID and secret. Set the Supabase Site URL and redirect allowlist to the frontend's exact origin, including `http://localhost:5173` while developing and the eventual production frontend URL. This app redirects back to the frontend origin. Follow the official [Google provider configuration](https://supabase.com/docs/guides/auth/social-login/auth-google).

Run `npm run dev` and sign in with Google. First sign-in creates a profile and the default columns/tags through the database trigger. Verify account name/email in settings, create a task, reload, and confirm persistence. Sign in as a second user to confirm separate workspaces. A configured account with no tasks starts empty; demo sample tasks are not copied into it.

## Use a hosted Supabase project

Create a Supabase project and apply the migration through the CLI:

```sh
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

These commands change the linked project, so verify its reference before pushing. Alternatively, run the initial migration in the project's SQL editor once. For later migrations, consistently use the CLI migration history. Replace both frontend and API Supabase URLs/keys with that project's URL and anon/publishable key. The schema backfills users that existed before migration without duplicating profiles or default names.

## Database checks

For a disposable local PostgreSQL 17 cluster:

```sh
npm run test:db
```

The script discovers binaries with `pg_config --bindir`, creates a temporary cluster with no TCP listener, loads `tests/database/auth-harness.sql`, applies the migration, and runs backfill and security assertions. It always shuts down and removes its cluster. The harness replaces only the Supabase `auth.users` table, `auth.uid()` function, and API roles. These tests have passed against PostgreSQL 17; the harness is not a live Supabase Auth integration.

To run the same rollback assertions with an already-running local Supabase stack and `psql`:

```sh
psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
  -v ON_ERROR_STOP=1 -f supabase/tests/security.sql
```

Use a local/disposable database for this file. It inserts two temporary auth users to exercise signup initialization, switches authenticated/anonymous roles, and rolls every fixture back. A failed assertion stops execution and the disconnected transaction rolls back. It covers all five tables' ownership, cross-user column/tag references, atomic task/tag updates, input checks, timestamps, cascading cleanup, and column migration.

## Vercel deployment

Use two Vercel projects connected to this npm workspace repository. Enable access to source files outside each project's Root Directory so both can build `packages/shared`. This is Vercel's standard [monorepo project model](https://vercel.com/docs/monorepos).

| Setting          | Frontend project                                                                                          | API project                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Root Directory   | `apps/web`                                                                                                | `apps/api`                                                                                                |
| Framework        | Vite                                                                                                      | NestJS                                                                                                    |
| Node.js          | 22.x                                                                                                      | 22.x                                                                                                      |
| Install command  | `cd ../.. && npm ci`                                                                                      | `cd ../.. && npm ci`                                                                                      |
| Build command    | `cd ../.. && npm run build -w @student-task-manager/shared && npm run build -w @student-task-manager/web` | `cd ../.. && npm run build -w @student-task-manager/shared && npm run build -w @student-task-manager/api` |
| Output directory | `dist`                                                                                                    | Leave the framework default                                                                               |

The API's `src/main.ts` follows Vercel's detected NestJS entrypoint convention. Vercel runs the NestJS application as a function; see [NestJS on Vercel](https://vercel.com/docs/frameworks/backend/nestjs). The frontend uses the [Vite framework](https://vercel.com/docs/frameworks/frontend/vite).

Set API environment values:

```dotenv
FRONTEND_URL=https://<frontend-project>.vercel.app
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-or-publishable-key>
```

Set frontend environment values:

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<same-anon-or-publishable-key>
VITE_API_URL=https://<api-project>.vercel.app/api
```

Set environment values for the environments you actually use, then redeploy the frontend because Vite embeds them during the build. Keep `PORT` at Vercel's provided value. Configure the production frontend origin in the Google client and Supabase Auth redirects. For previews, pair the frontend/API origins deliberately; the API's CORS configuration accepts one exact frontend origin.

After deploying, check `https://<api-project>.vercel.app/api/health`, then exercise Google login, task creation/reload/edit/delete, tag and column customization, sign-out, and two-account isolation. Check provider logs for auth errors and API logs for configuration issues. No hosted migration, Google login, or Vercel deployment has been exercised without project credentials.

## Performance acceptance

The under-one-second home-page requirement needs measurement on the deployed authenticated flow. Measure navigation-to-visible-board and Largest Contentful Paint with a realistic task set, a stated device/network profile, and both cold and warm API requests. Check browser performance traces, API latency, database query timing, and bundle size. A fast local demo or passing unit tests does not establish this target.
