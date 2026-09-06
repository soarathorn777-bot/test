import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { toPublicUser } from '../lib/user.js';
import { conflict, unauthorized } from '../lib/errors.js';
import { changePasswordSchema, updateProfileSchema } from '../schemas/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { revokeAllSessions } from '../lib/tokens.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get('/me', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw unauthorized('Account no longer exists');
  res.json({ user: toPublicUser(user) });
});

usersRouter.patch('/me', async (req, res) => {
  const data = updateProfileSchema.parse(req.body);

  if (data.email) {
    const taken = await prisma.user.findUnique({ where: { email: data.email } });
    if (taken && taken.id !== req.user!.id) throw conflict('That email is already in use');
  }

  const user = await prisma.user.update({ where: { id: req.user!.id }, data });
  res.json({ user: toPublicUser(user) });
});

usersRouter.post('/me/password', async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw unauthorized('Account no longer exists');

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw unauthorized('Current password is incorrect');

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) },
  });

  // Changing the password invalidates every existing session, including this one.
  await revokeAllSessions(user.id);

  res.status(204).end();
});
