/**
 * Signed, non-expiring unsubscribe tokens so links in old emails keep working.
 */

import crypto from 'crypto';
import config from '../config/index.js';

const sign = (userId) =>
  crypto
    .createHmac('sha256', config.email.unsubscribeSecret)
    .update(`unsubscribe:${userId}`)
    .digest('base64url');

export const createUnsubscribeToken = (userId) => sign(userId);

export const verifyUnsubscribeToken = (userId, token) => {
  if (typeof userId !== 'string' || typeof token !== 'string' || !userId || !token) return false;
  const expected = Buffer.from(sign(userId));
  const actual = Buffer.from(token);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

export const buildUnsubscribeUrl = (userId) => {
  const params = new URLSearchParams({ u: userId, t: createUnsubscribeToken(userId) });
  return `${config.publicApiUrl}/v1/email/unsubscribe?${params.toString()}`;
};
