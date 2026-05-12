import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { HttpError } from "../../utils/http.js";

function signToken(userId: string, role: UserRole) {
  return jwt.sign({ role }, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN
  });
}

function toSafeUser(user: { id: string; name: string; email: string; role: UserRole }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

export async function signup(input: { name: string; email: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) {
    throw new HttpError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role: UserRole.CUSTOMER
    }
  });

  const token = signToken(user.id, user.role);
  return { token, user: toSafeUser(user), redirect_to: "/dashboard" };
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const validPassword = await bcrypt.compare(input.password, user.passwordHash);
  if (!validPassword) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const token = signToken(user.id, user.role);
  const redirectTo = user.role === UserRole.ADMIN ? "/admin" : "/dashboard";
  return { token, user: toSafeUser(user), redirect_to: redirectTo };
}
