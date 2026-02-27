/**
 * Credit system - Wallet + Ledger (enterprise schema)
 * Falls back to User.credits if Wallet missing (migration compat)
 */

import prisma from '../utils/prisma.js';
import config from '../config/index.js';
import { InsufficientCreditsError } from '../utils/errors.js';

const getOrCreateWallet = async (tx, userId) => {
  let wallet = await tx.wallet.findUnique({
    where: { userId },
  });
  if (!wallet) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    const balance = user?.credits ?? config.credits.defaultNewUser;
    wallet = await tx.wallet.create({
      data: {
        userId,
        balance,
        totalCreditsIn: balance,
        totalCreditsOut: 0,
      },
    });
  }
  return wallet;
};

const syncUserCredits = async (tx, userId, balance) => {
  await tx.user.update({
    where: { id: userId },
    data: { credits: balance },
  });
};

export const deductCredits = async (tx, userId, amount, metadata = {}) => {
  const wallet = await getOrCreateWallet(tx, userId);
  if (wallet.balance < amount) {
    throw new InsufficientCreditsError(
      `Insufficient credits. Required: ${amount}, Available: ${wallet.balance}`
    );
  }
  const balanceAfter = wallet.balance - amount;
  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: balanceAfter,
      totalCreditsOut: { increment: amount },
      version: { increment: 1 },
    },
  });
  await syncUserCredits(tx, userId, balanceAfter);
  return balanceAfter;
};

export const addCredits = async (tx, userId, amount, metadata = {}) => {
  const wallet = await getOrCreateWallet(tx, userId);
  const balanceAfter = wallet.balance + amount;
  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: balanceAfter,
      totalCreditsIn: { increment: amount },
      version: { increment: 1 },
    },
  });
  await syncUserCredits(tx, userId, balanceAfter);
  return balanceAfter;
};

export const deductForVideoJob = async (userId, jobId, amount) => {
  return prisma.$transaction(async (tx) => {
    const wallet = await getOrCreateWallet(tx, userId);
    const balanceAfter = await deductCredits(tx, userId, amount);

    await tx.creditLedgerEntry.create({
      data: {
        walletId: wallet.id,
        amount: -amount,
        balanceAfter,
        type: 'VIDEO_GENERATION',
        status: 'COMPLETED',
        referenceId: jobId,
        referenceType: 'video_job',
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        amount: -amount,
        credits: amount,
        status: 'COMPLETED',
        type: 'VIDEO_GENERATION',
        referenceId: jobId,
      },
    });

    return balanceAfter;
  });
};

export const refundCredits = async (userId, jobId, amount) => {
  return prisma.$transaction(async (tx) => {
    const balanceAfter = await addCredits(tx, userId, amount);
    const wallet = await getOrCreateWallet(tx, userId);

    await tx.creditLedgerEntry.create({
      data: {
        walletId: wallet.id,
        amount,
        balanceAfter,
        type: 'VIDEO_REFUND',
        status: 'REFUNDED',
        referenceId: jobId,
        referenceType: 'video_job',
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        amount,
        credits: amount,
        status: 'REFUNDED',
        type: 'VIDEO_REFUND',
        referenceId: jobId,
      },
    });

    return balanceAfter;
  });
};

export const addCreditsPurchase = async (userId, amount, paymentId = null) => {
  return prisma.$transaction(async (tx) => {
    const balanceAfter = await addCredits(tx, userId, amount);
    const wallet = await getOrCreateWallet(tx, userId);

    await tx.creditLedgerEntry.create({
      data: {
        walletId: wallet.id,
        amount,
        balanceAfter,
        type: 'PURCHASE',
        status: 'COMPLETED',
        referenceId: paymentId,
        referenceType: 'payment',
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        amount,
        credits: amount,
        status: 'COMPLETED',
        type: 'PURCHASE',
        referenceId: paymentId,
      },
    });

    return balanceAfter;
  });
};

/**
 * Admin credit adjustment (add or deduct)
 * @param {string} userId - Target user
 * @param {number} amount - Positive to add, negative to deduct
 * @param {string} adminId - Admin who performed the action
 */
export const adminCreditAdjustment = async (userId, amount, adminId) => {
  return prisma.$transaction(async (tx) => {
    const wallet = await getOrCreateWallet(tx, userId);
    const balanceAfter =
      amount > 0
        ? await addCredits(tx, userId, amount)
        : await deductCredits(tx, userId, Math.abs(amount));

    await tx.creditLedgerEntry.create({
      data: {
        walletId: wallet.id,
        amount,
        balanceAfter,
        type: 'ADMIN_ADJUSTMENT',
        status: 'COMPLETED',
        referenceId: adminId,
        referenceType: 'admin',
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        amount,
        credits: Math.abs(amount),
        status: 'COMPLETED',
        type: 'ADMIN_ADJUSTMENT',
        referenceId: adminId,
        metadata: { adminId },
      },
    });

    return balanceAfter;
  });
};

/**
 * Add credits from subscription payment (monthly renewal or first charge)
 */
export const addCreditsSubscription = async (userId, amount, paymentId, subscriptionId) => {
  return prisma.$transaction(async (tx) => {
    const balanceAfter = await addCredits(tx, userId, amount);
    const wallet = await getOrCreateWallet(tx, userId);

    await tx.creditLedgerEntry.create({
      data: {
        walletId: wallet.id,
        amount,
        balanceAfter,
        type: 'SUBSCRIPTION',
        status: 'COMPLETED',
        referenceId: paymentId,
        referenceType: 'subscription',
        metadata: { subscriptionId },
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        amount,
        credits: amount,
        status: 'COMPLETED',
        type: 'SUBSCRIPTION',
        referenceId: paymentId,
        metadata: { subscriptionId },
      },
    });

    return balanceAfter;
  });
};

export const getBalance = async (userId) => {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { balance: true },
  });
  if (wallet) return wallet.balance;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  return user?.credits ?? 0;
};

/**
 * Get max video duration (seconds) allowed for a plan
 * @param {string} plan - UserPlan enum (FREE, STARTER, CREATOR, PRO, ULTRA)
 */
export const getMaxDuration = (plan = 'FREE') => {
  const planConfig = config.planLimits[plan] ?? config.planLimits.FREE;
  return typeof planConfig === 'object' ? planConfig.maxDuration : 5;
};
