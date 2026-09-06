import { Request, Response } from "express";
import { asyncHandler, HttpError } from "../middleware/error.middleware";
import * as authService from "../services/auth.service";
import { findUserById, toPublicUser } from "../services/user.service";

export const registerHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  res.status(201).json(result);
});

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  res.status(200).json(result);
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await findUserById(req.user!.userId);
  if (!user) {
    throw new HttpError(404, "User not found");
  }
  res.status(200).json({ user: toPublicUser(user) });
});

export const logoutHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ message: "Logged out" });
});
