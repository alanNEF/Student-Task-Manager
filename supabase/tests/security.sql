-- Run only against a local/disposable Supabase database:
-- psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
--   -v ON_ERROR_STOP=1 -f supabase/tests/security.sql
-- All fixtures are rolled back. Any failed assertion stops the test.
\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void language plpgsql security invoker as $$
begin
  if p_condition is distinct from true then
    raise exception 'Assertion failed: %', p_message;
  end if;
end;
$$;
create function pg_temp.assert_rejected(p_sql text, p_states text[], p_message text)
returns void language plpgsql security invoker as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = any(p_states) then
      return;
    end if;
    raise exception 'Wrong failure for %: % (%)', p_message, sqlerrm, sqlstate;
  end;
  raise exception 'Expected rejection: %', p_message;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-4111-8111-111111111111', 'student-a@example.test', '{"full_name":"Student A"}'),
       ('22222222-2222-4222-8222-222222222222', 'student-b@example.test', '{"name":"Student B"}');
select pg_temp.assert_true((select count(*) = 2 from public.profiles where id in (
  '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'
)), 'signup creates both profiles');
select pg_temp.assert_true((select count(*) = 3 from public.board_columns where user_id = '11111111-1111-4111-8111-111111111111'), 'signup creates default columns');
select pg_temp.assert_true((select count(*) = 3 from public.tags where user_id = '11111111-1111-4111-8111-111111111111'), 'signup creates default tags');
select pg_temp.assert_true((select is_done from public.board_columns where user_id = '11111111-1111-4111-8111-111111111111' and name = 'Done'), 'default Done column counts completion');

select set_config('test.a_column', (select id::text from public.board_columns where user_id = '11111111-1111-4111-8111-111111111111' and name = 'To-Do'), true);
select set_config('test.a_done', (select id::text from public.board_columns where user_id = '11111111-1111-4111-8111-111111111111' and name = 'Done'), true);
select set_config('test.a_tag', (select id::text from public.tags where user_id = '11111111-1111-4111-8111-111111111111' and name = 'Class'), true);
select set_config('test.b_column', (select id::text from public.board_columns where user_id = '22222222-2222-4222-8222-222222222222' and name = 'To-Do'), true);
select set_config('test.b_tag', (select id::text from public.tags where user_id = '22222222-2222-4222-8222-222222222222' and name = 'Class'), true);
insert into public.tasks (id, user_id, title, status_id)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'B private task', current_setting('test.b_column')::uuid);
insert into public.task_tags (task_id, tag_id, user_id)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_setting('test.b_tag')::uuid, '22222222-2222-4222-8222-222222222222');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select pg_temp.assert_true((select count(*) = 1 from public.profiles), 'profile SELECT isolates users');
select pg_temp.assert_true((select count(*) = 3 from public.board_columns), 'column SELECT isolates users');
select pg_temp.assert_true((select count(*) = 3 from public.tags), 'tag SELECT isolates users');
select pg_temp.assert_true((select count(*) = 0 from public.tasks), 'task SELECT hides another user');
select pg_temp.assert_true((select count(*) = 0 from public.task_tags), 'task-tag SELECT hides another user');
select pg_temp.assert_true((select count(*) = 0 from public.profiles where id = '22222222-2222-4222-8222-222222222222'), 'other profile is invisible');

select pg_temp.assert_rejected(format(
  'insert into public.board_columns (user_id,name,position) values (%L,''Intrusion'',4)',
  '22222222-2222-4222-8222-222222222222'
), array['42501'], 'cannot insert another user column');
select pg_temp.assert_rejected(format(
  'insert into public.tags (user_id,name) values (%L,''Intrusion'')',
  '22222222-2222-4222-8222-222222222222'
), array['42501'], 'cannot insert another user tag');
select pg_temp.assert_rejected(format(
  'insert into public.tasks (user_id,title,status_id) values (%L,''Intrusion'',%L)',
  '22222222-2222-4222-8222-222222222222', current_setting('test.b_column')
), array['42501'], 'cannot insert another user task');
select pg_temp.assert_rejected(format(
  'insert into public.tasks (title,status_id) values (''Invalid owner column'',%L)', current_setting('test.b_column')
), array['23503'], 'composite FK prevents own task using foreign column');
select pg_temp.assert_rejected(format(
  'select public.create_task(''Invalid foreign tag'',%L,p_tag_ids => array[%L::uuid])', current_setting('test.a_column'), current_setting('test.b_tag')
), array['P0002'], 'create RPC rejects foreign tag');
select pg_temp.assert_rejected(format(
  'select public.create_task(''Invalid foreign column'',%L)', current_setting('test.b_column')
), array['P0002'], 'create RPC rejects foreign column');
select pg_temp.assert_true((select count(*) = 0 from public.tasks), 'failed create leaves no partial task');

