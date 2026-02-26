/**
 * Centralized error handling middleware
 */

import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import config from '../config/index.js';

export const errorHandler = (err, req, res, next) => {
  const isAppError = err instanceof AppError;

  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';
  const message = isAppError ? err.message : 'Internal server error';

  if (!isAppError && statusCode === 500) {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  const response = {
    success: false,
    error: {
      code,
      message,
      ...(err.errors && { errors: err.errors }),
      ...(config.nodeEnv === 'development' && !isAppError && {
        details: err.message,
        stack: err.stack,
      }),
    },
  };

  res.status(statusCode).json(response);
};
