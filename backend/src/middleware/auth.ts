import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { HttpError } from "../utils/http.js";

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
  name: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

type JwtPayload = {
  sub: string;
  role: UserRole;
};

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new HttpError(401, "UNAUTHENTICATED", "Authentication token is required.");
    }

    const token = header.replace("Bearer ", "");
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new HttpError(401, "UNAUTHENTICATED", "User no longer exists.");
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    };
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "INVALID_TOKEN", "Invalid or expired token."));
  }
}

export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new HttpError(401, "UNAUTHENTICATED", "Authentication is required."));
    }
    if (req.user.role !== role) {
      return next(new HttpError(403, "FORBIDDEN", "You do not have permission to access this resource."));
    }
    next();
  };
}