select set_config('test.a_task', public.create_task(
  '  A task  ', current_setting('test.a_column')::uuid, '**Markdown** description',
  2.5, date '2030-10-01', array[current_setting('test.a_tag')::uuid, current_setting('test.a_tag')::uuid]
) ->> 'id', true);
select pg_temp.assert_true((select title = 'A task' and duration_hours = 2.5 and due_date = date '2030-10-01' from public.tasks where id = current_setting('test.a_task')::uuid), 'create RPC saves validated fields');
select pg_temp.assert_true((select count(*) = 1 from public.task_tags), 'create RPC deduplicates tags');
select set_config('test.previous_updated_at', (select updated_at::text from public.tasks where id = current_setting('test.a_task')::uuid), true);

select pg_temp.assert_rejected(format(
  'select public.update_task(%L, %L::jsonb)', current_setting('test.a_task'),
  jsonb_build_object('title','Should roll back','tag_ids',jsonb_build_array(current_setting('test.b_tag')))::text
), array['P0002'], 'update RPC rejects foreign tag atomically');
select pg_temp.assert_true((select title = 'A task' from public.tasks where id = current_setting('test.a_task')::uuid), 'invalid update preserves original title');
select pg_temp.assert_true((select count(*) = 1 from public.task_tags where task_id = current_setting('test.a_task')::uuid and tag_id = current_setting('test.a_tag')::uuid), 'invalid update preserves original links');
select pg_temp.assert_rejected(format(
  'select public.update_task(%L, %L::jsonb)', current_setting('test.a_task'), '{"user_id":"22222222-2222-4222-8222-222222222222"}'
), array['22023'], 'RPC cannot change task ownership');
select pg_temp.assert_rejected(format(
  'update public.tasks set user_id = %L where id = %L', '22222222-2222-4222-8222-222222222222', current_setting('test.a_task')
), array['42501', '23503'], 'direct writes cannot transfer task ownership');
select pg_temp.assert_rejected(format(
  'insert into public.task_tags (task_id,tag_id,user_id) values (%L,%L,%L)',
  current_setting('test.a_task'), current_setting('test.b_tag'), '11111111-1111-4111-8111-111111111111'
), array['23503'], 'composite FK prevents foreign tag link');
select pg_temp.assert_rejected(format(
  'insert into public.task_tags (task_id,tag_id,user_id) values (%L,%L,%L)',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_setting('test.a_tag'), '11111111-1111-4111-8111-111111111111'
), array['23503'], 'composite FK prevents foreign task link');

select public.update_task(current_setting('test.a_task')::uuid, '{"title":"Edited","duration_hours":null,"due_date":null,"tag_ids":[]}');
select pg_temp.assert_true((select title = 'Edited' and duration_hours is null and due_date is null and updated_at > current_setting('test.previous_updated_at')::timestamptz from public.tasks where id = current_setting('test.a_task')::uuid), 'update supports clearing optional fields and advances timestamp');
select pg_temp.assert_true((select count(*) = 0 from public.task_tags), 'update clears tag links');
select public.update_task(current_setting('test.a_task')::uuid, jsonb_build_object('tag_ids',jsonb_build_array(current_setting('test.a_tag'))));
delete from public.tags where id = current_setting('test.a_tag')::uuid;
select pg_temp.assert_true((select count(*) = 0 from public.task_tags), 'deleting tag cascades links');
select pg_temp.assert_true((select count(*) = 1 from public.tasks), 'deleting tag preserves task');

