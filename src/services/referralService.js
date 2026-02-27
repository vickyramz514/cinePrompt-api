/**
 * Referral & Affiliate Service - invites, credits, commissions
 */

import { randomBytes } from 'crypto';
import prisma from '../utils/prisma.js';
import { addCredits } from './creditService.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const REFERRER_CREDITS = parseInt(process.env.REFERRER_CREDITS || '20', 10);
const REFEREE_CREDITS = parseInt(process.env.REFEREE_CREDITS || '10', 10);
const COMMISSION_RATE = parseFloat(process.env.AFFILIATE_COMMISSION_RATE || '0.1');

const generateReferralCode = () =>
  randomBytes(6).toString('hex').toUpperCase().slice(0, 8);

export const getOrCreateReferralCode = async (userId) => {
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (!user) throw new NotFoundError('User not found');

  if (!user.referralCode) {
    let code = generateReferralCode();
    while (await prisma.user.findFirst({ where: { referralCode: code } })) {
      code = generateReferralCode();
    }
    await prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
    });
    return code;
  }
  return user.referralCode;
};

export const applyReferralCode = async (refereeId, code, ipAddress) => {
  if (!code || !code.trim()) return null;

  const referralCode = code.trim().toUpperCase();
  const referrer = await prisma.user.findFirst({
    where: { referralCode },
    select: { id: true },
  });
  if (!referrer) return null;

  if (referrer.id === refereeId) {
    throw new ValidationError('Self-referral is not allowed');
  }

  const existing = await prisma.referral.findUnique({
    where: { refereeId },
  });
  if (existing) return null;

  await prisma.$transaction(async (tx) => {
    const ref = await tx.referral.create({
      data: {
        referrerId: referrer.id,
        refereeId,
        referralCode,
        rewardCredits: REFERRER_CREDITS + REFEREE_CREDITS,
        status: 'PENDING',
      },
    });

    await addCredits(tx, refereeId, REFEREE_CREDITS);
    await addCredits(tx, referrer.id, REFERRER_CREDITS);

    await tx.referral.update({
      where: { id: ref.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  });

  return { referrerCredits: REFERRER_CREDITS, refereeCredits: REFEREE_CREDITS };
};

export const getReferralStats = async (userId) => {
  const [referrals, totalCreditsEarned] = await Promise.all([
    prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        referee: { select: { id: true, name: true, email: true, createdAt: true } },
      },
    }),
    prisma.referral.aggregate({
      where: { referrerId: userId, status: 'COMPLETED' },
      _sum: { rewardCredits: true, rewardCash: true },
    }),
  ]);

  const code = await getOrCreateReferralCode(userId);
  return {
    referralCode: code,
    totalReferrals: referrals.length,
    completedReferrals: referrals.filter((r) => r.status === 'COMPLETED').length,
    creditsEarned: totalCreditsEarned._sum.rewardCredits ?? 0,
    cashEarned: totalCreditsEarned._sum.rewardCash ?? 0,
    referrals,
  };
};

export const getOrCreateAffiliate = async (userId) => {
  let affiliate = await prisma.affiliate.findUnique({
    where: { userId },
  });
  if (affiliate) return affiliate;

  const code = await getOrCreateReferralCode(userId);
  affiliate = await prisma.affiliate.create({
    data: {
      userId,
      referralCode: code,
      commissionRate: COMMISSION_RATE,
    },
  });
  return affiliate;
};

export const getAffiliateDashboard = async (userId) => {
  const affiliate = await getOrCreateAffiliate(userId);
  const [referrals, payouts] = await Promise.all([
    prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.affiliatePayout.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return {
    referralCode: affiliate.referralCode,
    commissionRate: affiliate.commissionRate,
    totalEarnings: affiliate.totalEarnings,
    payoutBalance: affiliate.payoutBalance,
    referrals,
    payouts,
  };
};

export const requestPayout = async (userId, amount) => {
  const affiliate = await prisma.affiliate.findUnique({
    where: { userId },
  });
  if (!affiliate) throw new NotFoundError('Affiliate account not found');
  if (amount <= 0 || amount > affiliate.payoutBalance) {
    throw new ValidationError('Invalid payout amount');
  }

  const payout = await prisma.$transaction(async (tx) => {
    const p = await tx.affiliatePayout.create({
      data: { affiliateId: affiliate.id, amount, status: 'REQUESTED' },
    });
    await tx.affiliate.update({
      where: { id: affiliate.id },
      data: { payoutBalance: { decrement: amount } },
    });
    return p;
  });
  return payout;
};

export const recordCommission = async (referrerId, amountCents, paymentId) => {
  const referral = await prisma.referral.findFirst({
    where: { refereeId: referrerId, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!referral) return;

  const commission = (amountCents / 100) * COMMISSION_RATE;
  await prisma.affiliate.upsert({
    where: { userId: referral.referrerId },
    create: {
      userId: referral.referrerId,
      referralCode: (await getOrCreateReferralCode(referral.referrerId)),
      commissionRate: COMMISSION_RATE,
      totalEarnings: commission,
      payoutBalance: commission,
    },
    update: {
      totalEarnings: { increment: commission },
      payoutBalance: { increment: commission },
    },
  });
};
