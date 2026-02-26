/**
 * Input validation schemas using Zod
 */

import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const googleTokenSchema = z.object({
  credential: z.string().min(1, 'Google credential is required'),
});

export const generateVideoSchema = z.object({
  prompt: z.string().min(5).max(2000),
  negativePrompt: z.string().max(1000).optional(),
  duration: z.number().int().min(1).max(60).optional(),
  durationSeconds: z.number().int().min(1).max(60).optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional().default('16:9'),
  style: z.enum(['cinematic', 'anime', 'realistic', 'fantasy']).optional().default('cinematic'),
}).transform((data) => ({
  ...data,
  duration: data.durationSeconds ?? data.duration ?? 5,
}));

export const addCreditsSchema = z.object({
  amount: z.number().int().min(1).max(10000),
  paymentId: z.string().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  company: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal('')),
  timezone: z.string().max(50).optional(),
  locale: z.string().max(10).optional(),
});
