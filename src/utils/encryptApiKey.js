/**
 * Encrypt/decrypt API keys for secure storage
 * Uses AES-256-GCM
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

function getEncryptionKey() {
  const secret =
    process.env.API_KEY_ENCRYPTION_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error(
      'Set API_KEY_ENCRYPTION_SECRET, JWT_ACCESS_SECRET, or JWT_REFRESH_SECRET in .env'
    );
  }
  // scrypt derives 32 bytes from any length secret
  return crypto.scryptSync(secret, 'api-key-salt-v1', KEY_LENGTH);
}

export function encrypt(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export const encryptApiKey = encrypt;
export const decryptApiKey = decrypt;

export function decrypt(ciphertextBase64) {
  try {
    const buffer = Buffer.from(ciphertextBase64, 'base64');
    if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) return null;
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  } catch {
    return null;
  }
}
