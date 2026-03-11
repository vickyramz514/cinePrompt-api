/**
 * Minimax Seedance v2 Video Worker
 * Processes BullMQ jobs: create → poll → download → upload S3 → deduct credits
 */

import config from '../config/index.js';
import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import {
  createMinimaxJob,
  pollUntilComplete,
  downloadVideo,
  calculateCost,
} from '../services/minimaxService.js';
import {
  uploadVideo,
  getCdnUrl,
  getSignedDownloadUrl,
} from '../services/storageService.js';
import { consumeCreditLock, releaseCreditLock } from '../middlewares/creditGuard.js';
import { logApiCost } from '../services/costService.js';

/**
 * Process a single Minimax video job
 * @param {object} jobData - { jobId, userId, prompt, metadata }
 * @returns {Promise<void>}
 */
export const processMinimaxJob = async (jobData) => {
  const { jobId, userId, prompt, metadata } = jobData;

  const videoJob = await prisma.videoJob.findUnique({
    where: { id: jobId },
    select: { creditsCost: true, duration: true },
  });

  const durationSec = videoJob?.duration ?? metadata?.duration ?? 5;
  const creditsCost = videoJob?.creditsCost ?? durationSec * (config.minimax?.creditsPerSecond ?? 5);

  logger.info('Processing Minimax video job', { jobId, userId });

  try {
    await prisma.videoJob.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        progress: 5,
        provider: 'MINIMAX',
        processingStartedAt: new Date(),
      },
    });

    const { id: externalJobId } = await createMinimaxJob(prompt, {
      duration: durationSec,
      ratio: metadata?.aspectRatio ?? metadata?.ratio ?? '16:9',
      generate_audio: metadata?.generate_audio ?? false,
    });

    await prisma.videoJob.update({
      where: { id: jobId },
      data: {
        externalJobId,
        providerStatus: 'queued',
        progress: 10,
      },
    });

    const { result_urls } = await pollUntilComplete(externalJobId, async (status, progress) => {
      await prisma.videoJob.update({
        where: { id: jobId },
        data: {
          providerStatus: status,
          progress: Math.min(95, 10 + Math.round(progress * 0.85)),
        },
      });
    });

    const videoUrl = Array.isArray(result_urls) ? result_urls[0] : result_urls;
    if (!videoUrl) throw new Error('No video output from Minimax');

    const videoBuffer = await downloadVideo(videoUrl);
    let storageKey = `videos/${userId}/${jobId}.mp4`;
    let finalVideoUrl;
    let uploadedToStorage = false;

    try {
      await uploadVideo(videoBuffer, storageKey);
      uploadedToStorage = true;
      finalVideoUrl = getCdnUrl(storageKey) || (await getSignedDownloadUrl(storageKey));
    } catch (err) {
      logger.warn('Storage upload failed, storing Minimax URL', {
        jobId,
        error: err.message,
      });
      storageKey = videoUrl;
      finalVideoUrl = videoUrl;
    }

    const providerCostUsd = calculateCost(durationSec);

    const updateData = {
      status: 'COMPLETED',
      progress: 100,
      videoUrl: finalVideoUrl,
      storageKey,
      creditsUsed: creditsCost,
      cost: providerCostUsd,
      providerCost: providerCostUsd,
      providerStatus: 'completed',
      videoDurationSec: durationSec,
      videoResolution: '720p',
      completedAt: new Date(),
      processingCompletedAt: new Date(),
    };

    if (uploadedToStorage && getCdnUrl(storageKey)) {
      updateData.cdnUrl = getCdnUrl(storageKey);
    }

    await prisma.videoJob.update({
      where: { id: jobId },
      data: updateData,
    });

    await consumeCreditLock(jobId);
    await logApiCost(userId, jobId, 'minimax', durationSec, providerCostUsd);

    logger.info('Minimax video job completed', { jobId, userId });
  } catch (err) {
    logger.error('Minimax video job failed', { jobId, userId, error: err.message });

    await prisma.videoJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        error: err.message,
        providerStatus: 'failed',
      },
    });

    await releaseCreditLock(jobId);
    throw err;
  }
};

export { isMinimaxConfigured } from '../services/minimaxService.js';
