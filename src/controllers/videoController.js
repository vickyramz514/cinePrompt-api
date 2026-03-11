/**
 * Video controller - generate, history, get by id
 * Flow: Auth → AbuseGuard → CreditGuard → Create Job → Create Lock → Queue → Worker handles deduction
 * Minimax: 1 second = 5 credits. requiredSeconds, requiredCredits set by creditGuard.
 */

import prisma from '../utils/prisma.js';
import { addVideoJob } from '../queues/videoQueue.js';
import { getSignedDownloadUrl } from '../services/storageService.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { generateVideoSchema } from '../utils/validators.js';
import config from '../config/index.js';

export const generate = async (req, res, next) => {
  try {
    const parsed = generateVideoSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.errors);
    }

    const userId = req.user.id;
    const duration = req.requiredSeconds; // Set by creditGuard
    const creditsCost = req.requiredCredits ?? duration * (config.minimax?.creditsPerSecond ?? 5);

    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.videoJob.create({
        data: {
          userId,
          prompt: parsed.data.prompt,
          negativePrompt: parsed.data.negativePrompt ?? null,
          provider: 'MINIMAX',
          status: 'PENDING',
          creditsUsed: 0,
          creditsCost,
          duration,
          aspectRatio: parsed.data.aspectRatio,
          resolution: config.credits.maxResolution,
          metadata: {
            duration,
            aspectRatio: parsed.data.aspectRatio,
            style: parsed.data.style,
            negativePrompt: parsed.data.negativePrompt,
          },
        },
      });

      await tx.creditLock.create({
        data: {
          userId,
          jobId: created.id,
          seconds: duration,
          credits: creditsCost,
          status: 'LOCKED',
        },
      });

      await tx.jobStep.create({
        data: {
          jobId: created.id,
          stepType: 'QUEUED',
          stepOrder: 1,
          status: 'PENDING',
        },
      });

      return created;
    });

    await addVideoJob({
      jobId: job.id,
      userId,
      prompt: parsed.data.prompt,
      metadata: {
        ...parsed.data,
        duration,
        negativePrompt: parsed.data.negativePrompt,
      },
    });

    const { trackEvent } = await import('../services/growthAnalyticsService.js');
    trackEvent('video_created', userId, { jobId: job.id }).catch(() => {});

    res.status(202).json({
      success: true,
      data: {
        job: {
          id: job.id,
          status: job.status,
          progress: job.progress,
          creditsUsed: creditsCost,
          createdAt: job.createdAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const history = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);

    const [jobs, total] = await Promise.all([
      prisma.videoJob.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          prompt: true,
          status: true,
          progress: true,
          creditsUsed: true,
          thumbnailUrl: true,
          videoUrl: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      prisma.videoJob.count({ where: { userId } }),
    ]);

    res.json({
      success: true,
      data: {
        jobs,
        total,
        limit,
        offset,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const job = await prisma.videoJob.findFirst({
      where: { id, userId },
    });

    if (!job) {
      throw new NotFoundError('Video job not found');
    }

    let downloadUrl = null;
    if (job.status === 'COMPLETED') {
      if (job.cdnUrl) {
        downloadUrl = job.cdnUrl;
      } else if (job.storageKey?.startsWith('http')) {
        downloadUrl = job.storageKey;
      } else if (job.storageKey) {
        try {
          downloadUrl = await getSignedDownloadUrl(job.storageKey);
        } catch {
          downloadUrl = job.videoUrl;
        }
      } else {
        downloadUrl = job.videoUrl;
      }
    }

    const steps = await prisma.jobStep.findMany({
      where: { jobId: job.id },
      orderBy: { stepOrder: 'asc' },
      select: {
        id: true,
        stepType: true,
        stepOrder: true,
        status: true,
        progress: true,
        error: true,
        durationMs: true,
        startedAt: true,
        completedAt: true,
      },
    });

    res.json({
      success: true,
      data: {
        job: {
          id: job.id,
          prompt: job.prompt,
          status: job.status,
          progress: job.progress,
          videoUrl: downloadUrl || job.videoUrl,
          cdnUrl: job.cdnUrl,
          thumbnailUrl: job.thumbnailUrl,
          creditsUsed: job.creditsUsed,
          provider: job.provider,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          steps,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
