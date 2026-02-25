/**
 * Google OAuth authentication service
 * Verifies ID token and finds/creates user
 */

import { OAuth2Client } from 'google-auth-library';
import prisma from '../utils/prisma.js';
import config from '../config/index.js';
import * as authService from './authService.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const client = config.google?.clientId
  ? new OAuth2Client(config.google.clientId)
  : null;

/**
 * Verify Google ID token and extract payload
 */
export const verifyGoogleToken = async (idToken) => {
  if (!client || !config.google?.clientId) {
    logger.error('Google OAuth not configured: GOOGLE_CLIENT_ID missing');
    throw new ValidationError('Google sign-in is not configured');
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.google.clientId,
    });
    return ticket.getPayload();
  } catch (err) {
    logger.warn('Google token verification failed', { error: err.message });
    throw new UnauthorizedError('Invalid or expired Google token');
  }
};

/**
 * Find or create user from Google payload, return auth tokens
 */
export const loginWithGoogle = async (idToken) => {
  const payload = await verifyGoogleToken(idToken);

  const email = payload.email?.toLowerCase();
  const name = payload.name || payload.given_name || 'User';
  const avatar = payload.picture || null;

  if (!email) {
    throw new UnauthorizedError('Google account has no email');
  }

  let user = await prisma.user.findUnique({
    where: { email },
  });

  const isNewUser = !user;

  if (user) {
    // Existing user: update provider and avatar if not set
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        provider: 'google',
        avatar: avatar || user.avatar,
        name: user.name || name,
      },
      select: {
        id: true,
        name: true,
        email: true,
        credits: true,
        plan: true,
        avatar: true,
        provider: true,
      },
    });
  } else {
    // New user: create with Google provider
    user = await prisma.user.create({
      data: {
        name,
        email,
        provider: 'google',
        avatar,
        credits: config.credits.defaultNewUser,
      },
      select: {
        id: true,
        name: true,
        email: true,
        credits: true,
        plan: true,
        avatar: true,
        provider: true,
      },
    });
  }

  const { accessToken, refreshToken } = authService.createTokens(user.id);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  logger.info('Google login success', {
    userId: user.id,
    email: user.email,
    isNewUser,
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      credits: user.credits,
      plan: user.plan,
      avatar: user.avatar,
      provider: user.provider,
    },
    accessToken,
    refreshToken,
    expiresIn: 900,
  };
};
