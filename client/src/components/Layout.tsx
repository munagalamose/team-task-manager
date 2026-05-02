import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-surface-border bg-surface-raised/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <NavLink
            to="/"
            className="font-display font-semibold text-lg text-white tracking-tight"
          >
            Team Tasks
          </NavLink>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-400 hidden sm:inline truncate max-w-[12rem]">
              {user?.name}
            </span>
            <button
              type="button"
              onClick={logout}
              className="text-slate-400 hover:text-white transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-surface-border py-6 text-center text-xs text-slate-500">
        Team Task Manager — JWT auth, role-based access
      </footer>
    </div>
  );
}
