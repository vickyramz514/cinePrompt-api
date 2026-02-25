/**
 * Wallet controller - balance, history, add credits (mock payment)
 */

import prisma from '../utils/prisma.js';
import { addCreditsPurchase, getBalance as getCreditBalance } from '../services/creditService.js';
import { addCreditsSchema } from '../utils/validators.js';
import { ValidationError } from '../utils/errors.js';

export const getBalance = async (req, res, next) => {
  try {
    const credits = await getCreditBalance(req.user.id);

    res.json({
      success: true,
      data: {
        credits,
        plan: req.user.plan,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const addCredits = async (req, res, next) => {
  try {
    const parsed = addCreditsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Validation failed', parsed.error.errors);
    }

    const newBalance = await addCreditsPurchase(
      req.user.id,
      parsed.data.amount,
      parsed.data.paymentId
    );

    res.json({
      success: true,
      data: {
        credits: newBalance,
        added: parsed.data.amount,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/wallet/history
 * Credit ledger + transaction history
 */
export const getHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);

    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!wallet) {
      return res.json({
        success: true,
        data: { entries: [], total: 0, limit, offset },
      });
    }

    const [entries, total] = await Promise.all([
      prisma.creditLedgerEntry.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          amount: true,
          balanceAfter: true,
          type: true,
          status: true,
          referenceId: true,
          referenceType: true,
          description: true,
          createdAt: true,
        },
      }),
      prisma.creditLedgerEntry.count({ where: { walletId: wallet.id } }),
    ]);

    res.json({
      success: true,
      data: {
        entries,
        total,
        limit,
        offset,
      },
    });
  } catch (err) {
    next(err);
  }
};
