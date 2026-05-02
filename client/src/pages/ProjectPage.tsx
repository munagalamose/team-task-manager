import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

type Role = "ADMIN" | "MEMBER";

type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  myRole: Role;
  taskCount: number;
  creator: { id: string; name: string; email: string };
  members: Array<{
    id: string;
    role: Role;
    user: { id: string; email?: string; name: string };
  }>;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  createdAt: string;
  assignee: { id: string; name: string; email: string } | null;
  createdBy: { id: string; name: string; email: string };
};

type Dashboard = {
  totalTasks: number;
  byStatus: Record<string, number>;
  assignedBreakdown: Array<{
    userId: string | null;
    name: string;
    count: number;
  }>;
  overdue: number;
};

function statusLabel(s: string) {
  switch (s) {
    case "TODO":
      return "To Do";
    case "IN_PROGRESS":
      return "In Progress";
    case "DONE":
      return "Done";
    default:
      return s;
  }
}

function priorityClass(p: string) {
  if (p === "HIGH") return "text-danger";
  if (p === "LOW") return "text-slate-500";
  return "text-warning";
}

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [tab, setTab] = useState<"tasks" | "dashboard" | "team">("tasks");
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [taskModal, setTaskModal] = useState<TaskRow | "new" | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [dirQuery, setDirQuery] = useState("");
  const [dirUsers, setDirUsers] = useState<
    Array<{ id: string; email: string; name: string }>
  >([]);
  const [dirLoading, setDirLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const base = `/api/projects/${projectId}`;
  const isAdmin = project?.myRole === "ADMIN";

  const refreshProject = useCallback(async () => {
    if (!projectId) return;
    const r = await api<{ project: ProjectDetail }>(
      `/api/projects/${projectId}`,
    );
    setProject(r.project);
  }, [projectId]);

  const refreshTasks = useCallback(async () => {
    if (!projectId) return;
    const r = await api<{ tasks: TaskRow[] }>(
      `/api/projects/${projectId}/tasks`,
    );
    setTasks(r.tasks);
  }, [projectId]);

  const refreshDashboard = useCallback(async () => {
    if (!projectId) return;
    const r = await api<{ dashboard: Dashboard }>(
      `/api/projects/${projectId}/dashboard`,
    );
    setDashboard(r.dashboard);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setLoadErr(null);
    Promise.all([refreshProject(), refreshTasks(), refreshDashboard()])
      .catch((e) =>
        setLoadErr(e instanceof Error ? e.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, [projectId, refreshProject, refreshTasks, refreshDashboard]);

  useEffect(() => {
    if (!isAdmin || tab !== "team" || !projectId) return;
    const t = setTimeout(() => {
      setDirLoading(true);
      const q = encodeURIComponent(dirQuery);
      api<{ users: typeof dirUsers }>(
        `/api/projects/${projectId}/users-to-invite?q=${q}`,
      )
        .then((r) => setDirUsers(r.users))
        .catch(() => setDirUsers([]))
        .finally(() => setDirLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [isAdmin, dirQuery, tab, projectId]);

  const reloadDirectory = useCallback(async () => {
    if (!projectId || !isAdmin) return;
    try {
      const q = encodeURIComponent(dirQuery);
      const r = await api<{ users: Array<{ id: string; email: string; name: string }> }>(
        `/api/projects/${projectId}/users-to-invite?q=${q}`,
      );
      setDirUsers(r.users);
    } catch {
      setDirUsers([]);
    }
  }, [projectId, isAdmin, dirQuery]);

  async function deleteProject() {
    if (!projectId || !confirm("Delete this project and all tasks?")) return;
    try {
      await api(`${base}`, { method: "DELETE" });
      window.location.href = "/";
    } catch (ex) {
      alert(ex instanceof Error ? ex.message : "Delete failed");
    }
  }

  async function addMember(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormErr(null);
    try {
      await api(`${base}/members`, {
        method: "POST",
        json: { email: memberEmail, role: "MEMBER" },
      });
      setMemberEmail("");
      await refreshProject();
      await reloadDirectory();
    } catch (ex) {
      setFormErr(ex instanceof Error ? ex.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function addMemberFromDirectory(target: {
    id: string;
    email: string;
    name: string;
  }) {
    setBusy(true);
    setFormErr(null);
    try {
      await api(`${base}/members`, {
        method: "POST",
        json: { userId: target.id, role: "MEMBER" },
      });
      await refreshProject();
      await reloadDirectory();
    } catch (ex) {
      setFormErr(ex instanceof Error ? ex.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(uid: string) {
    if (!confirm("Remove this member from the project?")) return;
    try {
      await api(`${base}/members/${uid}`, { method: "DELETE" });
      await refreshProject();
      await reloadDirectory();
    } catch (ex) {
      alert(ex instanceof Error ? ex.message : "Remove failed");
    }
  }

  if (!projectId) return null;

  if (loading && !project) {
    return <p className="text-slate-400">Loading…</p>;
  }
  if (loadErr || !project) {
    return (
      <div className="space-y-4">
        <p className="text-danger">{loadErr ?? "Not found"}</p>
        <Link to="/" className="text-accent">
          ← Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/"
          className="text-sm text-slate-500 hover:text-accent mb-4 inline-block"
        >
          ← All projects
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-3xl font-semibold text-white">
                {project.name}
              </h1>
              <span
                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                  isAdmin
                    ? "bg-accent/20 text-accent-muted"
                    : "bg-slate-600/30 text-slate-400"
                }`}
              >
                {project.myRole}
              </span>
            </div>
            {project.description && (
              <p className="text-slate-400 mt-2 max-w-2xl">{project.description}</p>
            )}
            <p className="text-xs text-slate-500 mt-2">
              Admin: {project.creator.name} · {project.taskCount} tasks
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={deleteProject}
              className="text-sm text-danger hover:underline shrink-0"
            >
              Delete project
            </button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <p className="text-sm text-slate-500 rounded-lg bg-surface-raised border border-surface-border px-4 py-3">
          As a member, you can view the dashboard for your assignments and update
          only tasks assigned to you.
        </p>
      )}

      <nav className="flex gap-2 border-b border-surface-border pb-px">
        {(["tasks", "dashboard", "team"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize transition ${
              tab === t
                ? "bg-surface-raised text-white border border-b-0 border-surface-border -mb-px"
                : "text-slate-500 hover:text-white"
            }`}
          >
            {t === "team" ? "Team" : t}
          </button>
        ))}
      </nav>

      <div className="rounded-lg border border-surface-border bg-surface-raised/80 px-4 py-3 text-sm text-slate-400">
        <span className="text-slate-300 font-medium">Where to complete the main flows: </span>
        {isAdmin ? (
          <>
            <strong className="text-slate-200">Team</strong> → add member ·{" "}
            <strong className="text-slate-200">Tasks</strong> → new task · status dropdown or edit ·{" "}
            <strong className="text-slate-200">Dashboard</strong> → totals / by status / overdue.
          </>
        ) : (
          <>
            Your assigned work lives under <strong className="text-slate-200">Tasks</strong> and{" "}
            <strong className="text-slate-200">Dashboard</strong> (counts for your assignments
            only). Admins manage members and creating tasks under Team / Tasks.
          </>
        )}
      </div>

      {tab === "tasks" && (
        <section className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-medium text-white">Tasks</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Each task has title, description, due date, priority, and assignee. Use the
                status control to move work through{" "}
                <strong className="text-slate-400 font-medium">To Do → In Progress → Done</strong>.
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setFormErr(null);
                  setTaskModal("new");
                }}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                New task
              </button>
            )}
          </div>
          <ul className="space-y-2">
            {tasks.length === 0 && (
              <li className="text-slate-500 text-sm">
                {isAdmin
                  ? "No tasks yet. Create one to get started."
                  : "No tasks assigned to you in this project."}
              </li>
            )}
            {tasks.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col sm:flex-row sm:items-start gap-4 justify-between"
              >
                <div className="min-w-0 flex-1 space-y-3">
                  <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 text-sm">
                    <div className="sm:col-span-2">
                      <dt className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">
                        Task title
                      </dt>
                      <dd className="font-medium text-white">{t.title}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">
                        Description
                      </dt>
                      <dd className="text-slate-300 whitespace-pre-wrap">
                        {t.description?.trim()
                          ? t.description
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">
                        Due date
                      </dt>
                      <dd className="text-slate-200">
                        {t.dueDate
                          ? new Date(t.dueDate).toLocaleDateString()
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">
                        Priority
                      </dt>
                      <dd className={priorityClass(t.priority)}>{t.priority}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">
                        Assigned user
                      </dt>
                      <dd className="text-slate-200">
                        {t.assignee
                          ? `${t.assignee.name} (${t.assignee.email})`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">
                        Status
                      </dt>
                      <dd className="text-slate-200">{statusLabel(t.status)}</dd>
                    </div>
                  </dl>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(isAdmin ||
                    (t.assignee?.id === user?.id &&
                      t.assignee?.id !== undefined)) && (
                    <TaskStatusSelect
                      value={t.status}
                      disabled={busy}
                      onChange={async (status) => {
                        setBusy(true);
                        try {
                          await api(`${base}/tasks/${t.id}`, {
                            method: "PATCH",
                            json: isAdmin ? { status } : { status },
                          });
                          await refreshTasks();
                          await refreshDashboard();
                        } catch (ex) {
                          alert(ex instanceof Error ? ex.message : "Update failed");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  )}
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setFormErr(null);
                          setTaskModal(t);
                        }}
                        className="text-sm text-accent"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm("Delete this task?")) return;
                          try {
                            await api(`${base}/tasks/${t.id}`, {
                              method: "DELETE",
                            });
                            await refreshTasks();
                            await refreshDashboard();
                          } catch (ex) {
                            alert(
                              ex instanceof Error ? ex.message : "Delete failed",
                            );
                          }
                        }}
                        className="text-sm text-danger"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "dashboard" && dashboard && (
        <section className="space-y-8">
          <div>
            <h2 className="text-lg font-medium text-white">Dashboard</h2>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl">
              Total tasks, counts by status (To Do / In Progress / Done), and overdue
              items (not Done, past due).{" "}
              {isAdmin
                ? "Metrics include every task in this project."
                : "Metrics include only tasks assigned to you."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Total tasks" value={dashboard.totalTasks} />
            <StatCard title="Overdue (not done)" value={dashboard.overdue} accent="danger" />
            <StatCard
              title="Done"
              value={dashboard.byStatus.DONE ?? 0}
              accent="success"
            />
          </div>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-surface-border bg-surface-raised p-6">
              <h3 className="text-sm font-medium text-slate-300 mb-4">
                By status
              </h3>
              <div className="space-y-4">
                {(["TODO", "IN_PROGRESS", "DONE"] as const).map((s) => {
                  const count = dashboard.byStatus[s] ?? 0;
                  const pct =
                    dashboard.totalTasks === 0
                      ? 0
                      : Math.round((count / dashboard.totalTasks) * 100);
                  return (
                    <div key={s}>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>{statusLabel(s)}</span>
                        <span>
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            s === "DONE"
                              ? "bg-success"
                              : s === "IN_PROGRESS"
                                ? "bg-accent"
                                : "bg-slate-600"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface-raised p-6">
              <h3 className="text-sm font-medium text-slate-300 mb-4">
                Tasks assigned per user
              </h3>
              <ul className="space-y-3">
                {dashboard.assignedBreakdown.length === 0 && (
                  <li className="text-sm text-slate-500">No data</li>
                )}
                {dashboard.assignedBreakdown.map((row) => (
                  <li
                    key={row.userId ?? "unassigned"}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-slate-300 truncate max-w-[12rem]">
                      {row.name}
                    </span>
                    <span className="text-slate-500">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {tab === "team" && (
        <section className="space-y-8 max-w-2xl">
          <div>
            <h2 className="text-lg font-medium text-white">Team</h2>
            <p className="text-sm text-slate-500 mt-2">
              Admins can invite someone by registered email or pick an existing account
              from the database (users not yet in this project).
            </p>
          </div>
          {!isAdmin && (
            <p className="text-sm text-slate-500">
              Only admins can add or remove members.
            </p>
          )}
          <ul className="rounded-xl border border-surface-border divide-y divide-surface-border">
            {project.members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between px-4 py-3 gap-2"
              >
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{m.user.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {isAdmin && m.user.email
                      ? m.user.email
                      : m.role === "ADMIN"
                        ? "Admin"
                        : "Member"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase text-slate-500">
                    {m.role}
                  </span>
                  {isAdmin && m.user.id !== user?.id && (
                    <button
                      type="button"
                      onClick={() => removeMember(m.user.id)}
                      className="text-xs text-danger"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {isAdmin && (
            <div className="space-y-8 rounded-xl border border-surface-border bg-surface-raised p-6">
              {formErr && (
                <p className="text-sm text-danger">{formErr}</p>
              )}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">
                  Option A · Invite by email
                </h3>
                <form onSubmit={addMember} className="flex gap-2 flex-wrap">
                  <input
                    type="email"
                    required
                    placeholder="Registered user email"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    className="flex-1 min-w-[12rem] rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
                  >
                    Invite by email
                  </button>
                </form>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">
                  Option B · Add from database
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Search accounts by name or email. Showing users who are not already
                  members (up to 25).
                </p>
                <input
                  type="search"
                  placeholder="Search name or email…"
                  value={dirQuery}
                  onChange={(e) => setDirQuery(e.target.value)}
                  className="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm mb-3"
                  aria-label="Search users"
                />
                {dirLoading ? (
                  <p className="text-sm text-slate-500">Searching…</p>
                ) : dirUsers.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No matching users outside this project. Register another account or try
                    a different search.
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-56 overflow-y-auto">
                    {dirUsers.map((u) => (
                      <li
                        key={u.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-surface-border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <span className="text-white text-sm font-medium">
                            {u.name}
                          </span>
                          <span className="block text-xs text-slate-500 truncate">
                            {u.email}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => addMemberFromDirectory(u)}
                          className="shrink-0 rounded-lg bg-surface border border-surface-border px-3 py-1.5 text-xs text-accent hover:border-accent/50 disabled:opacity-50"
                        >
                          Add to project
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {taskModal && projectId && (
        <TaskEditorModal
          base={base}
          project={project}
          task={taskModal === "new" ? null : taskModal}
          onClose={() => setTaskModal(null)}
          onSaved={async () => {
            setTaskModal(null);
            await refreshTasks();
            await refreshDashboard();
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: number;
  accent?: "danger" | "success";
}) {
  const c =
    accent === "danger"
      ? "border-danger/30 text-danger"
      : accent === "success"
        ? "border-success/30 text-success"
        : "border-surface-border text-white";
  return (
    <div className={`rounded-xl border bg-surface-raised p-5 ${c}`}>
      <p className="text-xs uppercase tracking-wider text-slate-500">{title}</p>
      <p className="font-display text-3xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function TaskStatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (s: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg bg-surface border border-surface-border px-2 py-1.5 text-xs"
    >
      <option value="TODO">To Do</option>
      <option value="IN_PROGRESS">In Progress</option>
      <option value="DONE">Done</option>
    </select>
  );
}

function TaskEditorModal({
  base,
  project,
  task,
  onClose,
  onSaved,
}: {
  base: string;
  project: ProjectDetail;
  task: TaskRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? task.dueDate.slice(0, 10) : "",
  );
  const [priority, setPriority] = useState(task?.priority ?? "MEDIUM");
  const [status, setStatus] = useState(task?.status ?? "TODO");
  const [assigneeId, setAssigneeId] = useState(task?.assignee?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const body = {
      title,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      priority,
      status,
      assigneeId: assigneeId || null,
    };
    try {
      if (task) {
        await api(`${base}/tasks/${task.id}`, {
          method: "PATCH",
          json: body,
        });
      } else {
        await api(`${base}/tasks`, { method: "POST", json: body });
      }
      await onSaved();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-lg font-semibold text-white mb-4">
          {task ? "Edit task" : "New task"}
        </h3>
        <form onSubmit={submit} className="space-y-4">
          {err && <p className="text-sm text-danger">{err}</p>}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Task title <span className="text-danger">*</span>
            </label>
            <input
              required
              placeholder="Short summary of the work"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Description
            </label>
            <textarea
              placeholder="Details, acceptance criteria…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Due date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full mt-1 rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full mt-1 rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Status <span className="text-slate-600 font-normal">(To Do → In Progress → Done)</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full mt-1 rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Assign user
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm mt-1"
              >
                <option value="">Unassigned</option>
                {project.members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
