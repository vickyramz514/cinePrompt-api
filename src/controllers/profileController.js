/**
 * Profile controller - get, update user profile
 */

import prisma from '../utils/prisma.js';
import { updateProfileSchema } from '../utils/validators.js';
import { ValidationError } from '../utils/errors.js';

export const getProfile = async (req, res, next) => {
  try {
    const { enrichUserWithEffectivePlan } = await import('../utils/userPlanEnrichment.js');
    const user = await enrichUserWithEffectivePlan(req.user);

    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.user.id },
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          plan: user.plan,
        },
        profile: profile || {
          bio: null,
          company: null,
          website: null,
          timezone: 'UTC',
          locale: 'en',
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.errors);
    }

    const { name, bio, company, website, timezone, locale } = parsed.data;
    const hasProfileFields = [bio, company, website, timezone, locale].some((v) => v !== undefined);

    const user = name
      ? await prisma.user.update({
          where: { id: req.user.id },
          data: { name },
          select: { id: true, name: true, email: true, avatar: true, plan: true },
        })
      : await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { id: true, name: true, email: true, avatar: true, plan: true },
        });

    let profile = await prisma.userProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (hasProfileFields) {
      profile = await prisma.userProfile.upsert({
        where: { userId: req.user.id },
        create: {
          userId: req.user.id,
          bio: bio ?? null,
          company: company ?? null,
          website: website ?? null,
          timezone: timezone ?? 'UTC',
          locale: locale ?? 'en',
        },
        update: {
          ...(bio !== undefined && { bio }),
          ...(company !== undefined && { company }),
          ...(website !== undefined && { website }),
          ...(timezone !== undefined && { timezone }),
          ...(locale !== undefined && { locale }),
        },
      });
    }

    res.json({
      success: true,
      data: {
        user,
        profile: profile
          ? {
              bio: profile.bio,
              company: profile.company,
              website: profile.website,
              timezone: profile.timezone,
              locale: profile.locale,
            }
          : { bio: null, company: null, website: null, timezone: 'UTC', locale: 'en' },
      },
    });
  } catch (err) {
    next(err);
  }
};
