import crypto from 'crypto';

/** Short id for correlating client errors with Railway logs */
export function createErrorId() {
  return crypto.randomBytes(6).toString('hex');
}
