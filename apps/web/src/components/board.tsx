import { useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CalendarDays,
  Check,
  Circle,
  Clock3,
  GripVertical,
  Plus,
} from 'lucide-react';
import {
  getTaskPriority,
  sortTasks,
  type BoardColumn,
  type Task,
  type Workspace,
} from '@student-task-manager/shared';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { relativeDate } from '@/lib/workspace';

function formatDue(date: string) {
  if (date === relativeDate(0)) return 'Today';
  if (date === relativeDate(1)) return 'Tomorrow';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(year !== new Date().getFullYear() ? { year: 'numeric' as const } : {}),
  });
}

function CardContents({
  task,
  workspace,
  done,
}: {
  task: Task;
  workspace: Workspace;
  done: boolean;
}) {
  const priority = done ? 'none' : getTaskPriority(task);
  const tags = workspace.tags.filter((tag) => task.tag_ids.includes(tag.id));
  return (
    <>
      <div className="card-title-row">
        <span className={cn('task-state', done && 'task-state-done')}>
          {done ? <Check size={12} /> : <Circle size={12} />}
        </span>
        <h3>{task.title}</h3>
      </div>
      {tags.length > 0 && (
        <div className="card-tags">
          {tags.map((tag) => (
            <span className="task-tag" key={tag.id}>
              <span className="color-dot" style={{ background: tag.color }} />
              {tag.name}
            </span>
          ))}
        </div>
      )}
      {(task.due_date || task.duration_hours !== null) && (
        <div className="card-meta">
          {task.due_date && (
            <span
              className={cn(
                'due-label',
                priority === 'overdue' && 'overdue',
                priority === 'urgent' && 'urgent',
              )}
            >
              <CalendarDays size={12} />
              {formatDue(task.due_date)}
              {priority === 'overdue' && ' · overdue'}
            </span>
          )}
          {task.duration_hours !== null && (
            <span>
              <Clock3 size={12} />
              {task.duration_hours}h
            </span>
          )}
        </div>
      )}
    </>
  );
}

function TaskCard({
  task,
  workspace,
  done,
  pending,
  onOpen,
}: {
  task: Task;
  workspace: Workspace;
  done: boolean;
  pending: boolean;
  onOpen: (task: Task) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { status_id: task.status_id },
    disabled: pending,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'task-card',
        isDragging && 'is-dragging',
        done && 'is-complete',
      )}
    >
      <button
        type="button"
        className="card-open"
        onClick={() => onOpen(task)}
        aria-label={`Open task: ${task.title}`}
      >
        <CardContents task={task} workspace={workspace} done={done} />
      </button>
      <button
        type="button"
        className="drag-handle"
        aria-label={`Move task: ${task.title}`}
        title="Drag to change status. Keyboard: Space, arrow keys, Space."
        {...attributes}
        {...listeners}
        disabled={pending}
      >
        <GripVertical size={14} />
      </button>
    </div>
  );
}

