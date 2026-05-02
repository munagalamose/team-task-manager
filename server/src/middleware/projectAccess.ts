import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { projectIdFromReq } from "../params.js";
import type { ProjectRole } from "@prisma/client";

async function membershipFor(userId: string, projectId: string) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true, projectId: true },
  });
}

export function requireProjectMember(role?: ProjectRole): RequestHandler {
  return async (req, res, next) => {
    const projectId = projectIdFromReq(req);
    const userId = req.user?.id;
    if (!userId || !projectId) {
      res.status(400).json({ error: "Missing project ID" });
      return;
    }
    const membership = await membershipFor(userId, projectId);
    if (!membership) {
      res.status(403).json({ error: "Not a member of this project" });
      return;
    }
    if (role && membership.role !== role) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    req.projectMembership = membership;
    next();
  };
}

export const requireAdmin: RequestHandler = requireProjectMember("ADMIN");
