/**
 * JWT Authentication middleware
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import prisma from '../utils/prisma.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Verify JWT access token and attach user to request
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      throw new UnauthorizedError('Access token required');
    }

    const decoded = jwt.verify(token, config.jwt.accessSecret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        credits: true,
        plan: true,
        planExpiresAt: true,
        avatar: true,
        provider: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Invalid or expired token'));
    }
    next(err);
  }
};

/**
 * Optional auth - attach user if token present, no error if missing
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, config.jwt.accessSecret);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        credits: true,
        plan: true,
        role: true,
      },
    });

    if (user) req.user = user;
    next();
  } catch {
    next();
  }
};
