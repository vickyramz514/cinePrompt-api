/**
 * Authentication service - signup, login, token management
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../utils/prisma.js';
import config from '../config/index.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';

const SALT_ROUNDS = 12;

export const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
export const comparePassword = (plain, hashed) => bcrypt.compare(plain, hashed);

export const createTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiry }
  );

  const refreshToken = jwt.sign(
    { userId, jti: uuidv4() },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry }
  );

  return { accessToken, refreshToken };
};

export const signup = async (data) => {
  const existing = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });

  if (existing) {
    if (existing.provider === 'google') {
      throw new ValidationError('Email already registered with Google. Please sign in with Google.');
    }
    throw new ValidationError('Email already registered');
  }

  const hashedPassword = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      credits: config.credits.defaultNewUser,
    },
    select: {
      id: true,
      name: true,
      email: true,
      credits: true,
      plan: true,
      role: true,
      createdAt: true,
    },
  });

  if (data.referralCode?.trim()) {
    const { applyReferralCode } = await import('./referralService.js');
    try {
      await applyReferralCode(user.id, data.referralCode.trim());
      const updated = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, email: true, credits: true, plan: true, role: true, createdAt: true },
      });
      if (updated) Object.assign(user, updated);
    } catch {
      // Ignore referral errors (invalid code, etc.)
    }
  }

  const { trackEvent } = await import('./growthAnalyticsService.js');
  trackEvent('signup', user.id, {}).catch(() => {});

  const { accessToken, refreshToken } = createTokens(user.id);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    user,
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 min in seconds
  };
};

export const login = async (email, password) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.provider === 'google') {
    throw new UnauthorizedError('Please sign in with Google');
  }

  if (!user.password || !(await comparePassword(password, user.password))) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const { accessToken, refreshToken } = createTokens(user.id);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      credits: user.credits,
      plan: user.plan,
      role: user.role,
    },
    accessToken,
    refreshToken,
    expiresIn: 900,
  };
};

export const refreshAccessToken = async (refreshToken) => {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  try {
    jwt.verify(refreshToken, config.jwt.refreshSecret);
  } catch {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new UnauthorizedError('Invalid refresh token');
  }

  const { accessToken, refreshToken: newRefreshToken } = createTokens(stored.userId);

  await prisma.refreshToken.delete({ where: { id: stored.id } });
  await prisma.refreshToken.create({
    data: {
      token: newRefreshToken,
      userId: stored.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: 900,
  };
};
