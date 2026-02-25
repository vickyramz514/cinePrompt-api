/**
 * Replicate API integration for AI video generation
 * Handles prediction creation, polling, timeout, retries
 */

import Replicate from 'replicate';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';

const replicate = config.replicate.apiToken
  ? new Replicate({ auth: config.replicate.apiToken })
  : null;

/**
 * Create video generation prediction
 * Supports text-to-video models: google/veo-3-fast, pixverse/pixverse-v4, etc.
 */
export const createVideoPrediction = async (prompt, options = {}) => {
  if (!replicate) {
    throw new Error('Replicate API token not configured');
  }

  const model = config.replicate.model || 'google/veo-3-fast';

  const input = {
    prompt,
    ...options,
  };

  const prediction = await replicate.predictions.create({
    model,
    input,
  });

  logger.info('Replicate prediction created', {
    id: prediction.id,
    status: prediction.status,
  });

  return prediction;
};

/**
 * Get prediction status
 */
export const getPrediction = async (predictionId) => {
  if (!replicate) {
    throw new Error('Replicate API token not configured');
  }

  return replicate.predictions.get(predictionId);
};

/**
 * Poll until complete or failed/timeout
 */
export const waitForPrediction = async (predictionId, onProgress) => {
  const startTime = Date.now();
  const timeout = config.replicate.timeoutMs;
  const pollInterval = config.replicate.pollIntervalMs;

  while (true) {
    const prediction = await getPrediction(predictionId);

    if (onProgress && prediction.logs) {
      onProgress(prediction);
    }

    if (prediction.status === 'succeeded') {
      return prediction;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(prediction.error || `Prediction ${prediction.status}`);
    }

    if (Date.now() - startTime > timeout) {
      throw new Error('Prediction timeout');
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }
};

/**
 * Fetch output video as buffer from URL
 */
export const fetchVideoFromUrl = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
};
