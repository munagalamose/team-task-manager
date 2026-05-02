import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      await login(email, password);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-surface">
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-8 shadow-xl">
        <h1 className="font-display text-2xl font-semibold text-white mb-1">
          Welcome back
        </h1>
        <p className="text-slate-400 text-sm mb-2">
          Sign in to manage team projects and tasks.
        </p>
        <p className="text-slate-500 text-xs mb-8">
          After login: create a project → add members → add tasks → update status → dashboard.
        </p>
        <form onSubmit={submit} className="space-y-4">
          {err && (
            <div className="rounded-lg bg-danger/15 text-danger px-3 py-2 text-sm">
              {err}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-surface border border-surface-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-surface border border-surface-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-accent py-3 text-sm font-medium text-white hover:bg-accent-muted transition disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          No account?{" "}
          <Link to="/register" className="text-accent hover:text-accent-muted">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
