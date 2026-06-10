/**
 * Auth controller - signup, login, refresh, me, google
 */

import * as authService from '../services/authService.js';
import * as googleAuthService from '../services/googleAuthService.js';
import { ValidationError } from '../utils/errors.js';
import { signupSchema, loginSchema, refreshTokenSchema, googleTokenSchema } from '../utils/validators.js';

export const signup = async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.errors);
    }

    const result = await authService.signup(parsed.data);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.errors);
    }

    const result = await authService.login(parsed.data.email, parsed.data.password);
    const { trackEvent } = await import('../services/growthAnalyticsService.js');
    trackEvent('login', result.user.id, {}).catch(() => {});
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.errors);
    }

    const result = await authService.refreshAccessToken(parsed.data.refreshToken);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const me = async (req, res, next) => {
  try {
    const { enrichUserWithEffectivePlan } = await import('../utils/userPlanEnrichment.js');
    const user = await enrichUserWithEffectivePlan(req.user);
    res.json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

export const google = async (req, res, next) => {
  try {
    const parsed = googleTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.errors);
    }

    const result = await googleAuthService.loginWithGoogle(parsed.data.credential);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
