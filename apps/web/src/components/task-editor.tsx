import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  CalendarDays,
  Clock3,
  FileText,
  LoaderCircle,
  Trash2,
} from 'lucide-react';
import type { Task, Workspace } from '@student-task-manager/shared';
import { isValidDateOnly } from '@student-task-manager/shared';
import { toast } from 'sonner';
import type { Mutation } from '@/lib/workspace';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

export function TaskEditor({
  task,
  initialColumn,
  workspace,
  pending,
  mutate,
  onClose,
}: {
  task: Task | null;
  initialColumn?: string;
  workspace: Workspace;
  pending: boolean;
  mutate: (mutation: Mutation) => Promise<boolean>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [hours, setHours] = useState(task?.duration_hours?.toString() ?? '');
  const [dueDate, setDueDate] = useState(task?.due_date ?? '');
  const [status, setStatus] = useState(
    task?.status_id ?? initialColumn ?? workspace.columns[0].id,
  );
  const [tags, setTags] = useState<string[]>(task?.tag_ids ?? []);
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const duration = hours.trim() ? Number(hours) : null;
    if (!title.trim()) {
      toast.error('Give your task a title.');
      return;
    }
    if (
      duration !== null &&
      (!Number.isFinite(duration) || duration <= 0 || duration > 1000)
    ) {
      toast.error(
        'Estimated hours must be greater than 0 and no more than 1,000.',
      );
      return;
    }
    if (dueDate && !isValidDateOnly(dueDate)) {
      toast.error('Enter a valid due date.');
      return;
    }
    const input = {
      title: title.trim(),
      description,
      status_id: status,
      duration_hours: duration,
      due_date: dueDate || null,
      tag_ids: tags,
    };
    if (
      await mutate(
        task
          ? { kind: 'updateTask', id: task.id, input }
          : { kind: 'createTask', input },
      )
    ) {
      toast.success(task ? 'Task updated' : 'Task created');
      onClose();
    }
  };
  const remove = async () => {
    if (task && (await mutate({ kind: 'deleteTask', id: task.id }))) {
      toast.success('Task deleted');
      onClose();
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="task-dialog"
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <div className="dialog-eyebrow">
            <FileText size={15} />{' '}
            {task ? 'TASK DETAILS' : 'MAKE ROOM FOR YOUR NEXT TASK'}
          </div>
          <DialogTitle>{task ? 'Edit task' : 'New task'}</DialogTitle>
          <DialogDescription>
            {task
              ? 'A little progress goes a long way.'
              : 'Capture it now. Take it one step at a time.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="editor-form">
          <div className="field">
            <Label htmlFor="task-title">
              Task title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              autoFocus
              placeholder="What needs to get done?"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={200}
              disabled={pending}
            />
          </div>
          <div className="field">
            <div className="field-heading">
              <Label htmlFor="task-description">Description</Label>
              <div className="segmented" aria-label="Description format">
                <button
                  type="button"
                  aria-pressed={!preview}
                  onClick={() => setPreview(false)}
                >
                  Write
                </button>
                <button
                  type="button"
                  aria-pressed={preview}
                  onClick={() => setPreview(true)}
                >
                  Preview
                </button>
              </div>
            </div>
            {preview ? (
              <div
                className="markdown-preview"
                aria-label="Description preview"
              >
                {description ? (
                  <ReactMarkdown>{description}</ReactMarkdown>
                ) : (
                  <p className="muted">
                    Your markdown preview will appear here.
                  </p>
                )}
              </div>
            ) : (
              <Textarea
                id="task-description"
                placeholder="Add notes, links, or a checklist… Markdown is welcome."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                maxLength={20000}
                disabled={pending}
              />
            )}
          </div>
          <div className="form-grid">
            <div className="field">
              <Label htmlFor="task-status">Status</Label>
              <select
                id="task-status"
                className="native-select"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                disabled={pending}
              >
                {workspace.columns.map((column) => (
                  <option value={column.id} key={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <Label htmlFor="task-hours">
                <Clock3 size={14} /> Estimated hours
              </Label>
              <Input
                id="task-hours"
                type="number"
                inputMode="decimal"
                min="0.01"
                max="1000"
                step="0.01"
                placeholder="e.g. 2.5"
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                disabled={pending}
              />
            </div>
            <div className="field">
              <Label htmlFor="task-due">
                <CalendarDays size={14} /> Due date
              </Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                disabled={pending}
              />
            </div>
          </div>
          <fieldset className="field">
            <legend className="field-legend">Tags</legend>
            <div className="tag-checkboxes">
              {workspace.tags.length ? (
                workspace.tags.map((tag) => (
                  <label className="tag-option" key={tag.id}>
                    <Checkbox
                      checked={tags.includes(tag.id)}
                      disabled={pending}
                      onCheckedChange={(checked) =>
                        setTags((current) =>
                          checked
                            ? [...current, tag.id]
                            : current.filter((id) => id !== tag.id),
                        )
                      }
                    />
                    <span
                      className="color-dot"
                      style={{ background: tag.color }}
                    />
                    {tag.name}
                  </label>
                ))
              ) : (
                <span className="muted text-sm">
                  Create tags in Settings to organize your tasks.
                </span>
              )}
            </div>
          </fieldset>
          <p className="editor-hint">
            Due dates are optional. Larger estimates move work earlier in your
            priority order.
          </p>
          {confirmDelete && (
            <div className="delete-confirm" role="alert">
              <p>Delete this task? This cannot be undone.</p>
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep task
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => void remove()}
                >
                  Confirm deletion
                </Button>
              </div>
            </div>
          )}
          <DialogFooter className="editor-footer">
            {task && (
              <Button
                variant="ghost"
                className="delete-task"
                disabled={pending}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 />
                Delete task
              </Button>
            )}
            <Button variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              {task ? 'Save changes' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
