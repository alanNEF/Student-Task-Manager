do $$
begin
  if (select color from public.tags where user_id = '33333333-3333-4333-8333-333333333333' and name = 'Class') is distinct from '#2563eb'
     or (select color from public.board_columns where user_id = '33333333-3333-4333-8333-333333333333' and name = 'Done') is distinct from '#2563eb' then
    raise exception 'Existing default colors were not migrated to blue';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = '33333333-3333-4333-8333-333333333333'
      and name = 'Existing Student'
      and email = 'existing@example.com'
  ) then
    raise exception 'Existing auth user was not backfilled into profiles';
  end if;
  if (select count(*) from public.board_columns where user_id = '33333333-3333-4333-8333-333333333333') <> 3
     or (select count(*) from public.tags where user_id = '33333333-3333-4333-8333-333333333333') <> 3 then
    raise exception 'Existing auth user did not receive the default workspace';
  end if;
end;
$$;