select pg_temp.assert_rejected(format(
  'select public.create_task('' '', %L)', current_setting('test.a_column')
), array['23514'], 'blank title rejected');
select pg_temp.assert_rejected(format(
  'select public.create_task(''Negative hours'', %L, p_duration_hours => -1)', current_setting('test.a_column')
), array['23514'], 'negative duration rejected');
select pg_temp.assert_rejected(format(
  'select public.create_task(''Too many hours'', %L, p_duration_hours => 1001)', current_setting('test.a_column')
), array['23514'], 'duration upper bound enforced');
select pg_temp.assert_rejected(format(
  'select public.update_task(%L, %L::jsonb)', current_setting('test.a_task'), '{"due_date":"2030-02-31"}'
), array['22008'], 'invalid calendar date rejected');
select pg_temp.assert_rejected('insert into public.tags (name,color) values (''Bad color'',''red'')', array['23514'], 'color format enforced');
select pg_temp.assert_rejected('insert into public.board_columns (name,position) values (''Bad position'',-1)', array['23514'], 'column position bounds enforced');

select pg_temp.assert_rejected(format(
  'select public.delete_board_column(%L)', current_setting('test.a_column')
), array['22023'], 'nonempty column requires destination');
select pg_temp.assert_rejected(format(
  'select public.delete_board_column(%L,%L)', current_setting('test.a_column'), current_setting('test.b_column')
), array['P0002'], 'column move rejects foreign destination');
select pg_temp.assert_true((select status_id = current_setting('test.a_column')::uuid from public.tasks where id = current_setting('test.a_task')::uuid), 'failed column move preserves task status');
select public.delete_board_column(current_setting('test.a_column')::uuid, current_setting('test.a_done')::uuid);
select pg_temp.assert_true((select status_id = current_setting('test.a_done')::uuid from public.tasks where id = current_setting('test.a_task')::uuid), 'column deletion moves tasks');
select pg_temp.assert_true((select count(*) = 0 from public.board_columns where id = current_setting('test.a_column')::uuid), 'column deletion removes source');
select public.delete_board_column((select id from public.board_columns where name = 'In-Progress'), current_setting('test.a_done')::uuid);
select pg_temp.assert_rejected(format(
  'select public.delete_board_column(%L)', current_setting('test.a_done')
), array['22023'], 'RPC preserves last board column');

update public.tasks set title = 'Forbidden' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
delete from public.tasks where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
update public.tags set name = 'Forbidden' where id = current_setting('test.b_tag')::uuid;
delete from public.board_columns where id = current_setting('test.b_column')::uuid;
update public.profiles set name = 'Forbidden' where id = '22222222-2222-4222-8222-222222222222';

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select pg_temp.assert_true((select count(*) = 1 and min(title) = 'B private task' from public.tasks), 'foreign update and delete changed nothing');
select pg_temp.assert_true((select name = 'Class' from public.tags where id = current_setting('test.b_tag')::uuid), 'foreign tag update changed nothing');
select pg_temp.assert_true((select count(*) = 3 from public.board_columns), 'foreign column delete changed nothing');
select pg_temp.assert_true((select name = 'Student B' from public.profiles), 'foreign profile update changed nothing');
select pg_temp.assert_rejected(format(
  'select public.update_task(%L, %L::jsonb)', current_setting('test.a_task'), '{"title":"Forbidden"}'
), array['P0002'], 'update RPC cannot access foreign task');
delete from public.tasks where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select pg_temp.assert_true((select count(*) = 0 from public.task_tags), 'deleting task cascades links');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.assert_rejected('select * from public.profiles', array['42501'], 'anonymous profiles denied');
select pg_temp.assert_rejected('select * from public.tasks', array['42501'], 'anonymous task reads denied');
select pg_temp.assert_rejected(format('select public.create_task(''Anonymous'',%L)', current_setting('test.a_done')), array['42501'], 'anonymous RPC denied');
select pg_temp.assert_rejected('select public.initialize_student_workspace()', array['42501', '0A000'], 'signup initializer cannot be called by client');

reset role;
delete from auth.users where id = '11111111-1111-4111-8111-111111111111';
select pg_temp.assert_true((select count(*) = 0 from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 'account deletion cascades profile');
select pg_temp.assert_true((select count(*) = 0 from public.tasks where user_id = '11111111-1111-4111-8111-111111111111'), 'account deletion cascades tasks');
select pg_temp.assert_true((select count(*) = 0 from public.tags where user_id = '11111111-1111-4111-8111-111111111111'), 'account deletion cascades tags');
select pg_temp.assert_true((select count(*) = 0 from public.board_columns where user_id = '11111111-1111-4111-8111-111111111111'), 'account deletion cascades columns');

rollback;
\echo 'Database security and integrity assertions passed; fixtures rolled back.'
