import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import * as authService from "./auth.service.js";

export const authRouter = Router();

const SignupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

authRouter.post("/signup", async (req, res, next) => {
  try {
    const input = SignupSchema.parse(req.body);
    const result = await authService.signup(input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const input = LoginSchema.parse(req.body);
    const result = await authService.login(input);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.post("/logout", (_req, res) => {
  res.status(204).send();
});
