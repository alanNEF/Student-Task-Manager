export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

export interface BoardColumn {
  id: string;
  name: string;
  color: string;
  position: number;
  is_done: boolean;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status_id: string;
  duration_hours: number | null;
  due_date: string | null;
  tag_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  profile: Profile;
  columns: BoardColumn[];
  tags: Tag[];
  tasks: Task[];
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status_id: string;
  duration_hours?: number | null;
  due_date?: string | null;
  tag_ids?: string[];
}

export type UpdateTaskInput = Partial<CreateTaskInput>;
export interface CreateTagInput {
  name: string;
  color: string;
}
export type UpdateTagInput = Partial<CreateTagInput>;
export interface CreateColumnInput {
  name: string;
  color: string;
  position: number;
  is_done?: boolean;
}
export type UpdateColumnInput = Partial<CreateColumnInput>;
export type TaskPriority = 'overdue' | 'urgent' | 'upcoming' | 'none';

export const DEFAULT_TAGS = [
  { name: 'Class', color: '#2563eb' },
  { name: 'Job Search', color: '#f59e0b' },
  { name: 'Personal', color: '#14b8a6' },
] as const;

export const DEFAULT_COLUMNS = [
  { name: 'To-Do', color: '#94a3b8', position: 0, is_done: false },
  { name: 'In-Progress', color: '#eab308', position: 1, is_done: false },
  { name: 'Done', color: '#2563eb', position: 2, is_done: true },
] as const;

// A date-only deadline ends in the student's local timezone.
export function dueDateEnd(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

export function recommendedStart(
  task: Pick<Task, 'due_date' | 'duration_hours'>,
): number {
  return task.due_date
    ? dueDateEnd(task.due_date) - (task.duration_hours ?? 0) * 3_600_000
    : Infinity;
}

export function getTaskPriority(
  task: Pick<Task, 'due_date' | 'duration_hours'>,
  now = Date.now(),
): TaskPriority {
  if (!task.due_date) return 'none';
  if (dueDateEnd(task.due_date) < now) return 'overdue';
  if (recommendedStart(task) <= now + 86_400_000) return 'urgent';
  return dueDateEnd(task.due_date) <= now + 7 * 86_400_000
    ? 'upcoming'
    : 'none';
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const first = recommendedStart(a);
    const second = recommendedStart(b);
    if (first !== second) return first < second ? -1 : 1;
    const duration = (b.duration_hours ?? 0) - (a.duration_hours ?? 0);
    return (
      duration ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id)
    );
  });
}

export function completionPercentage(
  tasks: Task[],
  columns: BoardColumn[],
): number {
  if (!tasks.length) return 0;
  const done = new Set(
    columns.filter((column) => column.is_done).map((column) => column.id),
  );
  return Math.round(
    (tasks.filter((task) => done.has(task.status_id)).length / tasks.length) *
      100,
  );
}

export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return (
    year >= 1000 &&
    year <= 9999 &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}
