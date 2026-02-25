/**
 * Notification controller - list, mark read
 */

import prisma from '../utils/prisma.js';

export const list = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const offset = parseInt(req.query.offset || '0', 10);
    const unreadOnly = req.query.unread === 'true';

    const where = { userId: req.user.id };
    if (unreadOnly) where.readAt = null;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          data: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({
        where: { userId: req.user.id, readAt: null },
      }),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        limit,
        offset,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const markRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.notification.updateMany({
      where: { id, userId: req.user.id },
      data: { readAt: new Date() },
    });

    res.json({
      success: true,
      data: { read: true },
    });
  } catch (err) {
    next(err);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    res.json({
      success: true,
      data: { read: true },
    });
  } catch (err) {
    next(err);
  }
};
