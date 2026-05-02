# Team Task Manager

Full-stack collaborative task tracker: JWT auth, **Express + Prisma (SQLite locally, PostgreSQL in production)** (REST APIs), React + Tailwind SPA.

## Features

- **Authentication:** Register, login, `Bearer` JWT; password hashing with bcrypt.
- **Projects:** Creator becomes **ADMIN**, can rename/delete project.
- **Members:** Admin adds people by email, removes members (cannot remove sole admin).
- **Tasks:** Title, description, due date, priority (LOW/MEDIUM/HIGH), status (To Do / In Progress / Done), assignee (project members only).
- **RBAC:** **ADMIN** — full task CRUD, members, dashboard for all tasks. **MEMBER** — sees dashboard for their assignments only, task list/API only assigned tasks; may **change status only** on assigned tasks (no creating/deleting/editing metadata).
- **Dashboard:** Totals, counts by status, assignment breakdown, overdue (not-done with past due date).

## Run locally

```bash
npm install
cd server && npx prisma db push
cd ..
npm run dev
```

- API: http://localhost:4000  
- UI (with proxy): http://localhost:5173  

`npm run dev` runs API and Vite together. For production-like single port: build first, then start only the API (it serves `client/dist` when present):

```bash
npm run build
npm run start --workspace=server
```

Open http://localhost:4000

## Deploy online

Typical split (or combine on one Node host):

1. **Database:** Provision PostgreSQL; set `DATABASE_URL` with `postgresql://...` ([Prisma connection URL](https://www.prisma.io/docs/orm/overview/databases/postgresql)).

2. **Schema:** Switch `provider` in `server/prisma/schema.prisma` to `postgresql`, run migrations (`prisma migrate deploy`) in CI or release step.

3. **Secrets:** Set `JWT_SECRET` to a long random string.

4. **Build:** `npm run build` (compiles API + SPA).

5. **Run:** `npm run start --workspace=server` with `DATABASE_URL`, `JWT_SECRET`, and optional `PORT` set by the platform (e.g. [Render](https://render.com), [Railway](https://railway.app), Fly.io).

Alternatively host the SPA on Netlify/Vercel and point API `VITE_`/`fetch` URLs to your API domain (currently same-origin `/api`).
