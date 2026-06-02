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
import { createErrorId } from '../utils/errorId.js';
import { AppError } from '../utils/errors.js';
import { mapApiKeyError } from '../utils/mapApiKeyError.js';
import { logger } from '../utils/logger.js';
import { syncApiUserPlanFromUser } from '../utils/syncApiUserPlan.js';
import { dailyLimitForPlan } from '../datacaptain/config/planAccess.js';

const PREFIX = 'sdata_';

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateKey() {
  return `${PREFIX}${crypto.randomBytes(24).toString('hex')}`;
}

async function storeEncryptedKey(apiKeyId, rawKey) {
  let encrypted;
  try {
    encrypted = encryptApiKey(rawKey);
  } catch (err) {
    const mapped = mapApiKeyError(err);
    if (mapped) throw mapped;
    throw err;
  }
  try {
    await prisma.apiKeySecret.upsert({
      where: { datacaptainKeyId: apiKeyId },
      create: { datacaptainKeyId: apiKeyId, encryptedValue: encrypted },
      update: { encryptedValue: encrypted },
    });
  } catch (err) {
    const mapped = mapApiKeyError(err);
    if (mapped) throw mapped;
    throw err;
  }
}

function handleApiKeyRouteError(err, route, next) {
  const errorId = createErrorId();

  logger.error(`${route} failed`, {
    errorId,
    message: err?.message,
    code: err?.code,
    name: err?.name,
    prismaCode: err?.code,
    stack: err?.stack,
  });

  if (err instanceof AppError) {
    if (!err.errorId) err.errorId = errorId;
    return next(err);
  }

  const mapped = mapApiKeyError(err);
  if (mapped) {
    mapped.errorId = errorId;
    return next(mapped);
  }

  const fallback = new AppError('Failed to manage API key.', 500, 'API_KEY_ERROR', {
    errorId,
    hint: 'Check Railway deploy logs for this errorId. Often: run prisma migrate deploy and set API_KEY_ENCRYPTION_SECRET.',
    ...(process.env.EXPOSE_API_ERRORS === 'true' && { details: err?.message }),
  });
  next(fallback);
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
    const planSlug = (req.user?.plan && String(req.user.plan).toLowerCase()) || 'free';
    const dailyLimit = dailyLimitForPlan(planSlug);
    if (!apiUser) {
      apiUser = await ApiUser.create({
        id: uuid(),
        email,
        name: name || email.split('@')[0],
        plan: planSlug,
        daily_limit: dailyLimit,
      });
    } else {
      await syncApiUserPlanFromUser({ email, plan: req.user?.plan });
      await apiUser.reload();
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
    handleApiKeyRouteError(err, 'api-keys/me', next);
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
    const planSlug = (req.user?.plan && String(req.user.plan).toLowerCase()) || 'free';
    const dailyLimit = dailyLimitForPlan(planSlug);
    if (!apiUser) {
      apiUser = await ApiUser.create({
        id: uuid(),
        email,
        name: name || email.split('@')[0],
        plan: planSlug,
        daily_limit: dailyLimit,
      });
    } else {
      await syncApiUserPlanFromUser({ email, plan: req.user?.plan });
      await apiUser.reload();
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
    handleApiKeyRouteError(err, 'api-keys/regenerate', next);
  }
}
