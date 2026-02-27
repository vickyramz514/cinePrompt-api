/**
 * Admin-only middleware
 * Must run after authenticate. Allows only ADMIN or SUPER_ADMIN.
 */

import { ForbiddenError } from '../utils/errors.js';

export const adminOnly = (req, res, next) => {
  if (!req.user) {
    return next(new ForbiddenError('Authentication required'));
  }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    return next(new ForbiddenError('Admin access required'));
  }
  next();
};
