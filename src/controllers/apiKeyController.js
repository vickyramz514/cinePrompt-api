/**
 * API Keys controller - Bridges CinePrompt User to DataCaptain ApiUser/ApiKey
 * GET /api-keys/me - Get current user's DataCaptain API key (create if needed)
 * POST /api-keys/regenerate - Create new key, deactivate old
 */

import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import { ApiUser, ApiKey } from '../datacaptain/models/index.js';
import prisma from '../utils/prisma.js';
import { encryptApiKey, decryptApiKey } from '../utils/encryptApiKey.js';
import { logger } from '../utils/logger.js';

const PREFIX = 'sdata_';

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateKey() {
  return `${PREFIX}${crypto.randomBytes(24).toString('hex')}`;
}

async function storeEncryptedKey(apiKeyId, rawKey) {
  const encrypted = encryptApiKey(rawKey);
  await prisma.apiKeySecret.upsert({
    where: { datacaptainKeyId: apiKeyId },
    create: { datacaptainKeyId: apiKeyId, encryptedValue: encrypted },
    update: { encryptedValue: encrypted },
  });
}

async function createActiveKey(apiUser) {
  const rawKey = generateKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.substring(0, 12);

  const created = await ApiKey.create({
    user_id: apiUser.id,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    name: 'Dashboard Key',
    is_active: true,
  });
  await storeEncryptedKey(created.id, rawKey);

  return { apiKey: created, rawKey, keyPrefix };
}

async function resolveFullKey(apiKey) {
  const secret = await prisma.apiKeySecret
    .findUnique({ where: { datacaptainKeyId: apiKey.id } })
    .catch(() => null);
  if (!secret?.encryptedValue) return null;
  return decryptApiKey(secret.encryptedValue);
}

/**
 * GET /api-keys/me - Return user's DataCaptain API key (JWT required)
 */
export async function getApiKey(req, res, next) {
  try {
    const { email, name } = req.user;
    if (!email) {
      return res.status(400).json({ success: false, error: { message: 'User email required' } });
    }

    let apiUser = await ApiUser.findOne({ where: { email } });
    if (!apiUser) {
      apiUser = await ApiUser.create({
        id: uuid(),
        email,
        name: name || email.split('@')[0],
        plan: 'free',
        daily_limit: 1000,
      });
    }

    let apiKey = await ApiKey.findOne({
      where: { user_id: apiUser.id, is_active: true },
      order: [['createdAt', 'DESC']],
    });

    if (!apiKey) {
      const { rawKey, keyPrefix, apiKey: created } = await createActiveKey(apiUser);
      return res.json({
        success: true,
        data: {
          key: rawKey,
          prefix: keyPrefix,
          createdAt: created.createdAt?.toISOString() || new Date().toISOString(),
        },
      });
    }

    let keyToReturn = await resolveFullKey(apiKey);

    // Legacy keys created before encrypted storage — issue a new retrievable key
    if (!keyToReturn) {
      await ApiKey.update({ is_active: false }, { where: { id: apiKey.id } });
      const rotated = await createActiveKey(apiUser);
      keyToReturn = rotated.rawKey;
      apiKey = rotated.apiKey;
      logger.info('api-keys/me rotated legacy key without stored secret', { userId: apiUser.id });
    }

    res.json({
      success: true,
      data: {
        key: keyToReturn,
        prefix: apiKey.key_prefix,
        createdAt: apiKey.createdAt?.toISOString() || new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('api-keys/me failed', { message: err.message, code: err.code });
    next(err);
  }
}

/**
 * POST /api-keys/regenerate - Create new key, deactivate old
 */
export async function regenerateApiKey(req, res, next) {
  try {
    const { email, name } = req.user;
    if (!email) {
      return res.status(400).json({ success: false, error: { message: 'User email required' } });
    }

    let apiUser = await ApiUser.findOne({ where: { email } });
    if (!apiUser) {
      apiUser = await ApiUser.create({
        id: uuid(),
        email,
        name: name || email.split('@')[0],
        plan: 'free',
        daily_limit: 1000,
      });
    }

    await ApiKey.update({ is_active: false }, { where: { user_id: apiUser.id } });

    const { rawKey, keyPrefix, apiKey: created } = await createActiveKey(apiUser);

    res.json({
      success: true,
      data: {
        key: rawKey,
        prefix: keyPrefix,
        createdAt: created.createdAt?.toISOString() || new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('api-keys/regenerate failed', {
      message: err.message,
      code: err.code,
      meta: err.meta,
    });
    next(err);
  }
}
