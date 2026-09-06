import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { env } from '../env.js';
import { prisma } from './prisma.js';
import { unauthorized } from './errors.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

const ACCESS_TTL_SECONDS = env.ACCESS_TOKEN_TTL_MIN * 60;
const REFRESH_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export function signAccessToken(user: Pick<User, 'id' | 'email'>): string {
  const payload: AccessTokenPayload = { sub: user.id, email: user.email };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL_SECONDS });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    throw unauthorized('Invalid or expired access token');
  }
}

/** Refresh tokens are opaque random strings; only an HMAC of them is persisted. */
function hashRefreshToken(token: string): string {
  return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}

export interface SessionMeta {
  userAgent?: string | undefined;
  ip?: string | undefined;
}

export async function issueRefreshToken(userId: string, meta: SessionMeta = {}) {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(token),
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
    },
  });

  return { token, expiresAt };
}

/**
 * Validates a refresh token, revokes it, and issues a replacement (rotation).
 * A token that is already revoked is treated as a replay: every session for
 * that user is killed.
 */
export async function rotateRefreshToken(token: string, meta: SessionMeta = {}) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashRefreshToken(token) },
    include: { user: true },
  });

  if (!session) throw unauthorized('Invalid refresh token');

  if (session.revokedAt) {
    await prisma.session.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized('Refresh token reuse detected; all sessions revoked');
  }

  if (session.expiresAt < new Date()) throw unauthorized('Refresh token expired');

  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const next = await issueRefreshToken(session.userId, meta);
  return { user: session.user, ...next };
}

export async function revokeRefreshToken(token: string) {
  await prisma.session.updateMany({
    where: { tokenHash: hashRefreshToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
