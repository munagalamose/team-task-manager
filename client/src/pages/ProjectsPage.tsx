import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type ProjectCard = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  creator: { id: string; name: string; email: string };
  myRole: "ADMIN" | "MEMBER";
  taskCount?: number;
  memberCount?: number;
};

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api<{ projects: ProjectCard[] }>("/api/projects")
      .then((r) => setProjects(r.projects))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const r = await api<{ project: ProjectCard }>("/api/projects", {
        method: "POST",
        json: { name, description: description || undefined },
      });
      setProjects((prev) => [r.project, ...prev]);
      setName("");
      setDescription("");
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Could not create");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <p className="text-slate-400">Loading projects…</p>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-semibold text-white tracking-tight">
          Your projects
        </h1>
        <p className="text-slate-400 mt-2 max-w-xl">
          Create a project — you become the admin and can invite members by email.
        </p>
      </div>

      <div className="rounded-xl border border-accent/25 bg-accent/5 px-5 py-4 max-w-2xl">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-accent-muted mb-3">
          Core flows (assignment checklist)
        </h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300 [&_strong]:text-slate-100">
          <li>
            <strong>Login</strong> — you are signed in on this screen.
          </li>
          <li>
            <strong>Create project</strong> — use &quot;New project&quot; below.
          </li>
          <li>
            <strong>Add member</strong> — open a project → Team → invite by email or add from
            database (admin).
          </li>
          <li>
            <strong>Add task</strong> — Tasks → New task — title, description, due date, priority,
            assign user (admin).
          </li>
          <li>
            <strong>Update status</strong> — move tasks through{" "}
            <strong>To Do → In Progress → Done</strong> from the row or edit dialog.
          </li>
          <li>
            <strong>Dashboard</strong> — Dashboard tab: totals, by status, overdue.
          </li>
        </ol>
      </div>

      <form
        onSubmit={createProject}
        className="rounded-xl border border-surface-border bg-surface-raised p-6 space-y-4 max-w-xl"
      >
        <h2 className="text-sm font-medium text-white">New project</h2>
        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            placeholder="Project name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-muted disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-lg bg-surface border border-surface-border px-3 py-2 text-sm resize-none"
        />
      </form>

      <ul className="grid gap-4 sm:grid-cols-2">
        {projects.length === 0 && (
          <li className="text-slate-500 col-span-full">
            No projects yet. Create one above.
          </li>
        )}
        {projects.map((p) => (
          <li key={p.id}>
            <Link
              to={`/project/${p.id}`}
              className="block rounded-xl border border-surface-border bg-surface-raised p-5 hover:border-accent/40 transition group"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-white group-hover:text-accent-muted">
                  {p.name}
                </h3>
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                    p.myRole === "ADMIN"
                      ? "bg-accent/20 text-accent-muted"
                      : "bg-slate-600/30 text-slate-400"
                  }`}
                >
                  {p.myRole}
                </span>
              </div>
              {p.description && (
                <p className="text-sm text-slate-400 mt-2 line-clamp-2">
                  {p.description}
                </p>
              )}
              <div className="flex gap-4 mt-4 text-xs text-slate-500">
                <span>{p.taskCount ?? 0} tasks</span>
                <span>{p.memberCount ?? 0} members</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
