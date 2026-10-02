-- A minimal local stand-in for the Supabase-owned Auth schema.
-- Used only in a disposable PostgreSQL cluster by npm run test:db.
create schema auth;
create role anon nologin;
create role authenticated nologin;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- The migration must initialize students who signed up before it was applied.
insert into auth.users (id, email, raw_user_meta_data)
values ('33333333-3333-4333-8333-333333333333', 'existing@example.com', '{"full_name":"Existing Student"}');
