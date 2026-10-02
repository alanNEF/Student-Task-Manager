-- Supabase supplies auth.users and auth.uid(). Client requests use the
-- authenticated role with the student's JWT; no service-role key is required.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  email text not null check (length(email) between 1 and 320),
  avatar_url text check (avatar_url is null or length(avatar_url) <= 2048)
);

create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 50),
  color text not null default '#94a3b8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  position integer not null check (position between 0 and 10000),
  is_done boolean not null default false,
  unique (id, user_id)
);
create unique index board_columns_owner_name on public.board_columns (user_id, lower(btrim(name)));
create index board_columns_owner_position on public.board_columns (user_id, position);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 50),
  color text not null default '#8b5cf6' check (color ~ '^#[0-9a-fA-F]{6}$'),
  unique (id, user_id)
);
create unique index tags_owner_name on public.tags (user_id, lower(btrim(name)));

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 20000),
  status_id uuid not null,
  duration_hours numeric check (duration_hours is null or duration_hours > 0 and duration_hours <= 1000),
  due_date date check (due_date is null or due_date between date '1000-01-01' and date '9999-12-31'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (status_id, user_id) references public.board_columns(id, user_id) on delete restrict
);
create index tasks_owner_status on public.tasks (user_id, status_id);
create index tasks_owner_due_date on public.tasks (user_id, due_date);

create table public.task_tags (
  task_id uuid not null,
  tag_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (task_id, tag_id),
  foreign key (task_id, user_id) references public.tasks(id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags(id, user_id) on delete cascade
);
create index task_tags_owner_task on public.task_tags (user_id, task_id);
create index task_tags_owner_tag on public.task_tags (user_id, tag_id);

alter table public.profiles enable row level security;
alter table public.board_columns enable row level security;
alter table public.tags enable row level security;
alter table public.tasks enable row level security;
alter table public.task_tags enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy columns_own on public.board_columns for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy tags_own on public.tags for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy tasks_own on public.tasks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy task_tags_own on public.task_tags for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Clear Supabase's permissive default grants before granting the intended API.
revoke all on public.profiles, public.board_columns, public.tags, public.tasks, public.task_tags from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name, avatar_url) on public.profiles to authenticated;
grant select, insert, update, delete on public.board_columns, public.tags, public.tasks, public.task_tags to authenticated;

create function public.touch_task_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.touch_task_updated_at();
revoke all on function public.touch_task_updated_at() from public, anon, authenticated;

-- This is the sole security-definer function. It is an auth trigger, cannot be
-- called by clients, and initializes a newly authenticated student's workspace.
create function public.initialize_student_workspace()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), nullif(split_part(new.email, '@', 1), ''), 'Student'), 200),
    coalesce(nullif(new.email, ''), new.id::text || '@unknown.local'),
    left(new.raw_user_meta_data ->> 'avatar_url', 2048)
  ) on conflict (id) do nothing;
  insert into public.board_columns (user_id, name, color, position, is_done)
  values (new.id, 'To-Do', '#94a3b8', 0, false),
         (new.id, 'In-Progress', '#eab308', 1, false),
         (new.id, 'Done', '#8b5cf6', 2, true)
  on conflict do nothing;
  insert into public.tags (user_id, name, color)
  values (new.id, 'Class', '#8b5cf6'),
         (new.id, 'Job Search', '#f59e0b'),
         (new.id, 'Personal', '#14b8a6')
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.initialize_student_workspace() from public, anon, authenticated;
create trigger student_workspace_on_signup after insert on auth.users
  for each row execute function public.initialize_student_workspace();

-- Backfill users created before this migration. Conflict handling makes each
-- insert safe to repeat and preserves any existing profile or custom defaults.
insert into public.profiles (id, name, email, avatar_url)
select id,
  left(coalesce(nullif(btrim(raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(raw_user_meta_data ->> 'name'), ''), nullif(split_part(email, '@', 1), ''), 'Student'), 200),
  coalesce(nullif(email, ''), id::text || '@unknown.local'),
  left(raw_user_meta_data ->> 'avatar_url', 2048)
from auth.users on conflict (id) do nothing;
insert into public.board_columns (user_id, name, color, position, is_done)
select u.id, d.name, d.color, d.position, d.is_done from auth.users u
cross join (values ('To-Do', '#94a3b8', 0, false), ('In-Progress', '#eab308', 1, false), ('Done', '#8b5cf6', 2, true)) d(name, color, position, is_done)
on conflict do nothing;
insert into public.tags (user_id, name, color)
select u.id, d.name, d.color from auth.users u
cross join (values ('Class', '#8b5cf6'), ('Job Search', '#f59e0b'), ('Personal', '#14b8a6')) d(name, color)
on conflict do nothing;

create function public.create_task(
  p_title text,
  p_status_id uuid,
  p_description text default '',
  p_duration_hours numeric default null,
  p_due_date date default null,
  p_tag_ids uuid[] default '{}'
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_task_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.board_columns where id = p_status_id and user_id = v_user_id) then
    raise exception 'Column not found' using errcode = 'P0002';
  end if;
  if p_tag_ids is null or cardinality(p_tag_ids) > 100 or array_position(p_tag_ids, null) is not null then
    raise exception 'Invalid task tags' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_tag_ids) supplied(tag_id) where not exists (
    select 1 from public.tags t where t.id = supplied.tag_id and t.user_id = v_user_id
  )) then
    raise exception 'Tag not found' using errcode = 'P0002';
  end if;
  insert into public.tasks (user_id, title, description, status_id, duration_hours, due_date)
  values (v_user_id, btrim(p_title), p_description, p_status_id, p_duration_hours, p_due_date)
  returning id into v_task_id;
  insert into public.task_tags (task_id, tag_id, user_id)
  select v_task_id, supplied.tag_id, v_user_id from (select distinct unnest(p_tag_ids) as tag_id) supplied;
  return (select (to_jsonb(t) - 'user_id') || jsonb_build_object('tag_ids', coalesce((
    select jsonb_agg(tt.tag_id order by tt.tag_id) from public.task_tags tt where tt.task_id = t.id
  ), '[]'::jsonb)) from public.tasks t where t.id = v_task_id);
