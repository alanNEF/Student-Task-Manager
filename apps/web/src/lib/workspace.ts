import {
  DEFAULT_COLUMNS,
  DEFAULT_TAGS,
  dueDateEnd,
  type Workspace,
  type CreateTaskInput,
  type UpdateTaskInput,
  type CreateTagInput,
  type UpdateTagInput,
  type CreateColumnInput,
  type UpdateColumnInput,
} from '@student-task-manager/shared';

const STORAGE_KEY = 'student-task-manager.demo.v1';

export function relativeDate(days: number, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function createDemoWorkspace(now = new Date()): Workspace {
  const columns = DEFAULT_COLUMNS.map((column) => ({
    ...column,
    id: crypto.randomUUID(),
  }));
  const tags = DEFAULT_TAGS.map((tag) => ({ ...tag, id: crypto.randomUUID() }));
  const stamp = now.toISOString();
  const samples: Array<{
    title: string;
    description: string;
    column: number;
    hours: number;
    days: number;
    tag: number;
  }> = [
    {
      title: 'Finish the calculus problem set',
      description:
        '## Before you submit\n- Complete exercises 4–12\n- Double-check the integration steps\n- Upload a PDF to the class portal',
      column: 0,
      hours: 3,
      days: 1,
      tag: 0,
    },
    {
      title: 'Prepare for the biology midterm',
      description:
        'Review chapters 5–8. Focus on **cellular respiration** and make a one-page study guide.',
      column: 0,
      hours: 6,
      days: 5,
      tag: 0,
    },
    {
      title: 'Apply to the summer design internship',
      description:
        'Tailor the cover letter, polish the portfolio, and send the application.',
      column: 0,
      hours: 2,
      days: 4,
      tag: 1,
    },
    {
      title: 'Draft the literature essay',
      description:
        '## Essay outline\nConnect the two readings around the theme of belonging. Aim for 1,500 words.\n\nStart with a clear thesis, then select three passages to discuss.',
      column: 1,
      hours: 4,
      days: 3,
      tag: 0,
    },
    {
      title: 'Update my résumé',
      description:
        'Add the research assistant role and this semester’s projects.',
      column: 1,
      hours: 1.5,
      days: 2,
      tag: 1,
    },
    {
      title: 'Plan a weekend hike',
      description: 'Pick a trail and check with friends.',
      column: 0,
      hours: 0.5,
      days: 9,
      tag: 2,
    },
    {
      title: 'Submit the chemistry lab report',
      description: 'Report submitted. Data tables and references included.',
      column: 2,
      hours: 2,
      days: -1,
      tag: 0,
    },
    {
      title: 'Book the advising appointment',
      description: 'Appointment confirmed for next week.',
      column: 2,
      hours: 0.5,
      days: -2,
      tag: 2,
    },
  ];
  return {
    profile: {
      id: 'demo-student',
      name: 'Alex Morgan',
      email: 'alex@example.com',
      avatar_url: null,
    },
    columns,
    tags,
    tasks: samples.map((sample) => ({
      id: crypto.randomUUID(),
      title: sample.title,
      description: sample.description,
      status_id: columns[sample.column].id,
      duration_hours: sample.hours,
      due_date: relativeDate(sample.days, now),
      tag_ids: [tags[sample.tag].id],
      created_at: stamp,
      updated_at: stamp,
    })),
  };
}

export function loadDemoWorkspace(): Workspace {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const value = JSON.parse(saved) as Workspace;
      if (
        value.profile &&
        Array.isArray(value.columns) &&
        value.columns.length &&
        Array.isArray(value.tags) &&
        Array.isArray(value.tasks) &&
        value.columns.every(
          (column) =>
            typeof column.id === 'string' &&
            typeof column.name === 'string' &&
            typeof column.is_done === 'boolean',
        ) &&
        value.tags.every(
          (tag) => typeof tag.id === 'string' && typeof tag.name === 'string',
        ) &&
        value.tasks.every(
          (task) =>
            typeof task.id === 'string' &&
            typeof task.title === 'string' &&
            typeof task.description === 'string' &&
            Array.isArray(task.tag_ids) &&
            value.columns.some((column) => column.id === task.status_id),
        )
      )
        return {
          ...value,
          tags: value.tags.map((tag) =>
            tag.name === 'Class' && tag.color === '#8b5cf6'
              ? { ...tag, color: '#2563eb' }
              : tag,
          ),
          columns: value.columns.map((column) =>
            column.name === 'Done' &&
            column.is_done &&
            column.color === '#8b5cf6'
              ? { ...column, color: '#2563eb' }
              : column,
          ),
        };
    }
  } catch {
    /* An unavailable or malformed browser store should not stop the local demo. */
  }
  return createDemoWorkspace();
}

