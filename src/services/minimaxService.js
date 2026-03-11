/**
 * Minimax Seedance v2 Video API (CCAPI)
 * Docs: https://docs.ccapi.ai/seedance-v2-create-video
 * Create job, poll status, download video
 */

import config from '../config/index.js';
import { logger } from '../utils/logger.js';

const isConfigured = () => !!config.minimax?.apiKey;

const getBaseUrl = () => {
  const base = config.minimax?.baseUrl || 'https://api.ccapi.ai';
  return base.replace(/\/$/, '');
};

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${config.minimax.apiKey}`,
});

/**
 * Create Minimax Seedance v2 video generation job
 * @param {string} prompt
 * @param {object} options - { duration, ratio, image?, image_tail?, generate_audio? }
 * @returns {Promise<{ id: string, status: string }>}
 */
export const createMinimaxJob = async (prompt, options = {}) => {
  if (!isConfigured()) {
    throw new Error('Minimax not configured - set MINIMAX_API_KEY');
  }

  const duration = Math.min(
    Math.max(4, Number(options.duration) || 5),
    15
  ).toString();

  const body = {
    model: config.minimax.model,
    prompt: String(prompt).slice(0, 1000),
    duration,
    ratio: options.ratio || options.aspectRatio || '16:9',
  };

  if (options.image) body.image = options.image;
  if (options.image_tail) body.image_tail = options.image_tail;
  if (options.generate_audio !== undefined) body.generate_audio = options.generate_audio;

  const url = `${getBaseUrl()}/api/v1/video/generations`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errMsg = data?.error?.message || data?.message || res.statusText;
    const err = new Error(`Minimax API error: ${errMsg}`);
    err.statusCode = res.status;
    err.response = data;
    throw err;
  }

  const id = data.id || data.task_id;
  if (!id) throw new Error('Minimax API did not return job id');

  logger.info('Minimax job created', { id, status: data.status || 'queued' });
  return {
    id,
    status: data.status || 'queued',
    raw: data,
  };
};

/**
 * Poll Minimax job status
 * @param {string} jobId - External job ID
 * @returns {Promise<{ status: string, result_urls?: string[], error?: string, raw?: object }>}
 */
export const pollMinimaxStatus = async (jobId) => {
  if (!isConfigured()) {
    throw new Error('Minimax not configured - set MINIMAX_API_KEY');
  }

  const url = `${getBaseUrl()}/api/v1/video/generations/${jobId}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errMsg = data?.error?.message || data?.message || res.statusText;
    const err = new Error(`Minimax status error: ${errMsg}`);
    err.statusCode = res.status;
    err.response = data;
    throw err;
  }

  const status = data.status || data.task_status || 'unknown';
  const result = {
    status,
    raw: data,
  };

  if (status === 'completed' || status === 'success') {
    const urls = data.result_urls || data.result?.urls || data.output || data.result?.video_url;
    result.result_urls = Array.isArray(urls) ? urls : urls ? [urls] : [];
  }

  if (status === 'failed' || status === 'error') {
    result.error = data.error?.message || data.message || data.failure || 'Unknown failure';
  }

  return result;
};

/**
 * Poll until job completes or times out
 * @param {string} jobId
 * @param {function} onProgress - (status, progress) => Promise<void>
 * @returns {Promise<{ result_urls: string[], duration?: number }>}
 */
export const pollUntilComplete = async (jobId, onProgress) => {
  const timeoutMs = config.minimax?.timeoutMs ?? 600000;
  const pollIntervalMs = config.minimax?.pollIntervalMs ?? 7000;
  const start = Date.now();

  while (true) {
    if (Date.now() - start >= timeoutMs) {
      throw new Error(`Minimax job ${jobId} timed out after ${timeoutMs}ms`);
    }

    const result = await pollMinimaxStatus(jobId);
    const progress = ['queued', 'processing'].includes(result.status) ? 50 : 100;

    if (typeof onProgress === 'function') {
      await onProgress(result.status, progress);
    }

    if (result.status === 'completed' || result.status === 'success') {
      if (result.result_urls?.length) {
        return {
          result_urls: result.result_urls,
          duration: result.raw?.duration ?? result.raw?.video_duration,
        };
      }
      throw new Error('Minimax job completed but no result URLs');
    }

    if (result.status === 'failed' || result.status === 'error') {
      throw new Error(result.error || 'Minimax job failed');
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
};

/**
 * Download video from URL
 * @param {string} videoUrl
 * @returns {Promise<Buffer>}
 */
export const downloadVideo = async (videoUrl) => {
  const controller = new AbortController();
  const timeout = 120000; // 2 min for larger files
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(videoUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CinePrompt/1.0' },
    });
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(id);
  }
};

/**
 * Calculate credits for duration (1 second = 5 credits)
 */
export const calculateCredits = (seconds) => {
  const rate = config.minimax?.creditsPerSecond ?? 5;
  return Math.ceil((seconds || 5) * rate);
};

/**
 * Calculate provider cost (1 second = $0.04)
 */
export const calculateCost = (seconds) => {
  const rate = config.minimax?.costPerSecondUsd ?? 0.04;
  return (seconds || 5) * rate;
};

/**
 * Normalize provider response for storage
 */
export const normalizeResponse = (raw) => {
  if (!raw) return null;
  return {
    status: raw.status,
    result_urls: raw.result_urls || raw.result?.urls,
    duration: raw.duration ?? raw.video_duration,
    error: raw.error?.message || raw.message,
  };
};

export { isConfigured };
