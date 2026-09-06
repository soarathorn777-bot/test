import { Router } from "express";
import type { Request } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { toPublicUser } from "../lib/user.js";
import { conflict, unauthorized } from "../lib/errors.js";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
} from "../schemas/auth.js";
import {
  issueRefreshToken,
  revokeAllSessions,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  type SessionMeta,
} from "../lib/tokens.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

// Brute-force guard on the credential endpoints only.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: {
      code: "rate_limited",
      message: "Too many attempts, try again later",
    },
  },
});

const metaOf = (req: Request): SessionMeta => ({
  userAgent: req.get("user-agent") ?? undefined,
  ip: req.ip,
});

authRouter.post("/register", credentialLimiter, async (req, res) => {
  const { email, password, name } = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw conflict("An account with that email already exists");

  const user = await prisma.user.create({
    data: {
      email,
      name: name ?? null,
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  const refresh = await issueRefreshToken(user.id, metaOf(req));

  res.status(201).json({
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refresh.expiresAt,
  });
});

authRouter.post("/login", credentialLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  // Compare against a dummy hash when the user is missing so timing does not leak existence.
  const hash =
    user?.passwordHash ??
    "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidix";
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) throw unauthorized("Invalid email or password");

  const refresh = await issueRefreshToken(user.id, metaOf(req));

  res.json({
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refresh.expiresAt,
  });
});

authRouter.post("/refresh", async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);

  const {
    user,
    token: nextToken,
    expiresAt,
  } = await rotateRefreshToken(refreshToken, metaOf(req));

  res.json({
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    refreshToken: nextToken,
    refreshTokenExpiresAt: expiresAt,
  });
});

authRouter.post("/logout", async (req, res) => {
  // Logout is best-effort: a missing or already-dead token is still a success.
  const parsed = refreshSchema.safeParse(req.body);
  if (parsed.success) await revokeRefreshToken(parsed.data.refreshToken);
  res.status(204).end();
});

authRouter.post("/logout-all", requireAuth, async (req, res) => {
  await revokeAllSessions(req.user!.id);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw unauthorized("Account no longer exists");
  res.json({ user: toPublicUser(user) });
});
