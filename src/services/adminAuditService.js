/**
 * Admin audit logging - every admin action is logged
 */

import prisma from '../utils/prisma.js';

const TARGET_TYPES = ['USER', 'JOB', 'PAYMENT', 'CREDIT'];

/**
 * Log an admin action
 * @param {string} adminId - Admin user ID
 * @param {string} action - Action name (credit_update, block_user, unblock_user, cancel_job, plan_override)
 * @param {string} targetType - USER | JOB | PAYMENT | CREDIT
 * @param {string} [targetId] - Target entity ID
 * @param {object} [meta] - Additional metadata
 */
export const logAdminAction = async (adminId, action, targetType, targetId = null, meta = {}) => {
  if (!TARGET_TYPES.includes(targetType)) {
    targetType = 'USER';
  }
  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action,
      targetType,
      targetId,
      meta: meta && Object.keys(meta).length > 0 ? meta : undefined,
    },
  });
};
