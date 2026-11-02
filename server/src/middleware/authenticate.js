import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError.js';

export function authenticate(req, _res, next) {
  const token = req.cookies?.arna_session;
  if (!token) return next(new AppError('Please log in to continue.', 401, 'AUTH_REQUIRED'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub };
    next();
  } catch {
    next(new AppError('Your session has expired. Please log in again.', 401, 'SESSION_EXPIRED'));
  }
}
