/**
 * Storage service - S3 / Cloudflare R2 compatible
 * Upload videos, generate signed download URLs
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';

const isStorageConfigured = () =>
  config.storage.accessKeyId && config.storage.secretAccessKey;

const getClient = () => {
  if (!isStorageConfigured()) {
    throw new Error('Storage not configured - set STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY');
  }

  const clientConfig = {
    region: config.storage.region,
    credentials: {
      accessKeyId: config.storage.accessKeyId,
      secretAccessKey: config.storage.secretAccessKey,
    },
  };

  if (config.storage.endpoint) {
    clientConfig.endpoint = config.storage.endpoint;
    clientConfig.forcePathStyle = true;
  }

  return new S3Client(clientConfig);
};

/**
 * Upload video buffer to storage
 * @returns storage key for retrieval
 */
export const uploadVideo = async (buffer, key, contentType = 'video/mp4') => {
  const client = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  logger.info('Video uploaded', { key });
  return key;
};

/**
 * Generate signed download URL (expires in 1 hour default)
 */
export const getSignedDownloadUrl = async (key) => {
  const client = getClient();

  const command = new GetObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
  });

  const url = await getSignedUrl(client, command, {
    expiresIn: config.storage.signedUrlExpiry,
  });

  return url;
};

/**
 * Get CDN URL for a storage key (if CDN_BASE_URL configured)
 * Otherwise returns null - caller should use getSignedDownloadUrl
 */
export const getCdnUrl = (key) => {
  if (!config.storage.cdnBaseUrl || !key) return null;
  const base = config.storage.cdnBaseUrl.replace(/\/$/, '');
  const path = key.startsWith('/') ? key : `/${key}`;
  return `${base}${path}`;
};

/**
 * Delete video from storage
 */
export const deleteVideo = async (key) => {
  const client = getClient();

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
    })
  );

  logger.info('Video deleted', { key });
};
