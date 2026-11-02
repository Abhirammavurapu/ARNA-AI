import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import env from './config/env.js';
import { corsOptions } from './config/cors.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { notFound, errorHandler } from './middleware/error.js';
import statusRoutes from './routes/status.js';
import chatRoutes from './routes/chat.js';
import authRoutes from './routes/auth.js';

import liveRoutes from './routes/live.js';

export function createApp() {
  const app = express();

  // Render and Vercel sit behind proxies; needed for correct client IPs.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors(corsOptions));
  // Chat bodies may carry a few base64 images.
  app.use(express.json({ limit: '20mb' }));
  app.use(cookieParser());
  app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.use('/api', globalLimiter);
  app.use('/api/status', statusRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);
app.use('/api/live', liveRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
