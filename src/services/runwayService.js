/**
 * Runway API service - Text-to-video generation
 * Methods: createGeneration, checkStatus, downloadVideo
 * Safe retry + timeout handling
 */

import RunwayML, { TaskFailedError, TaskTimedOutError } from '@runwayml/sdk';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';

const isConfigured = () => !!config.runway.apiSecret;

const getClient = () => {
  if (!isConfigured()) {
    throw new Error('Runway not configured - set RUNWAY_API_SECRET');
  }
  return new RunwayML({
    apiKey: config.runway.apiSecret,
  });
};

/**
 * Map aspect ratio to Runway ratio
 * @param {string} aspectRatio - '16:9' | '9:16' | '1:1'
 * @returns {'1280:720' | '720:1280'}
 */
const mapRatio = (aspectRatio) => {
  const map = {
    '16:9': '1280:720',
    '9:16': '720:1280',
    '1:1': '1280:720', // Runway gen4.5 text-to-video only supports 1280:720 | 720:1280
  };
  return map[aspectRatio] || '1280:720';
};

/**
 * Create a text-to-video generation task
 * @param {string} prompt - Text prompt
 * @param {object} options - { duration, aspectRatio, negativePrompt?, seed? }
 * @returns {Promise<{ taskId: string }>}
 */
export const createGeneration = async (prompt, options = {}) => {
  const client = getClient();
  const duration = Math.min(
    Math.max(2, options.duration ?? 5),
    10
  );
  const ratio = mapRatio(options.aspectRatio || '16:9');

  const params = {
    model: config.runway.model,
    promptText: prompt,
    duration,
    ratio,
  };
  if (options.seed != null) params.seed = options.seed;

  const response = await client.textToVideo.create(params);
  const taskId = response.id;

  logger.info('Runway task created', { taskId, duration, ratio });
  return { taskId };
};

/**
 * Check task status (poll Runway API)
 * @param {string} taskId - Runway task ID
 * @returns {Promise<{ status: string, progress?: number, output?: string[], failure?: string, failureCode?: string }>}
 */
export const checkStatus = async (taskId) => {
  const client = getClient();
  const task = await client.tasks.retrieve(taskId);

  const result = {
    status: task.status,
  };

  if (task.status === 'RUNNING' && typeof task.progress === 'number') {
    result.progress = task.progress;
  }
  if (task.status === 'SUCCEEDED' && Array.isArray(task.output)) {
    result.output = task.output;
  }
  if (task.status === 'FAILED') {
    result.failure = task.failure;
    result.failureCode = task.failureCode;
  }

  return result;
};

/**
 * Poll until task completes or times out
 * @param {string} taskId - Runway task ID
 * @param {function} onProgress - (progress: number) => Promise<void> - called every poll
 * @returns {Promise<{ output: string[] }>}
 */
export const pollUntilComplete = async (taskId, onProgress) => {
  const timeoutMs = config.runway.timeoutMs;
  const pollIntervalMs = config.runway.pollIntervalMs;
  const start = Date.now();

  const reportProgress = async (result) => {
    const p = result.progress ?? (['PENDING', 'THROTTLED'].includes(result.status) ? 5 : 50);
    if (typeof onProgress === 'function') await onProgress(p);
  };

  while (true) {
    if (Date.now() - start >= timeoutMs) {
      throw new TaskTimedOutError(`Runway task ${taskId} timed out after ${timeoutMs}ms`);
    }

    const result = await checkStatus(taskId);

    switch (result.status) {
      case 'SUCCEEDED':
        if (result.output?.length) return { output: result.output };
        throw new Error('Runway task succeeded but no output');
      case 'FAILED': {
        const err = new TaskFailedError(result.failure || 'Task failed');
        err.taskDetails = { failureCode: result.failureCode, failure: result.failure };
        throw err;
      }
      case 'CANCELLED':
        throw new Error('Runway task was cancelled');
      default:
        await reportProgress(result);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
};

/**
 * Download video from URL (Runway output URLs expire in 24-48h)
 * @param {string} url - Video URL from Runway output
 * @returns {Promise<Buffer>}
 */
export const downloadVideo = async (url) => {
  const controller = new AbortController();
  const timeout = 60000; // 60s download timeout
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CinePrompt/1.0' },
    });
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return buf;
  } finally {
    clearTimeout(id);
  }
};

export { isConfigured };
