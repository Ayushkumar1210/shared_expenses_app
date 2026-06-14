import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { prisma } from '../utils/db';
import { calculateSplits } from '../utils/splitCalculator';
import { z } from 'zod';

const expenseSchema = z.object({
  groupId: z.string(),
  payerId: z.string(),
  amount: z.number().positive(),
  currency: z.enum(['INR', 'USD']),
  description: z.string().min(2),
  date: z.string().pipe(z.coerce.date()).default(() => new Date().toISOString()),
  splitType: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE', 'WEIGHTED']),
  shares: z.array(z.object({
    userId: z.string(),
    value: z.number(),
  })),
});

export async function createExpense(req: AuthenticatedRequest, res: Response) {
  try {
    const validated = expenseSchema.parse(req.body);

    const userIds = Array.from(new Set([validated.payerId, ...validated.shares.map((s) => s.userId)]));

    const memberships = await prisma.membership.findMany({
      where: {
        groupId: validated.groupId,
        userId: { in: userIds },
      },
    });

    const payerMem = memberships.find((m) => m.userId === validated.payerId);
    if (!payerMem) {
      return res.status(400).json({ error: 'Payer is not a member of the group.' });
    }

    const checkMembershipBound = (mem: any, date: Date): boolean => {
      const d = new Date(date);
      const joined = new Date(mem.joinedAt);
      if (d < joined) return false;
      if (mem.leftAt) {
        const left = new Date(mem.leftAt);
        if (d > left) return false;
      }
      return true;
    };

    if (!checkMembershipBound(payerMem, validated.date)) {
      return res.status(400).json({ error: 'Payer was not a member of the group on the expense date.' });
    }

    for (const userId of userIds) {
      const mem = memberships.find((m) => m.userId === userId);
      if (!mem) {
        return res.status(400).json({ error: `User with ID ${userId} is not a member of the group.` });
      }
      if (!checkMembershipBound(mem, validated.date)) {
        return res.status(400).json({ error: `User ${mem.userId} was not a member of the group on the expense date.` });
      }
    }

    let rate = 1.0;
    if (validated.currency === 'USD') {
      const exRate = await prisma.exchangeRate.findUnique({
        where: { fromCurrency_toCurrency: { fromCurrency: 'USD', toCurrency: 'INR' } },
      });
      rate = exRate ? Number(exRate.rate) : 83.0;
    }

    const convertedAmountINR = validated.amount * rate;

    let calculatedShares;
    try {
      calculatedShares = calculateSplits(validated.amount, validated.splitType, validated.shares);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }

    const expense = await prisma.$transaction(async (tx) => {
      const newExpense = await tx.expense.create({
        data: {
          groupId: validated.groupId,
          payerId: validated.payerId,
          amount: validated.amount,
          currency: validated.currency,
          amountINR: convertedAmountINR,
          description: validated.description,
          date: validated.date,
          splitType: validated.splitType,
        },
      });

      const sharesData = calculatedShares.map((cs) => {
        const shareAmountINR = cs.shareAmount * rate;
        return {
          expenseId: newExpense.id,
          userId: cs.userId,
          originalShare: cs.originalShare,
          shareAmountINR: shareAmountINR,
        };
      });

      await tx.expenseShare.createMany({
        data: sharesData,
      });

      return tx.expense.findUnique({
        where: { id: newExpense.id },
        include: {
          payer: { select: { id: true, name: true } },
          shares: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    return res.status(201).json(expense);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getExpenses(req: AuthenticatedRequest, res: Response) {
  try {
    const { groupId } = req.query;
    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required' });
    }

    const expenses = await prisma.expense.findMany({
      where: { groupId: String(groupId) },
      include: {
        payer: { select: { id: true, name: true } },
        shares: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return res.json(expenses);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
