import { useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronRight,
  Columns3,
  Info,
  LoaderCircle,
  LogOut,
  Pencil,
  Plus,
  Tags,
  Trash2,
  UserRound,
} from 'lucide-react';
import type { BoardColumn, Tag, Workspace } from '@student-task-manager/shared';
import { toast } from 'sonner';
import type { Mutation } from '@/lib/workspace';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

type Editor =
  | { type: 'tag'; item: Tag | null }
  | { type: 'column'; item: BoardColumn | null };
type Deletion =
  { type: 'tag'; item: Tag } | { type: 'column'; item: BoardColumn };

function SettingsEditor({
  editor,
  workspace,
  pending,
  mutate,
  onClose,
}: {
  editor: Editor;
  workspace: Workspace;
  pending: boolean;
  mutate: (mutation: Mutation) => Promise<boolean>;
  onClose: () => void;
}) {
  const [name, setName] = useState(editor.item?.name ?? '');
  const [color, setColor] = useState(editor.item?.color ?? '#2563eb');
  const [isDone, setIsDone] = useState(
    editor.type === 'column' && (editor.item?.is_done ?? false),
  );
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const duplicate = (
      editor.type === 'tag' ? workspace.tags : workspace.columns
    ).some(
      (item) =>
        item.id !== editor.item?.id &&
        item.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
    );
    if (duplicate) {
      toast.error(`A ${editor.type} with this name already exists.`);
      return;
    }
    let mutation: Mutation;
    if (editor.type === 'tag')
      mutation = editor.item
        ? {
            kind: 'updateTag',
            id: editor.item.id,
            input: { name: name.trim(), color },
          }
        : { kind: 'createTag', input: { name: name.trim(), color } };
    else
      mutation = editor.item
        ? {
            kind: 'updateColumn',
            id: editor.item.id,
            input: { name: name.trim(), color, is_done: isDone },
          }
        : {
            kind: 'createColumn',
            input: {
              name: name.trim(),
              color,
              is_done: isDone,
              position:
                Math.max(
                  -1,
                  ...workspace.columns.map((column) => column.position),
                ) + 1,
            },
          };
    if (await mutate(mutation)) {
      toast.success(
        `${editor.type === 'tag' ? 'Tag' : 'Column'} ${editor.item ? 'updated' : 'created'}`,
      );
      onClose();
    }
  };
  const noun = editor.type === 'tag' ? 'Tag' : 'Column';
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {editor.item ? `Edit ${editor.type}` : `Create ${editor.type}`}
          </DialogTitle>
          <DialogDescription>
            {editor.type === 'tag'
              ? 'Make your work easy to find with a name and color.'
              : 'Shape the board around the way you work.'}
          </DialogDescription>
        </DialogHeader>
        <form className="editor-form" onSubmit={save}>
          <div className="field">
            <Label htmlFor="setting-name">{noun} name</Label>
            <Input
              id="setting-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={50}
              autoFocus
              required
              disabled={pending}
              placeholder={
                editor.type === 'tag' ? 'e.g. Research' : 'e.g. Review'
              }
            />
          </div>
          <div className="field">
            <Label htmlFor="setting-color">{noun} color</Label>
            <div className="color-picker">
              <Input
                id="setting-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                disabled={pending}
              />
              <span>{color.toUpperCase()}</span>
              <span className="color-dot" style={{ backgroundColor: color }} />
            </div>
          </div>
          {editor.type === 'column' && (
            <div className="switch-setting">
              <div>
                <Label htmlFor="completed-column">Completed column</Label>
                <p>
                  Tasks in this column count toward your completion percentage.
                </p>
              </div>
              <Switch
                id="completed-column"
                checked={isDone}
                onCheckedChange={setIsDone}
                disabled={pending}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircle className="animate-spin" />}
              {editor.item ? 'Save changes' : `Create ${editor.type}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSetting({
  deletion,
  workspace,
  pending,
  mutate,
  onClose,
}: {
  deletion: Deletion;
  workspace: Workspace;
  pending: boolean;
  mutate: (mutation: Mutation) => Promise<boolean>;
  onClose: () => void;
}) {
  const otherColumns = workspace.columns.filter(
    (column) => column.id !== deletion.item.id,
  );
  const [moveTo, setMoveTo] = useState(otherColumns[0]?.id ?? '');
  const taskCount =
    deletion.type === 'tag'
      ? workspace.tasks.filter((task) =>
          task.tag_ids.includes(deletion.item.id),
        ).length
      : workspace.tasks.filter((task) => task.status_id === deletion.item.id)
          .length;
  const remove = async () => {
    const mutation: Mutation =
      deletion.type === 'tag'
        ? { kind: 'deleteTag', id: deletion.item.id }
        : { kind: 'deleteColumn', id: deletion.item.id, moveTo };
    if (await mutate(mutation)) {
      toast.success(`${deletion.type === 'tag' ? 'Tag' : 'Column'} deleted`);
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
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            Delete {deletion.type} “{deletion.item.name}”?
          </DialogTitle>
          <DialogDescription>
            {deletion.type === 'tag'
              ? `This removes the tag from ${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}. Your tasks will be kept.`
              : `${taskCount} ${taskCount === 1 ? 'task will' : 'tasks will'} move to the column you choose. This cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        {deletion.type === 'column' && (
          <div className="field">
            <Label htmlFor="move-tasks">Move tasks to</Label>
            <select
              id="move-tasks"
              className="native-select"
              value={moveTo}
              onChange={(event) => setMoveTo(event.target.value)}
              disabled={pending}
            >
              {otherColumns.map((column) => (
                <option value={column.id} key={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
            <p className="editor-hint">
              Completion totals update to match the destination column.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void remove()}
            disabled={pending || (deletion.type === 'column' && !moveTo)}
          >
            {pending && <LoaderCircle className="animate-spin" />}Delete{' '}
            {deletion.type}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Settings({
  workspace,
  pending,
  isDemo,
  mutate,
  onBack,
  signOut,
}: {
  workspace: Workspace;
  pending: boolean;
  isDemo: boolean;
  mutate: (mutation: Mutation) => Promise<boolean>;
  onBack: () => void;
  signOut: () => Promise<void>;
}) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deletion, setDeletion] = useState<Deletion | null>(null);
  const columns = [...workspace.columns].sort(
    (a, b) => a.position - b.position,
  );
  const reorder = async (index: number, offset: number) => {
    const reordered = [...columns];
    [reordered[index], reordered[index + offset]] = [
      reordered[index + offset],
      reordered[index],
    ];
    // Persist one at a time so an interrupted reorder is visible and recoverable.
    for (let position = 0; position < reordered.length; position++) {
      if (
        reordered[position].position !== position &&
        !(await mutate({
          kind: 'updateColumn',
          id: reordered[position].id,
          input: { position },
        }))
      )
        return;
    }
    toast.success('Column order updated');
  };
  return (
    <div className="settings-page">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to board
      </button>
      <div className="page-heading">
        <h1>Settings</h1>
        <p>A workspace that feels like yours.</p>
      </div>
      <section className="settings-section">
        <div className="settings-section-title">
          <UserRound size={18} />
          <div>
            <h2>Account</h2>
            <p>Your student workspace.</p>
          </div>
        </div>
        <div className="account-details">
          <div className="account-avatar">
            {workspace.profile.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <span className="detail-label">Name</span>
            <p>{workspace.profile.name}</p>
          </div>
          <div>
            <span className="detail-label">Email</span>
            <p>{workspace.profile.email}</p>
          </div>
          {!isDemo && (
            <Button variant="outline" onClick={() => void signOut()}>
              <LogOut />
              Sign out
            </Button>
          )}
        </div>
        {isDemo && (
          <p className="demo-note">
            <Info size={14} />
            This sample account is part of the local demo. Changes stay in this
            browser.
          </p>
        )}
      </section>
      <section className="settings-section">
        <div className="settings-section-title">
          <Tags size={18} />
          <div>
            <h2>Tags</h2>
            <p>Organize work by class, pursuit, or part of your life.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditor({ type: 'tag', item: null })}
            disabled={pending}
          >
            <Plus />
            Create tag
          </Button>
        </div>
        <div className="settings-list">
          {workspace.tags.length ? (
            workspace.tags.map((tag) => (
              <div className="settings-row" key={tag.id}>
                <span className="color-dot" style={{ background: tag.color }} />
                <span className="row-name">{tag.name}</span>
                <span className="row-count">
                  {
                    workspace.tasks.filter((task) =>
                      task.tag_ids.includes(tag.id),
                    ).length
                  }{' '}
                  tasks
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit tag ${tag.name}`}
                  onClick={() => setEditor({ type: 'tag', item: tag })}
                  disabled={pending}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete tag ${tag.name}`}
                  onClick={() => setDeletion({ type: 'tag', item: tag })}
                  disabled={pending}
                >
                  <Trash2 />
                </Button>
              </div>
            ))
          ) : (
            <p className="settings-empty">
              No tags yet. Create one to give your tasks a little context.
            </p>
          )}
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-section-title">
          <Columns3 size={18} />
          <div>
            <h2>Board columns</h2>
            <p>
              Choose your workflow. Mark a column as completed to count its
              tasks as done.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditor({ type: 'column', item: null })}
            disabled={pending}
          >
            <Plus />
            Create column
          </Button>
        </div>
        <div className="settings-list">
          {columns.map((column, index) => (
            <div className="settings-row" key={column.id}>
              <span
                className="color-dot"
                style={{ background: column.color }}
              />
              <span className="row-name">
                {column.name}
                {column.is_done && (
                  <span className="done-badge">
                    <Check size={11} />
                    Completed
                  </span>
                )}
              </span>
              <div className="reorder-controls">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Move ${column.name} left`}
                  onClick={() => void reorder(index, -1)}
                  disabled={pending || index === 0}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Move ${column.name} right`}
                  onClick={() => void reorder(index, 1)}
                  disabled={pending || index === columns.length - 1}
                >
                  <ArrowDown />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit column ${column.name}`}
                onClick={() => setEditor({ type: 'column', item: column })}
                disabled={pending}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete column ${column.name}`}
                title={
                  columns.length === 1
                    ? 'Keep at least one column'
                    : 'Delete column'
                }
                onClick={() => setDeletion({ type: 'column', item: column })}
                disabled={pending || columns.length === 1}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      </section>
      <div className="settings-priority">
        <Info size={17} />
        <div>
          <h3>How priority works</h3>
          <p>
            Tasks are ordered by their due date minus estimated hours, so larger
            assignments rise earlier. Tasks without a deadline follow dated
            tasks, with larger estimates first. This is a planning cue; your
            classes and availability still decide when you work.
          </p>
        </div>
        <ChevronRight size={16} />
      </div>
      {editor && (
        <SettingsEditor
          key={`${editor.type}-${editor.item?.id ?? 'new'}`}
          editor={editor}
          workspace={workspace}
          pending={pending}
          mutate={mutate}
          onClose={() => setEditor(null)}
        />
      )}
      {deletion && (
        <DeleteSetting
          deletion={deletion}
          workspace={workspace}
          pending={pending}
          mutate={mutate}
          onClose={() => setDeletion(null)}
        />
      )}
    </div>
  );
}
