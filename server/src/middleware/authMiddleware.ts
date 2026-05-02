import type { RequestHandler } from "express";
import { verifyToken } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import type { ProjectRole } from "@prisma/client";

export type AuthedUser = {
  id: string;
  email: string;
  name: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
      projectMembership?: { role: ProjectRole; projectId: string };
    }
  }
}

export const authMiddleware: RequestHandler = async (req, res, next) => {
  const auth = req.headers.authorization;
  const token =
    auth?.startsWith("Bearer ") ? auth.slice(7).trim() : undefined;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload?.sub) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  req.user = user;
  next();
};
