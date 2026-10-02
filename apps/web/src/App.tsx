import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Columns3,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Tags,
  X,
} from 'lucide-react';
import { completionPercentage, type Task } from '@student-task-manager/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Board } from '@/components/board';
import { useWorkspace } from '@/hooks/use-workspace';
import { workload } from '@/lib/workspace';
import { cn } from '@/lib/utils';
import { configurationError } from '@/lib/api';

const TaskEditor = lazy(() =>
  import('@/components/task-editor').then((module) => ({
    default: module.TaskEditor,
  })),
);
const Settings = lazy(() =>
  import('@/components/settings').then((module) => ({
    default: module.Settings,
  })),
);

export default function App() {
  const state = useWorkspace();
  const [view, setView] = useState<'board' | 'settings'>('board');
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [editing, setEditing] = useState<{
    task: Task | null;
    column?: string;
  } | null>(null);
  const [showPriority, setShowPriority] = useState(false);
  const workspace = state.workspace;
  const filtered = useMemo(
    () =>
      workspace?.tasks.filter(
        (task) =>
          (tagFilter === 'all' || task.tag_ids.includes(tagFilter)) &&
          `${task.title} ${task.description}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()),
      ) ?? [],
    [workspace, search, tagFilter],
  );
  const stats = workspace ? workload(workspace) : null;
  const percent = workspace
    ? completionPercentage(workspace.tasks, workspace.columns)
    : 0;
  const completed =
    workspace && stats ? workspace.tasks.length - stats.outstanding.length : 0;
  useEffect(() => {
    setEditing(null);
    setSearch('');
    setTagFilter('all');
    setView('board');
  }, [state.session?.user.id]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key.toLocaleLowerCase() === 'n' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.repeat &&
        view === 'board' &&
        workspace &&
        !editing &&
        !document.querySelector('[role="dialog"]') &&
        !target?.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        event.preventDefault();
        setEditing({ task: null });
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [view, workspace, editing]);
  useEffect(() => {
    if (
      tagFilter !== 'all' &&
      workspace &&
      !workspace.tags.some((tag) => tag.id === tagFilter)
    )
      setTagFilter('all');
  }, [workspace, tagFilter]);

  if (configurationError)
    return (
      <main className="full-state">
        <div className="brand-mark">
          <GraduationCap />
        </div>
        <h1>Finish connecting your workspace</h1>
        <p className="configuration-error" role="alert">
          {configurationError}
        </p>
      </main>
    );
  if (state.authLoading)
    return (
      <div className="full-state">
        <div className="brand-mark">
          <GraduationCap />
        </div>
        <LoaderCircle className="animate-spin" />
        <p>Opening your workspace…</p>
      </div>
    );
  if (!state.isDemo && !state.session)
    return (
      <div className="login-page">
        <div className="login-top">
          <div className="brand-mark">
            <GraduationCap />
          </div>
          <span>Student Task Manager</span>
        </div>
        <main className="login-card">
          <span className="eyebrow">
            <Sparkles size={14} /> A LITTLE LESS OVERWHELM
          </span>
          <h1>
            All your work.
            <br />A clearer head.
          </h1>
          <p>
            Bring assignments, applications, and life into one calm workspace.
            See what’s next, make progress, and make room for a break.
          </p>
          <Button
            size="lg"
            className="google-button"
            onClick={() => void state.signIn()}
            disabled={state.pending}
          >
            {state.pending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
            <ArrowRight size={16} />
          </Button>
          <span className="login-note">
            Sign in or create an account with your Google account.
          </span>
          {state.error && (
            <p className="error-text" role="alert">
              {state.error}
            </p>
          )}
          <div className="login-board-preview" aria-hidden="true">
            <div>
              <span className="color-dot" style={{ background: '#a9adb7' }} />
              To-Do
              <div className="preview-card">
                Finish the problem set<span>Class · 3h</span>
              </div>
            </div>
            <div>
              <span className="color-dot" style={{ background: '#e2b252' }} />
              In-Progress
              <div className="preview-card">
                Draft the essay<span>Class · 4h</span>
              </div>
            </div>
            <div>
              <span className="color-dot" style={{ background: '#8b5cf6' }} />
              Done
              <div className="preview-card">
                <Check size={13} /> Lab report submitted
                <span>A small win.</span>
              </div>
            </div>
          </div>
        </main>
        <footer>A little progress, every day.</footer>
      </div>
    );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="workspace-brand">
          <div className="brand-mark">
            <GraduationCap />
          </div>
          <div>
            <strong>Student workspace</strong>
            <span>Your space to make progress</span>
          </div>
        </div>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <button
            className={cn('nav-item', view === 'board' && 'active')}
            onClick={() => setView('board')}
          >
            <LayoutDashboard size={17} />
            My board
            <span className="nav-count">{workspace?.tasks.length ?? '—'}</span>
          </button>
          <button
            className={cn('nav-item', view === 'settings' && 'active')}
            onClick={() => setView('settings')}
          >
            <Settings2 size={17} />
            Settings
          </button>
        </nav>
        <div className="sidebar-section-label tags-label">YOUR TAGS</div>
        <div className="sidebar-tags">
          {workspace?.tags.map((tag) => (
            <button
              key={tag.id}
              className={cn(
                'sidebar-tag',
                tagFilter === tag.id && view === 'board' && 'selected',
              )}
              onClick={() => {
                setTagFilter(tagFilter === tag.id ? 'all' : tag.id);
                setView('board');
              }}
            >
              <span className="color-dot" style={{ background: tag.color }} />
              <span>{tag.name}</span>
              <span>
                {
                  workspace.tasks.filter((task) =>
                    task.tag_ids.includes(tag.id),
                  ).length
                }
              </span>
            </button>
          ))}
          <button className="manage-tags" onClick={() => setView('settings')}>
            <Plus size={13} />
            Manage tags
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <Sparkles size={16} />
            <p>
              You don’t have to do it all.
              <br />
              Just the next right thing.
            </p>
          </div>
          {state.isDemo && (
            <div className="demo-indicator">
              <span />
              Local demo
            </div>
          )}
          <div className="sidebar-profile">
            <div className="avatar">
              {workspace?.profile.name.slice(0, 1).toUpperCase() ?? 'S'}
            </div>
            <div>
              <strong>{workspace?.profile.name ?? 'Your workspace'}</strong>
              <span>
                {state.isDemo
                  ? 'Saved in this browser'
                  : workspace?.profile.email}
              </span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="mobile-brand">
              <GraduationCap size={19} />
            </span>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{view === 'board' ? 'My board' : 'Settings'}</strong>
          </div>
          <div className="topbar-actions">
            {state.isDemo && <span className="demo-pill">Demo workspace</span>}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Settings"
              title="Settings"
              onClick={() =>
                setView(view === 'settings' ? 'board' : 'settings')
              }
            >
              <Settings2 />
            </Button>
          </div>
        </header>
        {state.isDemo && (
          <div className="demo-banner">
            <span>
              <InfoIcon />
              You’re exploring the local demo. Your changes are saved in this
              browser.
            </span>
            <span className="demo-banner-detail">
              Cloud sync needs Supabase configuration.
            </span>
          </div>
        )}
        {state.error && (
          <div className="load-error" role="alert">
            <span>{state.error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void state.refresh()}
              disabled={state.loading}
            >
              {state.loading ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        )}
        {!workspace ? (
          <div className="full-state inline-state">
            {state.loading ? (
              <>
                <LoaderCircle className="animate-spin" />
                <p>Gathering your tasks…</p>
              </>
            ) : (
              <>
                <Columns3 />
                <p>Your workspace couldn’t be loaded.</p>
                <Button variant="outline" onClick={() => void state.refresh()}>
                  Try again
                </Button>
                <Button variant="ghost" onClick={() => void state.signOut()}>
                  Sign out
                </Button>
              </>
            )}
          </div>
        ) : view === 'settings' ? (
          <Suspense
            fallback={
              <div className="inline-state full-state">
                <LoaderCircle className="animate-spin" />
                <p>Opening settings…</p>
              </div>
            }
          >
            <Settings
              workspace={workspace}
              pending={state.pending}
              isDemo={state.isDemo}
              mutate={state.mutate}
              signOut={state.signOut}
              onBack={() => setView('board')}
            />
          </Suspense>
        ) : (
          <main className="board-page">
            <div className="board-heading">
              <div>
                <div className="eyebrow">A LITTLE PROGRESS, EVERY DAY</div>
                <h1>
                  My board
                  <span className="heading-dot" aria-hidden="true">
                    .
                  </span>
                </h1>
                <p>A clear view of what’s next. You’ve got this.</p>
              </div>
              <Button
                className="new-task-button"
                onClick={() => setEditing({ task: null })}
                disabled={state.pending}
              >
                <Plus />
                New task<kbd aria-hidden="true">N</kbd>
              </Button>
            </div>
            <section className="summary-row" aria-label="Workspace summary">
              <div className="summary-item completion-summary">
                <div
                  className="progress-ring"
                  style={{
                    background: `conic-gradient(var(--primary) ${percent}%, #eae6f1 0)`,
                  }}
                >
                  <span>
                    <Check size={17} />
                  </span>
                </div>
                <div>
                  <span className="summary-label">YOU’RE MAKING PROGRESS</span>
                  <div>
                    <strong>{percent}%</strong>
                    <span>complete</span>
                  </div>
                  <p>
                    {completed} of {workspace.tasks.length} tasks done
                  </p>
                </div>
              </div>
              <div className="summary-item">
                <span className="summary-icon">
                  <Clock3 size={18} />
                </span>
                <div>
                  <span className="summary-label">REMAINING EFFORT</span>
                  <div>
                    <strong>
                      {stats?.totalHours ?? 0}
                      <small>h</small>
                    </strong>
                    <span>estimated</span>
                  </div>
                  <p>
                    {stats?.outstanding.length ?? 0} tasks to work through
                    {stats?.unestimated
                      ? ` · ${stats.unestimated} without estimates`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="summary-item week-summary">
                <span className="summary-icon">
                  <Sparkles size={18} />
                </span>
                <div>
                  <span className="summary-label">DUE IN THE NEXT 7 DAYS</span>
                  <div>
                    <strong>
                      {stats?.weekHours ?? 0}
                      <small>h</small>
                    </strong>
                    <span>estimated</span>
                  </div>
                  <p>
                    {stats?.dueSoon.length ?? 0} upcoming tasks
                    {stats?.overdue ? ` · ${stats.overdue} overdue` : ''}
                  </p>
                </div>
              </div>
            </section>
            <div className="board-toolbar">
              <div className="board-view-label">
                <Columns3 size={15} />
                Board<span>{filtered.length} tasks</span>
              </div>
              <div className="filters">
                <div className="search-field">
                  <Search size={14} />
                  <Input
                    aria-label="Search tasks"
                    placeholder="Search tasks…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {search && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setSearch('')}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="tag-filter">
                  <Tags size={14} />
                  <select
                    aria-label="Filter by tag"
                    value={tagFilter}
                    onChange={(event) => setTagFilter(event.target.value)}
                  >
                    <option value="all">All tags</option>
                    {workspace.tags.map((tag) => (
                      <option value={tag.id} key={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} />
                </div>
                <button
                  className={cn('priority-button', showPriority && 'selected')}
                  aria-label="How tasks are prioritized"
                  aria-expanded={showPriority}
                  onClick={() => setShowPriority(!showPriority)}
                >
                  <SlidersHorizontal size={14} />
                  <span>Priority</span>
                </button>
              </div>
            </div>
            {showPriority && (
              <div className="priority-note">
                <CircleHelp size={16} />
                <p>
                  Due date minus estimated hours sets the order: earlier starts
                  appear first, and bigger tasks rise sooner. An orange date
                  means work is recommended within 24 hours; red means overdue.
                  Effort totals show estimated work, not your free time or a
                  schedule.
                </p>
                <button
                  aria-label="Close priority explanation"
                  onClick={() => setShowPriority(false)}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {!filtered.length && (search || tagFilter !== 'all') && (
              <div className="filter-empty">
                <Search size={18} />
                <div>
                  <strong>No tasks match these filters.</strong>
                  <p>Try another search or show all your tasks.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setTagFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              </div>
            )}
            <Board
              workspace={workspace}
              filteredTasks={filtered}
              pending={state.pending}
              onOpen={(task) => setEditing({ task })}
              onCreate={(column) => setEditing({ task: null, column })}
              onMove={async (task, status) => {
                if (
                  await state.mutate({
                    kind: 'updateTask',
                    id: task.id,
                    input: { status_id: status },
                  })
                )
                  toast.success(
                    `Moved to ${workspace.columns.find((column) => column.id === status)?.name}`,
                  );
              }}
            />
            <footer className="board-footer">
              <span>
                <span className="color-dot" />
                Sorted by due date &amp; effort
              </span>
              <span>
                Drag the handle to move a task · Press <kbd>N</kbd> to add one
              </span>
            </footer>
          </main>
        )}
      </div>
      {editing && workspace && (
        <Suspense fallback={null}>
          <TaskEditor
            key={editing.task?.id ?? `new-${editing.column ?? 'default'}`}
            task={editing.task}
            initialColumn={editing.column}
            workspace={workspace}
            pending={state.pending}
            mutate={state.mutate}
            onClose={() => setEditing(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.8 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.7Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.8-2.5l-3.3-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.2H2.8v2.7A10.3 10.3 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.2 13.7a6 6 0 0 1 0-3.4V7.6H2.8a10 10 0 0 0 0 8.8l3.4-2.7Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 2.8 7.6l3.4 2.7A6 6 0 0 1 12 6.1Z"
      />
    </svg>
  );
}
function InfoIcon() {
  return <CircleHelp size={13} />;
}
