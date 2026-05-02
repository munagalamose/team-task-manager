import type { Request } from "express";

export function projectIdFromReq(req: Request): string | null {
  const p = req.params.projectId;
  if (typeof p === "string" && p) return p;
  if (Array.isArray(p) && p[0]) return p[0];
  return null;
}

export function taskIdFromReq(req: Request): string | null {
  const p = req.params.taskId;
  if (typeof p === "string" && p) return p;
  if (Array.isArray(p) && p[0]) return p[0];
  return null;
}

export function userIdParam(req: Request, key = "userId"): string | null {
  const p = req.params[key];
  if (typeof p === "string" && p) return p;
  if (Array.isArray(p) && p[0]) return p[0];
  return null;
}
