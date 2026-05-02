import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requireProjectMember } from "../middleware/projectAccess.js";
import { TaskStatus } from "@prisma/client";

export const dashboardRouter = Router({ mergeParams: true });

dashboardRouter.use(authMiddleware, requireProjectMember());

dashboardRouter.get("/", async (req, res) => {
  const projectId = req.projectMembership!.projectId;
  const userId = req.user!.id;
  const role = req.projectMembership!.role;

  const taskWhere =
    role === "ADMIN" ? { projectId } : { projectId, assigneeId: userId };

  const [tasks, members] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      select: {
        id: true,
        status: true,
        assigneeId: true,
        dueDate: true,
      },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true, user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const now = new Date();
  const byStatus: Record<TaskStatus, number> = {
    TODO: 0,
    IN_PROGRESS: 0,
    DONE: 0,
  };
  for (const t of tasks) {
    byStatus[t.status]++;
  }

  const assigneeCounts: Record<string, number> = {};
  for (const t of tasks) {
    const key = t.assigneeId ?? "unassigned";
    assigneeCounts[key] = (assigneeCounts[key] ?? 0) + 1;
  }

  const userLabel: Record<string, string> = {};
  for (const m of members) {
    userLabel[m.userId] = m.user.name;
  }
  userLabel["unassigned"] = "Unassigned";

  const assignedBreakdown = Object.entries(assigneeCounts).map(
    ([id, count]) => ({
      userId: id === "unassigned" ? null : id,
      name: userLabel[id] ?? id,
      count,
    }),
  );

  const overdue = tasks.filter(
    (t) =>
      t.dueDate !== null &&
      new Date(t.dueDate) < now &&
      t.status !== TaskStatus.DONE,
  ).length;

  res.json({
    dashboard: {
      totalTasks: tasks.length,
      byStatus,
      assignedBreakdown,
      overdue,
    },
  });
});
