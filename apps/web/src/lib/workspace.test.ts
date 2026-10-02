import { afterEach, describe, expect, it, vi } from 'vitest';
import { completionPercentage } from '@student-task-manager/shared';
import {
  createDemoWorkspace,
  loadDemoWorkspace,
  mutateWorkspace,
  persistDemoWorkspace,
  relativeDate,
  workload,
} from './workspace';

afterEach(() => vi.unstubAllGlobals());

describe('student workspace', () => {
  it('recolors saved demo defaults while preserving custom colors and tasks', () => {
    const demo = createDemoWorkspace();
    demo.tags[0].color = '#8b5cf6';
    demo.columns[2].color = '#8b5cf6';
    demo.tags[1].color = '#8b5cf6';
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(demo) });
    const restored = loadDemoWorkspace();
    expect(restored.tags[0].color).toBe('#2563eb');
    expect(restored.columns[2].color).toBe('#2563eb');
    expect(restored.tags[1].color).toBe('#8b5cf6');
    expect(restored.tasks).toEqual(demo.tasks);
  });
  it('seeds the complete default workflow with dates relative to the student’s local day', () => {
    const now = new Date(2026, 9, 1, 12);
    const demo = createDemoWorkspace(now);
    expect(demo.columns.map((column) => column.name)).toEqual([
      'To-Do',
      'In-Progress',
      'Done',
    ]);
    expect(demo.tags.map((tag) => tag.name)).toEqual([
      'Class',
      'Job Search',
      'Personal',
    ]);
    expect(demo.tasks[0].due_date).toBe('2026-10-02');
    expect(relativeDate(1, new Date(2026, 11, 31))).toBe('2027-01-01');
    expect(completionPercentage(demo.tasks, demo.columns)).toBe(25);
  });

  it('supports task editing, null optional fields, tag removal, and deletion without losing other tasks', () => {
    const original = createDemoWorkspace();
    const created = mutateWorkspace(original, {
      kind: 'createTask',
      input: {
        title: 'Read paper',
        status_id: original.columns[0].id,
        duration_hours: 2,
        due_date: '2026-10-10',
        tag_ids: [original.tags[0].id],
      },
    });
    const task = created.tasks.at(-1)!;
    const edited = mutateWorkspace(created, {
      kind: 'updateTask',
      id: task.id,
      input: {
        title: 'Read and annotate',
        duration_hours: null,
        due_date: null,
      },
    });
    expect(edited.tasks.at(-1)).toMatchObject({
      title: 'Read and annotate',
      duration_hours: null,
      due_date: null,
    });
    const removedTag = mutateWorkspace(edited, {
      kind: 'deleteTag',
      id: original.tags[0].id,
    });
    expect(removedTag.tasks).toHaveLength(original.tasks.length + 1);
    expect(
      removedTag.tasks.every(
        (item) => !item.tag_ids.includes(original.tags[0].id),
      ),
    ).toBe(true);
    const deleted = mutateWorkspace(removedTag, {
      kind: 'deleteTask',
      id: task.id,
    });
    expect(deleted.tasks).toHaveLength(original.tasks.length);
    expect(original.tasks).toHaveLength(8);
  });

  it('moves all tasks when deleting a column and counts the destination’s completion meaning', () => {
    const original = createDemoWorkspace();
    const moved = mutateWorkspace(original, {
      kind: 'deleteColumn',
      id: original.columns[0].id,
      moveTo: original.columns[2].id,
    });
    expect(moved.tasks).toHaveLength(original.tasks.length);
    expect(
      moved.tasks.every((task) => task.status_id !== original.columns[0].id),
    ).toBe(true);
    expect(completionPercentage(moved.tasks, moved.columns)).toBe(75);
    const toggled = mutateWorkspace(moved, {
      kind: 'updateColumn',
      id: original.columns[2].id,
      input: { is_done: false },
    });
    expect(completionPercentage(toggled.tasks, toggled.columns)).toBe(0);
    expect(() =>
      mutateWorkspace(original, {
        kind: 'deleteColumn',
        id: original.columns[0].id,
        moveTo: original.columns[0].id,
      }),
    ).toThrow('Choose another column');
  });

  it('includes only outstanding effort and future week deadlines in workload estimates', () => {
    const now = new Date(2026, 9, 1, 12);
    const demo = createDemoWorkspace(now);
    const summary = workload(demo, now.getTime());
    expect(summary.totalHours).toBe(17);
    expect(summary.weekHours).toBe(16.5);
    expect(summary.dueSoon).toHaveLength(5);
    const overdue = mutateWorkspace(demo, {
      kind: 'updateTask',
      id: demo.tasks[0].id,
      input: { due_date: '2026-09-30', duration_hours: null },
    });
    expect(workload(overdue, now.getTime())).toMatchObject({
      totalHours: 14,
      overdue: 1,
      unestimated: 1,
    });
  });

  it('persists and restores browser demo changes and recovers malformed local data', () => {
    let saved: string | null = null;
    vi.stubGlobal('localStorage', {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value;
      },
    });
    const demo = createDemoWorkspace();
    const changed = mutateWorkspace(demo, {
      kind: 'updateTag',
      id: demo.tags[0].id,
      input: { name: 'Seminar' },
    });
    persistDemoWorkspace(changed);
    expect(loadDemoWorkspace()).toEqual(changed);
    saved = '{ broken';
    expect(loadDemoWorkspace().tasks).toHaveLength(8);
    saved = JSON.stringify({ ...demo, columns: [] });
    expect(loadDemoWorkspace().columns).toHaveLength(3);
  });
});
