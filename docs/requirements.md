# PRD coverage

The supplied Student Task Manager PRD defines a private student Kanban workspace inspired by Linear. The implementation includes its P0, P1, and P2 feature flows with Google OAuth and hosted persistence enabled by external configuration. The local demo exercises the interface independently of those services.

| PRD ID                     | Implementation                                                                 | Configuration or verification note                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| FR-01, FR-02               | Google sign-up/sign-in through Supabase Auth                                   | Requires Google OAuth credentials and Supabase provider/redirect setup; live OAuth remains unverified without them    |
| FR-03                      | Kanban home page                                                               | Responsive board with task cards                                                                                      |
| FR-04                      | To-Do, In-Progress, Done defaults                                              | Demo defaults and auth signup trigger                                                                                 |
| FR-05                      | Plus/New Task action opens task modal; Markdown description editor and preview | Linear-inspired compact interface                                                                                     |
| FR-06                      | Tag filters on the home page                                                   | Applies to visible tasks                                                                                              |
| FR-07                      | Zero-to-many tags per task                                                     | Database join with atomic create/update                                                                               |
| FR-09                      | Optional effort in hours                                                       | Positive decimals up to 1,000 hours                                                                                   |
| FR-10                      | Required title                                                                 | API/database reject blank titles                                                                                      |
| FR-11                      | Optional description                                                           | Stored as empty text when omitted                                                                                     |
| FR-12                      | Tasks linked to authenticated user                                             | Supabase persistence requires configuration; demo stays in local storage                                              |
| FR-13                      | Class, Job Search, Personal default tags                                       | Demo defaults and signup trigger                                                                                      |
| FR-14                      | Selecting a card opens full task details                                       | Modal displays Markdown preview                                                                                       |
| FR-15                      | Task deletion                                                                  | Confirmation/action in task details; tag links cascade                                                                |
| FR-16                      | Move cards between columns                                                     | Pointer drag and status selection in editor                                                                           |
| FR-17                      | Top-right gear opens settings                                                  | Separate Settings page                                                                                                |
| FR-18                      | Settings display account name/email                                            | Real profile after authentication; labeled demo identity otherwise                                                    |
| FR-19, FR-21, FR-22, FR-23 | Tag creation, editing, deletion                                                | Name and color customization; deleting a tag preserves tasks                                                          |
| FR-20                      | Column creation, editing, deletion                                             | Name/color/completion flag, display position; deleting a column moves tasks to a destination and preserves one column |
| FR-24                      | Direct task editing in expanded modal                                          | Updates title, description, status, effort, date, tags                                                                |
| FR-25                      | Auth users and public profiles                                                 | Supabase-managed `auth.users` plus owner-scoped profile table                                                         |
| FR-26                      | Completed-task percentage                                                      | Uses configurable completed columns; empty board is zero percent                                                      |
| FR-27                      | Ordering based on deadline and duration                                        | Earliest recommended start first, then greater effort                                                                 |
| FR-28                      | Optional due date                                                              | Date-only field; valid calendar dates checked                                                                         |

The PRD has no FR-08 row.

Remaining-effort totals and recommended-start ordering support the student's workload and prioritization stories. They do not guarantee available free time; a calendar with reserved study time was not specified. Professor expectations inform the product goal but do not define a professor account or dashboard.

## Non-functional requirements

| Requirement                           | Implementation and acceptance status                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Home page renders in under one second | Production bundles and one workspace fetch support the goal; the target requires deployment/device/network measurements and remains unverified |
| Scale for a couple of users           | Per-user indexed PostgreSQL tables, stable paginated API reads, RLS, stateless API; larger datasets would require load testing                 |
| Deploy using Vercel                   | Separate React/Vite and NestJS project configuration documented; live deployment remains pending credentials and project setup                 |

## Verification boundaries

Unit tests cover shared scheduling/completion behavior and application logic. Browser tests exercise local-demo task flows, settings, Markdown, filtering, persistence, and responsive behavior. The disposable PostgreSQL 17 suite executes the actual migration and checks owner isolation, composite reference integrity, RPC transactions, defaults, checks, timestamps, and cascades. Its auth schema is a stand-in. A real Supabase project, Google OAuth callback, and production rendering speed need the integration checks described in [setup](setup.md).
