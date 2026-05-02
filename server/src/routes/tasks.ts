import { Router } from "express";
import { z } from "zod";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requireAdmin, requireProjectMember } from "../middleware/projectAccess.js";
import { taskIdFromReq } from "../params.js";

export const tasksRouter = Router({ mergeParams: true });

tasksRouter.use(authMiddleware, requireProjectMember());

const taskAssignSelect = {
  id: true,
  title: true,
  description: true,
  dueDate: true,
  priority: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
};

const createSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assigneeId: z.string().cuid().optional().nullable(),
  status: z.nativeEnum(TaskStatus).optional(),
});

const patchSchema = createSchema.partial();

tasksRouter.get("/", async (req, res) => {
  const projectId = req.projectMembership!.projectId;
  const userId = req.user!.id;
  const role = req.projectMembership!.role;

  const where =
    role === "ADMIN"
      ? { projectId }
      : { projectId, assigneeId: userId };

  const tasks = await prisma.task.findMany({
    where,
    select: taskAssignSelect,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
  res.json({ tasks });
});

tasksRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const projectId = req.projectMembership!.projectId;
  const creatorId = req.user!.id;
  const body = parsed.data;

  if (body.assigneeId) {
    const assigneeMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: body.assigneeId },
      },
    });
    if (!assigneeMembership) {
      res.status(400).json({
        error: "Assignee must be a member of this project",
      });
      return;
    }
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      title: body.title,
      description: body.description ?? null,
      dueDate: body.dueDate ?? null,
      priority: body.priority ?? "MEDIUM",
      status: body.status ?? "TODO",
      createdById: creatorId,
      assigneeId: body.assigneeId ?? null,
    },
    select: taskAssignSelect,
  });
  res.status(201).json({ task });
});

tasksRouter.get("/:taskId", async (req, res) => {
  const projectId = req.projectMembership!.projectId;
  const taskId = taskIdFromReq(req);
  if (!taskId) {
    res.status(400).json({ error: "Missing task ID" });
    return;
  }
  const userId = req.user!.id;
  const role = req.projectMembership!.role;

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId },
    select: taskAssignSelect,
  });
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (
    role === "MEMBER" &&
    task.assignee?.id !== userId
  ) {
    res.status(403).json({ error: "You can only view tasks assigned to you" });
    return;
  }
  res.json({ task });
});

tasksRouter.patch("/:taskId", async (req, res) => {
  const projectId = req.projectMembership!.projectId;
  const taskId = taskIdFromReq(req);
  if (!taskId) {
    res.status(400).json({ error: "Missing task ID" });
    return;
  }
  const userId = req.user!.id;
  const role = req.projectMembership!.role;
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.task.findFirst({
    where: { id: taskId, projectId },
  });
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (role === "MEMBER") {
    if (existing.assigneeId !== userId) {
      res.status(403).json({
        error: "Members can only update tasks assigned to them",
      });
      return;
    }
    const { status } = parsed.data;
    const otherKeys = parsed.data as Record<string, unknown>;
    const disallowed =
      otherKeys.title !== undefined ||
      otherKeys.description !== undefined ||
      otherKeys.dueDate !== undefined ||
      otherKeys.priority !== undefined ||
      otherKeys.assigneeId !== undefined;
    if (disallowed) {
      res.status(403).json({
        error: "Members may only change status on assigned tasks",
      });
      return;
    }
    if (status === undefined) {
      res.status(400).json({ error: "Provide status to update" });
      return;
    }
    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status },
      select: taskAssignSelect,
    });
    res.json({ task });
    return;
  }

  // Admin branch
  const data = { ...parsed.data };
  if (data.assigneeId) {
    const assigneeMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: data.assigneeId },
      },
    });
    if (!assigneeMembership) {
      res.status(400).json({
        error: "Assignee must be a member of this project",
      });
      return;
    }
  }
  const task = await prisma.task.update({
    where: { id: taskId },
    data,
    select: taskAssignSelect,
  });
  res.json({ task });
});

tasksRouter.delete("/:taskId", requireAdmin, async (req, res) => {
  const projectId = req.projectMembership!.projectId;
  const taskId = taskIdFromReq(req);
  if (!taskId) {
    res.status(400).json({ error: "Missing task ID" });
    return;
  }
  const deleted = await prisma.task.deleteMany({
    where: { id: taskId, projectId },
  });
  if (deleted.count === 0) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.status(204).send();
});
