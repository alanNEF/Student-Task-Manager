#!/usr/bin/env bash
set -euo pipefail

# Run database assertions against a disposable local PostgreSQL cluster.
# No existing databases or Supabase projects are accessed.
stm_pg_bin="$(pg_config --bindir)"
stm_db_dir="$(mktemp -d "${TMPDIR:-/tmp}/student-task-manager-db.XXXXXX")"
stm_project_root="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  "$stm_pg_bin/pg_ctl" -D "$stm_db_dir/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$stm_db_dir"
}
trap cleanup EXIT

"$stm_pg_bin/initdb" -D "$stm_db_dir/data" --auth=trust --no-locale -E UTF8 >"$stm_db_dir/init.log"
"$stm_pg_bin/pg_ctl" -D "$stm_db_dir/data" -l "$stm_db_dir/server.log" -o "-k $stm_db_dir -c listen_addresses=''" -w start >/dev/null

stm_psql=("$stm_pg_bin/psql" -X -h "$stm_db_dir" -d postgres -v ON_ERROR_STOP=1)
"${stm_psql[@]}" -f "$stm_project_root/tests/database/auth-harness.sql"
for stm_migration in "$stm_project_root"/supabase/migrations/*.sql; do
  "${stm_psql[@]}" -f "$stm_migration"
done
"${stm_psql[@]}" -f "$stm_project_root/tests/database/backfill.sql"
"${stm_psql[@]}" -f "$stm_project_root/supabase/tests/security.sql"
echo 'Database security and integrity assertions passed.'
