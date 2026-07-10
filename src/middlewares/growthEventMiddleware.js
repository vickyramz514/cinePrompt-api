/**
 * Growth Event Middleware - auto-track key events
 */

import { trackEvent } from '../services/growthAnalyticsService.js';

export const trackSignup = () => (req, res, next) => {
  if (res.locals?.userId) {
    trackEvent('signup', res.locals.userId, {}).catch(() => {});
  }
  next();
};

export const trackLogin = (req, res, next) => {
  if (req.user?.id) {
    trackEvent('login', req.user.id, {}).catch(() => {});
  }
  next();
};
