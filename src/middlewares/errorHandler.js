/**
 * Centralized error handling middleware
 */

import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { createErrorId } from '../utils/errorId.js';
import config from '../config/index.js';
import { captureException } from '../utils/sentry.js';

const exposeDetails =
  config.nodeEnv === 'development' || process.env.EXPOSE_API_ERRORS === 'true';

export const errorHandler = (err, req, res, next) => {
  const isAppError = err instanceof AppError;
  const errorId = err.errorId || createErrorId();

  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';
  const message = isAppError ? err.message : 'Internal server error';

  logger.error(isAppError ? 'App error' : 'Unhandled error', {
    errorId,
    code,
    statusCode,
    message: err.message,
    hint: err.hint,
    prismaCode: err.code,
    path: req.path,
    method: req.method,
    ...(exposeDetails && { stack: err.stack }),
  });

  if (!isAppError || statusCode >= 500) {
    captureException(err, {
      errorId,
      code,
      path: req.path,
      method: req.method,
    });
  }

  const response = {
    success: false,
    error: {
      code,
      message,
      errorId,
      ...(err.hint && { hint: err.hint }),
      ...(err.errors && { errors: err.errors }),
      ...(exposeDetails && {
        details: err.details || err.message,
        ...(err.stack && { stack: err.stack }),
      }),
    },
  };

  res.status(statusCode).json(response);
};
