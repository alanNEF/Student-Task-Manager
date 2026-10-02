# Architecture

The npm workspace contains a React/Vite frontend, a NestJS API, and shared TypeScript models and scheduling calculations. Supabase provides Google OAuth, PostgreSQL, and ownership enforcement. Each student owns a private workspace.

## Request flow

1. The browser signs in through Supabase's Google OAuth provider and receives a Supabase session.
2. The frontend sends its Supabase access token in an `Authorization: Bearer` header to NestJS.
3. The API verifies the token with Supabase Auth. Database requests use an anon/publishable key plus the verified user's token.
4. PostgreSQL row-level security checks `auth.uid()` for every workspace table. Composite foreign keys ensure a task's column and linked tags belong to that same user.
5. The frontend refreshes its workspace after mutations and reports request failures.

No service-role key is required. Anonymous users cannot read or mutate workspace data. Profile name/email come from the authenticated account. The signup trigger runs with database-owner privileges solely to initialize profile/default data; its function is not executable by API roles. Mutation RPCs use `security invoker` and a fixed empty search path.

## Data model

| Table           | Ownership and relationships                                                                |
| --------------- | ------------------------------------------------------------------------------------------ |
| `profiles`      | Primary key references `auth.users.id`; contains name, email, avatar URL                   |
| `board_columns` | Owner, name, color, display position, completion flag                                      |
| `tags`          | Owner, name, color                                                                         |
| `tasks`         | Owner, required title, Markdown description, column, hours, date-only deadline, timestamps |
| `task_tags`     | Many-to-many join with owner and composite task/tag foreign keys                           |

Signup initializes To-Do, In-Progress, and Done; Done has `is_done = true`. Initial tags are Class, Job Search, and Personal. The migration also backfills preexisting accounts with conflict-safe inserts. Tag and column names are unique within each owner after case-folding and trimming. Deleting a tag removes links and preserves tasks. Deleting a task removes links. Deleting an auth account cascades its workspace data.

Task creation and editing use database transactions through `create_task` and `update_task`, including tag assignments. An invalid column or tag cannot leave partial task changes. `delete_board_column` moves tasks to an owned destination and deletes their source in one transaction, serializing deletion for a user's workspace. It rejects deletion of the final column. The public API always requires a destination; the SQL RPC also permits an empty-column deletion without one. Direct database deletion of a column with tasks is rejected by its foreign key.

Input limits are enforced by API validation and database checks: title 200 characters, description 20,000 characters, tag/column names 50 characters, positive effort up to 1,000 hours, six-digit hexadecimal colors, and valid date-only deadlines. Tables are indexed by owner and frequently queried status, due date, tag, and column position.

## Ordering and completion

A date-only deadline ends at 23:59:59.999 in the student's current browser timezone. Recommended start time is deadline minus expected effort; tasks are ordered by that start time, then greater effort, creation time, and ID. Tasks without a deadline sort after dated tasks. Missing effort counts as zero for the recommendation. This is a simple prioritization heuristic and does not allocate calendar time.

Completion counts tasks in any column whose `is_done` flag is enabled, independent of the column's displayed name. An empty board shows zero percent. Renaming Done therefore preserves completion behavior, and custom completed columns can contribute to the percentage.

## Demo and deployment

The unconfigured frontend uses a browser-local workspace and the same shared calculations. It is labeled as a demo and does not make database/API requests or claim account synchronization. Supabase configuration enables the authenticated path. Demo records are not silently imported into a real account.

Vercel hosts the frontend and API as separate projects; Supabase hosts data and auth. The product targets a small number of users. The API reads tables in stable paginated batches and combines them into one workspace response. A substantially larger task inventory would need load testing and a measured performance plan. Realtime collaborative editing, calendar allocation, external assignment imports, and notifications are outside the supplied requirements.
