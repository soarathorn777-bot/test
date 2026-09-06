import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env.js';
import { attachUser } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';

export function createApp() {
  const app = express();

  // Required for correct req.ip / rate limiting behind a proxy in production.
  app.set('trust proxy', env.isProd ? 1 : false);

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(attachUser);

  app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