function Column({
  column,
  tasks,
  workspace,
  pending,
  onOpen,
  onCreate,
}: {
  column: BoardColumn;
  tasks: Task[];
  workspace: Workspace;
  pending: boolean;
  onOpen: (task: Task) => void;
  onCreate: (column: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { status_id: column.id },
  });
  const hours = tasks.reduce(
    (total, task) => total + (task.duration_hours ?? 0),
    0,
  );
  return (
    <section
      className={cn('board-column', isOver && 'column-over')}
      ref={setNodeRef}
      aria-label={`${column.name} column`}
    >
      <div className="column-heading">
        <div>
          <span
            className={cn('column-dot', column.is_done && 'done-dot')}
            style={{ backgroundColor: column.color }}
          >
            {column.is_done && <Check size={9} />}
          </span>
          <h2>{column.name}</h2>
          <span className="column-count">{tasks.length}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Add task to ${column.name}`}
          onClick={() => onCreate(column.id)}
          disabled={pending}
        >
          <Plus />
        </Button>
      </div>
      <div className="column-effort">
        {column.is_done
          ? 'A little closer to your goals'
          : hours
            ? `${hours}h estimated effort`
            : 'Room for what’s next'}
      </div>
      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="column-cards">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              workspace={workspace}
              done={column.is_done}
              pending={pending}
              onOpen={onOpen}
            />
          ))}
          {!tasks.length && (
            <div className="column-empty">
              <span>
                {column.is_done ? 'Small wins belong here.' : 'A fresh start.'}
              </span>
              <button
                type="button"
                onClick={() => onCreate(column.id)}
                disabled={pending}
              >
                <Plus size={13} /> Add a task
              </button>
            </div>
          )}
        </div>
      </SortableContext>
      {tasks.length > 0 && (
        <button
          className="column-add"
          onClick={() => onCreate(column.id)}
          disabled={pending}
        >
          <Plus size={14} />
          Add task
        </button>
      )}
    </section>
  );
}

export function Board({
  workspace,
  filteredTasks,
  pending,
  onOpen,
  onCreate,
  onMove,
}: {
  workspace: Workspace;
  filteredTasks: Task[];
  pending: boolean;
  onOpen: (task: Task) => void;
  onCreate: (column: string) => void;
  onMove: (task: Task, status: string) => Promise<void>;
}) {
  const [active, setActive] = useState<Task | null>(null);
  const keyboardDrag = useRef(false);
  const keyboardTarget = useRef<string | null>(null);
  const columns = useMemo(
    () => [...workspace.columns].sort((a, b) => a.position - b.position),
    [workspace.columns],
  );
  const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      event.preventDefault();
      // Sensor key events can arrive before the previous drag frame renders.
      // Keep navigation independent of the lagging collision/over state.
      const currentId = keyboardTarget.current;
      const index = columns.findIndex((column) => column.id === currentId);
      const target = columns[index + (event.code === 'ArrowRight' ? 1 : -1)];
      if (target) keyboardTarget.current = target.id;
      const rect = target && args.context.droppableRects.get(target.id);
      if (rect) return { x: rect.left + 2, y: rect.top + 65 };
      return undefined;
    }
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown')
      event.preventDefault();
    return undefined;
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );
  const endDrag = (event: DragEndEvent) => {
    setActive(null);
    const task = workspace.tasks.find((item) => item.id === event.active.id);
    // Dropping immediately after an arrow press must commit the selected
    // column even when collision detection has not rendered that final frame.
    const target = keyboardDrag.current
      ? keyboardTarget.current
      : (event.over?.data.current?.status_id as string | undefined);
    if (task && target && target !== task.status_id) void onMove(task, target);
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        if (keyboardDrag.current && keyboardTarget.current)
          return [{ id: keyboardTarget.current }];
        return closestCorners({
          ...args,
          droppableContainers: args.droppableContainers.filter((container) =>
            columns.some((column) => column.id === container.id),
          ),
        });
      }}
      onDragStart={(event) => {
        const task =
          workspace.tasks.find((item) => item.id === event.active.id) ?? null;
        keyboardDrag.current = event.activatorEvent.type === 'keydown';
        keyboardTarget.current = keyboardDrag.current
          ? (task?.status_id ?? null)
          : null;
        setActive(task);
      }}
      onDragEnd={endDrag}
      onDragCancel={() => {
        keyboardDrag.current = false;
        keyboardTarget.current = null;
        setActive(null);
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'To move a task, press Space on its move handle. Use left and right arrow keys to choose a column, then Space to drop. Press Escape to cancel.',
        },
        announcements: {
          onDragStart: ({ active: current }) =>
            `Picked up ${workspace.tasks.find((task) => task.id === current.id)?.title ?? 'task'}.`,
          onDragOver: ({ over }) => {
            const target = keyboardDrag.current
              ? keyboardTarget.current
              : over?.data.current?.status_id;
            return target
              ? `Over ${workspace.columns.find((column) => column.id === target)?.name ?? 'a column'}.`
              : 'Outside the board.';
          },
          onDragEnd: ({ over }) => {
            const target = keyboardDrag.current
              ? keyboardTarget.current
              : over?.data.current?.status_id;
            return target
              ? `Moved to ${workspace.columns.find((column) => column.id === target)?.name ?? 'a column'}.`
              : 'Move cancelled.';
          },
          onDragCancel: () => 'Move cancelled.',
        },
      }}
    >
      <div className="kanban-board">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            tasks={sortTasks(
              filteredTasks.filter((task) => task.status_id === column.id),
            )}
            workspace={workspace}
            pending={pending}
            onOpen={onOpen}
            onCreate={onCreate}
          />
        ))}
      </div>
      <DragOverlay>
        {active ? (
          <div className="task-card drag-overlay">
            <div className="card-open">
              <CardContents
                task={active}
                workspace={workspace}
                done={
                  !!workspace.columns.find(
                    (column) => column.id === active.status_id,
                  )?.is_done
                }
              />
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
