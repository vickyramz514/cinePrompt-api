/**
 * BullMQ video generation queue
 * Minimax: 2 retries, 10 min timeout. Runway/Replicate: 3 retries
 */

import { Queue } from 'bullmq';
import config from '../config/index.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

const useMinimax = () => !!config.minimax?.apiKey;
const maxRetries = useMinimax()
  ? (config.minimax?.maxRetries ?? 2)
  : config.runway?.apiSecret
    ? config.runway.maxRetries
    : config.replicate.maxRetries;

export const videoQueue = new Queue('video-generation', {
  connection,
  defaultJobOptions: {
    attempts: maxRetries,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

/**
 * Add video generation job to queue
 */
export const addVideoJob = async (jobData) => {
  const job = await videoQueue.add('generate', jobData, {
    jobId: jobData.jobId,
  });
  return job;
};
