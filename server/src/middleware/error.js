import env from '../config/env.js';
import AppError from '../utils/AppError.js';

export function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';

  if (err.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'CastError') {
    status = 400;
    code = 'INVALID_ID';
    message = 'Invalid identifier';
  } else if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    message = 'That value already exists';
  } else if (err.message?.includes('not allowed by CORS')) {
    status = 403;
    code = 'CORS_DENIED';
  }

  if (status >= 500 && !err.isOperational) {
    console.error(`[${env.appName}]`, err);
    if (env.isProd) message = 'Internal server error';
  }

  res.status(status).json({
    success: false,
    error: { code, message },
    ...(env.isProd || err.isOperational ? {} : { stack: status >= 500 ? err.stack : undefined }),
  });
}
