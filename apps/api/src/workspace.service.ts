import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BoardColumn,
  CreateColumnInput,
  CreateTagInput,
  CreateTaskInput,
  Profile,
  Tag,
  Task,
  UpdateColumnInput,
  UpdateTagInput,
  UpdateTaskInput,
  Workspace,
} from '@student-task-manager/shared';
import { throwDatabaseError } from './database-error';
import type { AuthSession } from './supabase.service';

const COLUMN_FIELDS = 'id,name,color,position,is_done';
const TAG_FIELDS = 'id,name,color';
const TASK_FIELDS =
  'id,title,description,status_id,duration_hours,due_date,created_at,updated_at,task_tags(tag_id)';
type TaskRow = Omit<Task, 'tag_ids'> & { task_tags: { tag_id: string }[] };
const PAGE_SIZE = 1000;

async function allRows<T>(
  loadPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: { code?: string } | null }>,
  resource: string,
): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await loadPage(offset, offset + PAGE_SIZE - 1);
    throwDatabaseError(error, resource);
    const page = (data ?? []) as T[];
    result.push(...page);
    if (page.length < PAGE_SIZE) return result;
  }
}

function taskFromRow(row: TaskRow): Task {
  const { task_tags, ...task } = row;
  return { ...task, tag_ids: task_tags.map((link) => link.tag_id) };
}

@Injectable()
export class WorkspaceService {
  async workspace(session: AuthSession): Promise<Workspace> {
    const { client, user } = session;
    const [profile, columns, tags, tasks] = await Promise.all([
      client
        .from('profiles')
        .select('id,name,email,avatar_url')
        .eq('id', user.id)
        .single(),
      allRows<BoardColumn>(
        (from, to) =>
          client
            .from('board_columns')
            .select(COLUMN_FIELDS)
            .eq('user_id', user.id)
            .order('position')
            .order('id')
            .range(from, to),
        'Columns',
      ),
      allRows<Tag>(
        (from, to) =>
          client
            .from('tags')
            .select(TAG_FIELDS)
            .eq('user_id', user.id)
            .order('name')
            .order('id')
            .range(from, to),
        'Tags',
      ),
      allRows<TaskRow>(
        (from, to) =>
          client
            .from('tasks')
            .select(TASK_FIELDS)
            .eq('user_id', user.id)
            .order('created_at')
            .order('id')
            .range(from, to),
        'Tasks',
      ),
    ]);
    throwDatabaseError(profile.error, 'Profile');
    return {
      profile: profile.data as Profile,
      columns,
      tags,
      tasks: tasks.map(taskFromRow),
    };
  }

  async createTask(
    session: AuthSession,
    input: CreateTaskInput,
  ): Promise<Task> {
    const { data, error } = await session.client.rpc('create_task', {
      p_title: input.title,
      p_status_id: input.status_id,
      p_description: input.description ?? '',
      p_duration_hours: input.duration_hours ?? null,
      p_due_date: input.due_date ?? null,
      p_tag_ids: input.tag_ids ?? [],
    });
    throwDatabaseError(error, 'Task');
    return data as Task;
  }

  async updateTask(
    session: AuthSession,
    id: string,
    input: UpdateTaskInput,
  ): Promise<Task> {
    // The RPC uses JSON key presence to preserve omitted fields and clear explicit nulls.
    const { data, error } = await session.client.rpc('update_task', {
      p_task_id: id,
      p_patch: input,
    });
    throwDatabaseError(error, 'Task');
    return data as Task;
  }

  async deleteTask(session: AuthSession, id: string): Promise<void> {
    const { data, error } = await session.client
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('id');
    throwDatabaseError(error, 'Task');
    if (!data?.length) throw new NotFoundException('Task was not found.');
  }

  async createTag(session: AuthSession, input: CreateTagInput): Promise<Tag> {
    const { data, error } = await session.client
      .from('tags')
      .insert({ ...input, user_id: session.user.id })
      .select(TAG_FIELDS)
      .single();
    throwDatabaseError(error, 'Tag');
    return data as Tag;
  }

  async updateTag(
    session: AuthSession,
    id: string,
    input: UpdateTagInput,
  ): Promise<Tag> {
    const { data, error } = await session.client
      .from('tags')
      .update(input)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select(TAG_FIELDS)
      .single();
    throwDatabaseError(error, 'Tag');
    return data as Tag;
  }

  async deleteTag(session: AuthSession, id: string): Promise<void> {
    const { data, error } = await session.client
      .from('tags')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('id');
    throwDatabaseError(error, 'Tag');
    if (!data?.length) throw new NotFoundException('Tag was not found.');
  }

  async createColumn(
    session: AuthSession,
    input: CreateColumnInput,
  ): Promise<BoardColumn> {
    const { data, error } = await session.client
      .from('board_columns')
      .insert({
        ...input,
        is_done: input.is_done ?? false,
        user_id: session.user.id,
      })
      .select(COLUMN_FIELDS)
      .single();
    throwDatabaseError(error, 'Column');
    return data as BoardColumn;
  }

  async updateColumn(
    session: AuthSession,
    id: string,
    input: UpdateColumnInput,
  ): Promise<BoardColumn> {
    const { data, error } = await session.client
      .from('board_columns')
      .update(input)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select(COLUMN_FIELDS)
      .single();
    throwDatabaseError(error, 'Column');
    return data as BoardColumn;
  }

  async deleteColumn(
    session: AuthSession,
    id: string,
    moveTo: string,
  ): Promise<void> {
    // Moving the tasks and deleting the column happen in one database transaction.
    const { error } = await session.client.rpc('delete_board_column', {
      p_column_id: id,
      p_move_to: moveTo,
    });
    throwDatabaseError(error, 'Column');
  }
}
