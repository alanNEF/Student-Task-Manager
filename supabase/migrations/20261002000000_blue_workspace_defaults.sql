-- Recolor only the original named defaults; preserve custom names/colors.
begin;
update public.tags set color = '#2563eb'
where name = 'Class' and color = '#8b5cf6';
update public.board_columns set color = '#2563eb'
where name = 'Done' and is_done and color = '#8b5cf6';

create or replace function public.initialize_student_workspace()
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
         (new.id, 'Done', '#2563eb', 2, true)
  on conflict do nothing;
  insert into public.tags (user_id, name, color)
  values (new.id, 'Class', '#2563eb'),
         (new.id, 'Job Search', '#f59e0b'),
         (new.id, 'Personal', '#14b8a6')
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.initialize_student_workspace() from public, anon, authenticated;

commit;