export function persistDemoWorkspace(workspace: Workspace): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

export function workload(workspace: Workspace, now = Date.now()) {
  const doneIds = new Set(
    workspace.columns
      .filter((column) => column.is_done)
      .map((column) => column.id),
  );
  const outstanding = workspace.tasks.filter(
    (task) => !doneIds.has(task.status_id),
  );
  const dueSoon = outstanding.filter(
    (task) =>
      task.due_date &&
      dueDateEnd(task.due_date) >= now &&
      dueDateEnd(task.due_date) <= now + 7 * 86_400_000,
  );
  return {
    outstanding,
    dueSoon,
    totalHours: outstanding.reduce(
      (total, task) => total + (task.duration_hours ?? 0),
      0,
    ),
    weekHours: dueSoon.reduce(
      (total, task) => total + (task.duration_hours ?? 0),
      0,
    ),
    unestimated: outstanding.filter((task) => task.duration_hours === null)
      .length,
    overdue: outstanding.filter(
      (task) => task.due_date && dueDateEnd(task.due_date) < now,
    ).length,
  };
}

export type Mutation =
  | { kind: 'createTask'; input: CreateTaskInput }
  | { kind: 'updateTask'; id: string; input: UpdateTaskInput }
  | { kind: 'deleteTask'; id: string }
  | { kind: 'createTag'; input: CreateTagInput }
  | { kind: 'updateTag'; id: string; input: UpdateTagInput }
  | { kind: 'deleteTag'; id: string }
  | { kind: 'createColumn'; input: CreateColumnInput }
  | { kind: 'updateColumn'; id: string; input: UpdateColumnInput }
  | { kind: 'deleteColumn'; id: string; moveTo: string };

export function mutateWorkspace(
  workspace: Workspace,
  mutation: Mutation,
): Workspace {
  const stamp = new Date().toISOString();
  switch (mutation.kind) {
    case 'createTask':
      return {
        ...workspace,
        tasks: [
          ...workspace.tasks,
          {
            id: crypto.randomUUID(),
            title: mutation.input.title,
            description: mutation.input.description ?? '',
            status_id: mutation.input.status_id,
            duration_hours: mutation.input.duration_hours ?? null,
            due_date: mutation.input.due_date ?? null,
            tag_ids: mutation.input.tag_ids ?? [],
            created_at: stamp,
            updated_at: stamp,
          },
        ],
      };
    case 'updateTask':
      return {
        ...workspace,
        tasks: workspace.tasks.map((task) =>
          task.id === mutation.id
            ? { ...task, ...mutation.input, updated_at: stamp }
            : task,
        ),
      };
    case 'deleteTask':
      return {
        ...workspace,
        tasks: workspace.tasks.filter((task) => task.id !== mutation.id),
      };
    case 'createTag':
      return {
        ...workspace,
        tags: [
          ...workspace.tags,
          { id: crypto.randomUUID(), ...mutation.input },
        ],
      };
    case 'updateTag':
      return {
        ...workspace,
        tags: workspace.tags.map((tag) =>
          tag.id === mutation.id ? { ...tag, ...mutation.input } : tag,
        ),
      };
    case 'deleteTag':
      return {
        ...workspace,
        tags: workspace.tags.filter((tag) => tag.id !== mutation.id),
        tasks: workspace.tasks.map((task) => ({
          ...task,
          tag_ids: task.tag_ids.filter((id) => id !== mutation.id),
        })),
      };
    case 'createColumn':
      return {
        ...workspace,
        columns: [
          ...workspace.columns,
          {
            id: crypto.randomUUID(),
            ...mutation.input,
            is_done: mutation.input.is_done ?? false,
          },
        ],
      };
    case 'updateColumn':
      return {
        ...workspace,
        columns: workspace.columns.map((column) =>
          column.id === mutation.id ? { ...column, ...mutation.input } : column,
        ),
      };
    case 'deleteColumn': {
      if (workspace.columns.length <= 1)
        throw new Error('Keep at least one board column.');
      if (
        !workspace.columns.some(
          (column) =>
            column.id === mutation.moveTo && column.id !== mutation.id,
        )
      )
        throw new Error('Choose another column for the tasks.');
      return {
        ...workspace,
        columns: workspace.columns.filter(
          (column) => column.id !== mutation.id,
        ),
        tasks: workspace.tasks.map((task) =>
          task.status_id === mutation.id
            ? { ...task, status_id: mutation.moveTo, updated_at: stamp }
            : task,
        ),
      };
    }
  }
}
