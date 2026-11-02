import rateLimit from 'express-rate-limit';

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message } },
  });

export const globalLimiter = make(15 * 60 * 1000, 600, 'Too many requests, please slow down.');
export const aiLimiter = make(60 * 1000, 30, 'You are sending messages too quickly. Please wait a moment.');