end;
$$;

create function public.update_task(p_task_id uuid, p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_tag_ids uuid[];
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' or exists (
    select 1 from jsonb_object_keys(p_patch) supplied(key)
    where supplied.key <> all (array['title', 'description', 'status_id', 'duration_hours', 'due_date', 'tag_ids'])
  ) then
    raise exception 'Invalid task patch' using errcode = '22023';
  end if;
  if (p_patch ? 'title' and jsonb_typeof(p_patch -> 'title') is distinct from 'string')
     or (p_patch ? 'description' and jsonb_typeof(p_patch -> 'description') is distinct from 'string')
     or (p_patch ? 'status_id' and jsonb_typeof(p_patch -> 'status_id') is distinct from 'string')
     or (p_patch ? 'duration_hours' and jsonb_typeof(p_patch -> 'duration_hours') not in ('number', 'null'))
     or (p_patch ? 'due_date' and jsonb_typeof(p_patch -> 'due_date') not in ('string', 'null')) then
    raise exception 'Invalid task field type' using errcode = '22023';
  end if;
  perform 1 from public.tasks where id = p_task_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;
  if p_patch ? 'status_id' and not exists (
    select 1 from public.board_columns where id = (p_patch ->> 'status_id')::uuid and user_id = v_user_id
  ) then
    raise exception 'Column not found' using errcode = 'P0002';
  end if;
  if p_patch ? 'due_date' and p_patch ->> 'due_date' is not null and (p_patch ->> 'due_date') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Invalid due date' using errcode = '22023';
  end if;
  if p_patch ? 'tag_ids' then
    if jsonb_typeof(p_patch -> 'tag_ids') is distinct from 'array' then
      raise exception 'Invalid task tags' using errcode = '22023';
    end if;
    if jsonb_array_length(p_patch -> 'tag_ids') > 100 or exists (
      select 1 from jsonb_array_elements(p_patch -> 'tag_ids') supplied(value)
      where jsonb_typeof(supplied.value) is distinct from 'string'
    ) then
      raise exception 'Invalid task tags' using errcode = '22023';
    end if;
    select coalesce(array_agg(supplied.value::uuid), '{}'::uuid[]) into v_tag_ids
      from jsonb_array_elements_text(p_patch -> 'tag_ids') supplied(value);
    if exists (select 1 from unnest(v_tag_ids) supplied(tag_id) where not exists (
      select 1 from public.tags t where t.id = supplied.tag_id and t.user_id = v_user_id
    )) then
      raise exception 'Tag not found' using errcode = 'P0002';
    end if;
  end if;
  update public.tasks set
    title = case when p_patch ? 'title' then btrim(p_patch ->> 'title') else title end,
    description = case when p_patch ? 'description' then p_patch ->> 'description' else description end,
    status_id = case when p_patch ? 'status_id' then (p_patch ->> 'status_id')::uuid else status_id end,
    duration_hours = case when p_patch ? 'duration_hours' then (p_patch ->> 'duration_hours')::numeric else duration_hours end,
    due_date = case when p_patch ? 'due_date' then (p_patch ->> 'due_date')::date else due_date end
  where id = p_task_id and user_id = v_user_id;
  if p_patch ? 'tag_ids' then
    delete from public.task_tags where task_id = p_task_id and user_id = v_user_id;
    insert into public.task_tags (task_id, tag_id, user_id)
      select p_task_id, supplied.tag_id, v_user_id from (select distinct unnest(v_tag_ids) as tag_id) supplied;
  end if;
  return (select (to_jsonb(t) - 'user_id') || jsonb_build_object('tag_ids', coalesce((
    select jsonb_agg(tt.tag_id order by tt.tag_id) from public.task_tags tt where tt.task_id = t.id
  ), '[]'::jsonb)) from public.tasks t where t.id = p_task_id);
end;
$$;

create function public.delete_board_column(p_column_id uuid, p_move_to uuid default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  -- Serialize column removal for this workspace, including concurrent clients.
  perform 1 from public.profiles where id = v_user_id for update;
  perform 1 from public.board_columns where id = p_column_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Column not found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.board_columns where user_id = v_user_id) <= 1 then
    raise exception 'Keep at least one board column' using errcode = '22023';
  end if;
  if p_move_to is not null then
    if p_move_to = p_column_id then
      raise exception 'Choose a different destination column' using errcode = '22023';
    end if;
    perform 1 from public.board_columns where id = p_move_to and user_id = v_user_id for key share;
    if not found then
      raise exception 'Destination column not found' using errcode = 'P0002';
    end if;
    update public.tasks set status_id = p_move_to where status_id = p_column_id and user_id = v_user_id;
  elsif exists (select 1 from public.tasks where status_id = p_column_id and user_id = v_user_id) then
    raise exception 'Choose a destination for tasks before deleting this column' using errcode = '22023';
  end if;
  delete from public.board_columns where id = p_column_id and user_id = v_user_id;
end;
$$;

revoke all on function public.create_task(text, uuid, text, numeric, date, uuid[]) from public, anon, authenticated;
revoke all on function public.update_task(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.delete_board_column(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_task(text, uuid, text, numeric, date, uuid[]) to authenticated;
grant execute on function public.update_task(uuid, jsonb) to authenticated;
grant execute on function public.delete_board_column(uuid, uuid) to authenticated;

commit;
