import env from './env.js';

export const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients (curl, health checks) that send no Origin header.
    const localDevOrigin = !env.isProd && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');
    if (!origin || env.clientOrigins.includes(origin) || localDevOrigin) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  maxAge: 600,
};
