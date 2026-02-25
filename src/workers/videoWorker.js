/**
 * Video generation worker - processes BullMQ jobs
 * Credit flow: Lock created before queue → On success: consume lock + deduct | On failure: release lock
 * Supports Runway (primary) and Replicate (fallback)
 */

import { Worker } from 'bullmq';
import config from '../config/index.js';
import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import {
  createVideoPrediction,
  waitForPrediction,
  fetchVideoFromUrl,
} from '../services/replicateService.js';
import {
  createGeneration,
  pollUntilComplete,
  downloadVideo,
  isConfigured as isRunwayConfigured,
} from '../services/runwayService.js';
import {
  uploadVideo,
  getCdnUrl,
} from '../services/storageService.js';
import { consumeCreditLock, releaseCreditLock } from '../middlewares/creditGuard.js';
import { logApiCost, calculateJobCost } from '../services/costService.js';
import { getCreditCost } from '../services/creditService.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

const useRunway = () => isRunwayConfigured();

const processJob = async (job) => {
  const { jobId, userId, prompt, metadata } = job.data;
  const creditCost = getCreditCost();
  const provider = useRunway() ? 'runway' : 'replicate';

  logger.info('Processing video job', { jobId, userId, provider });

  try {
    await prisma.videoJob.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        progress: 5,
        provider: provider.toUpperCase(),
        processingStartedAt: new Date(),
      },
    });

    let videoUrl;
    let storageKey;

    if (useRunway()) {
      const { taskId } = await createGeneration(prompt, {
        duration: metadata?.duration ?? 5,
        aspectRatio: metadata?.aspectRatio ?? '16:9',
      });

      await prisma.videoJob.update({
        where: { id: jobId },
        data: { runwayId: taskId, progress: 10 },
      });

      const { output } = await pollUntilComplete(taskId, async (progress) => {
        await prisma.videoJob.update({
          where: { id: jobId },
          data: { progress: Math.min(95, 10 + Math.round(progress * 0.85)) },
        });
      });

      const rawUrl = Array.isArray(output) ? output[0] : output;
      if (!rawUrl) throw new Error('No video output from Runway');

      const videoBuffer = await downloadVideo(rawUrl);
      storageKey = `videos/${userId}/${jobId}.mp4`;

      try {
        await uploadVideo(videoBuffer, storageKey);
        videoUrl = getCdnUrl(storageKey) || storageKey;
      } catch (storageErr) {
        logger.warn('Storage upload failed, storing Runway URL', {
          jobId,
          error: storageErr.message,
        });
        storageKey = rawUrl;
        videoUrl = rawUrl;
      }
    } else if (config.replicate.apiToken) {
      const prediction = await createVideoPrediction(prompt, metadata);

      await prisma.videoJob.update({
        where: { id: jobId },
        data: { replicateId: prediction.id, progress: 10 },
      });

      const result = await waitForPrediction(
        prediction.id,
        async (p) => {
          const progress = p.logs ? Math.min(90, 10 + (p.logs.length || 0) * 5) : 20;
          await prisma.videoJob.update({
            where: { id: jobId },
            data: { progress },
          });
        }
      );

      const outputUrl = result.output;
      const rawUrl = Array.isArray(outputUrl) ? outputUrl[0] : outputUrl;

      if (!rawUrl) throw new Error('No video output from Replicate');

      storageKey = `videos/${userId}/${jobId}.mp4`;

      try {
        const videoBuffer = await fetchVideoFromUrl(rawUrl);
        await uploadVideo(videoBuffer, storageKey);
        videoUrl = getCdnUrl(storageKey) || storageKey;
      } catch (storageErr) {
        logger.warn('Storage upload failed, storing URL', {
          jobId,
          error: storageErr.message,
        });
        storageKey = rawUrl;
        videoUrl = rawUrl;
      }
    } else {
      await new Promise((r) => setTimeout(r, 5000));
      storageKey = `videos/${userId}/${jobId}.mp4`;
      videoUrl = getCdnUrl(storageKey) || storageKey;
    }

    const cost = calculateJobCost(creditCost, provider);
    const updateData = {
      status: 'COMPLETED',
      progress: 100,
      videoUrl,
      storageKey,
      creditsUsed: creditCost,
      cost,
      completedAt: new Date(),
      processingCompletedAt: new Date(),
    };
    if (getCdnUrl(storageKey)) {
      updateData.cdnUrl = getCdnUrl(storageKey);
    }

    await prisma.videoJob.update({
      where: { id: jobId },
      data: updateData,
    });

    await consumeCreditLock(jobId);
    await logApiCost(userId, jobId, provider, creditCost, cost);

    logger.info('Video job completed', { jobId, userId, provider });
  } catch (err) {
    logger.error('Video job failed', { jobId, userId, error: err.message });

    await prisma.videoJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        error: err.message,
      },
    });

    await releaseCreditLock(jobId);
    throw err;
  }
};

const timeoutMs = config.runway?.timeoutMs ?? 600000;

const worker = new Worker('video-generation', processJob, {
  connection,
  concurrency: useRunway() ? 3 : 2,
  lockDuration: timeoutMs + 60000,
  stalledInterval: 60000,
  maxStalledCount: 2,
});

worker.on('completed', (job) => {
  logger.info('Worker job completed', { jobId: job?.id });
});

worker.on('failed', (job, err) => {
  logger.error('Worker job failed', { jobId: job?.id, error: err?.message });
  if (job?.data?.jobId) {
    releaseCreditLock(job.data.jobId).catch(() => {});
  }
});

worker.on('error', (err) => {
  logger.error('Worker error', { error: err.message });
});

logger.info('Video worker started');
