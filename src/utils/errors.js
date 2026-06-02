/**
 * Custom error classes for API error handling
 */

export class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode]
   * @param {string} [code]
   * @param {{ hint?: string; errorId?: string; details?: string }} [extra]
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', extra = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.hint = extra.hint;
    this.errorId = extra.errorId;
    this.details = extra.details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(message = 'Insufficient credits') {
    super(message, 402, 'INSUFFICIENT_CREDITS');
  }
}

export class AbuseError extends AppError {
  constructor(message = 'Abuse detected', code = 'ABUSE_DETECTED') {
    super(message, 429, code);
  }
}
