import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requireAdmin, requireProjectMember } from "../middleware/projectAccess.js";
import { userIdParam } from "../params.js";

export const projectsRouter = Router();

projectsRouter.use(authMiddleware);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
});

projectsRouter.get("/", async (req, res) => {
  const userId = req.user!.id;
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    include: {
      project: {
        include: {
          creator: { select: { id: true, name: true, email: true } },
          _count: { select: { tasks: true, members: true } },
        },
      },
    },
    orderBy: { project: { createdAt: "desc" } },
  });
  res.json({
    projects: memberships.map((m) => ({
      ...m.project,
      myRole: m.role,
      taskCount: m.project._count.tasks,
      memberCount: m.project._count.members,
    })),
  });
});

projectsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const userId = req.user!.id;
  const { name, description } = parsed.data;
  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        name,
        description: description ?? null,
        creatorId: userId,
      },
    });
    await tx.projectMember.create({
      data: { projectId: p.id, userId, role: "ADMIN" },
    });
    return p;
  });
  const full = await prisma.project.findUnique({
    where: { id: project.id },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      _count: { select: { tasks: true, members: true } },
    },
  });
  res.status(201).json({
    project: {
      ...full!,
      myRole: "ADMIN" as const,
      taskCount: full!._count.tasks,
      memberCount: full!._count.members,
    },
  });
});

projectsRouter.get("/:projectId", requireProjectMember(), async (req, res) => {
  const projectId = req.projectMembership!.projectId;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      members: {
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      },
      _count: { select: { tasks: true } },
    },
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const isAdmin = req.projectMembership!.role === "ADMIN";
  const { _count, members, ...rest } = project;
  res.json({
    project: {
      ...rest,
      myRole: req.projectMembership!.role,
      taskCount: _count.tasks,
      members: isAdmin
        ? members
        : members.map((m) => ({
            id: m.id,
            role: m.role,
            user: { id: m.user.id, name: m.user.name },
          })),
    },
  });
});

projectsRouter.patch("/:projectId", requireAdmin, async (req, res) => {
  const projectId = req.projectMembership!.projectId;
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description,
      }),
    },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      _count: { select: { tasks: true, members: true } },
    },
  });
  res.json({
    project: {
      ...project,
      myRole: "ADMIN",
      taskCount: project._count.tasks,
      memberCount: project._count.members,
    },
  });
});

projectsRouter.delete("/:projectId", requireAdmin, async (req, res) => {
  const projectId = req.projectMembership!.projectId;
  await prisma.project.delete({ where: { id: projectId } });
  res.status(204).send();
});

projectsRouter.get("/:projectId/users-to-invite", requireAdmin, async (req, res) => {
  const projectId = req.projectMembership!.projectId;
  const rawQ =
    typeof req.query.q === "string" ? req.query.q.trim() : "";
  const memberRows = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  });
  const memberIds = memberRows.map((m) => m.userId);
  const exclude =
    memberIds.length > 0 ? { id: { notIn: memberIds } } : {};

  const where =
    rawQ.length > 0
      ? {
          ...exclude,
          OR: [{ email: { contains: rawQ } }, { name: { contains: rawQ } }],
        }
      : { ...exclude };

  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, name: true },
    take: 25,
    orderBy: [{ name: "asc" }],
  });

  res.json({ users });
});

const addMemberSchema = z
  .object({
    email: z.string().email().optional(),
    userId: z.string().min(1).optional(),
    role: z.enum(["ADMIN", "MEMBER"]).optional().default("MEMBER"),
  })
  .superRefine((val, ctx) => {
    if (!val.email && !val.userId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either email or userId",
      });
    }
    if (val.email && val.userId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide only one of email or userId",
      });
    }
  });

projectsRouter.post("/:projectId/members", requireAdmin, async (req, res) => {
  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const projectId = req.projectMembership!.projectId;
  const { email, userId: bodyUserId, role } = parsed.data;
  let target =
    email !== undefined
      ? await prisma.user.findUnique({ where: { email } })
      : await prisma.user.findUnique({
          where: { id: bodyUserId },
        });
  if (!target) {
    res.status(404).json({
      error: email ? "No user with that email" : "No user with that id",
    });
    return;
  }
  try {
    const member = await prisma.projectMember.create({
      data: { projectId, userId: target.id, role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    res.status(201).json({ member });
  } catch {
    res.status(409).json({ error: "User is already a member" });
  }
});

projectsRouter.delete(
  "/:projectId/members/:userId",
  requireAdmin,
  async (req, res) => {
    const projectId = req.projectMembership!.projectId;
    const userId = userIdParam(req);
    const adminId = req.user!.id;
    if (!userId) {
      res.status(400).json({ error: "Missing user ID" });
      return;
    }
    if (userId === adminId) {
      const otherAdmin = await prisma.projectMember.findFirst({
        where: { projectId, role: "ADMIN", userId: { not: adminId } },
      });
      if (!otherAdmin) {
        res.status(400).json({
          error:
            "Transfer admin or add another admin before removing yourself",
        });
        return;
      }
    }
    await prisma.projectMember.deleteMany({
      where: { projectId, userId },
    });
    res.status(204).send();
  },
);
