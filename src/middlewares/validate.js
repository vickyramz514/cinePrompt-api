/**
 * Validation middleware - wraps Zod schema validation
 */

import { ValidationError } from '../utils/errors.js';

export const validate = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    return next(new ValidationError('Validation failed', errors));
  }
  req.validated = parsed.data;
  next();
};
