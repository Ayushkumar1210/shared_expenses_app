"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpense = createExpense;
exports.getExpenses = getExpenses;
const db_1 = require("../utils/db");
const splitCalculator_1 = require("../utils/splitCalculator");
const zod_1 = require("zod");
const expenseSchema = zod_1.z.object({
    groupId: zod_1.z.string(),
    payerId: zod_1.z.string(),
    amount: zod_1.z.number().positive(),
    currency: zod_1.z.enum(['INR', 'USD']),
    description: zod_1.z.string().min(2),
    date: zod_1.z.string().pipe(zod_1.z.coerce.date()).default(() => new Date().toISOString()),
    splitType: zod_1.z.enum(['EQUAL', 'EXACT', 'PERCENTAGE', 'WEIGHTED']),
    shares: zod_1.z.array(zod_1.z.object({
        userId: zod_1.z.string(),
        value: zod_1.z.number(),
    })),
});
async function createExpense(req, res) {
    try {
        const validated = expenseSchema.parse(req.body);
        const userIds = Array.from(new Set([validated.payerId, ...validated.shares.map((s) => s.userId)]));
        const memberships = await db_1.prisma.membership.findMany({
            where: {
                groupId: validated.groupId,
                userId: { in: userIds },
            },
        });
        const payerMem = memberships.find((m) => m.userId === validated.payerId);
        if (!payerMem) {
            return res.status(400).json({ error: 'Payer is not a member of the group.' });
        }
        const checkMembershipBound = (mem, date) => {
            const d = new Date(date);
            const joined = new Date(mem.joinedAt);
            if (d < joined)
                return false;
            if (mem.leftAt) {
                const left = new Date(mem.leftAt);
                if (d > left)
                    return false;
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
            const exRate = await db_1.prisma.exchangeRate.findUnique({
                where: { fromCurrency_toCurrency: { fromCurrency: 'USD', toCurrency: 'INR' } },
            });
            rate = exRate ? Number(exRate.rate) : 83.0;
        }
        const convertedAmountINR = validated.amount * rate;
        let calculatedShares;
        try {
            calculatedShares = (0, splitCalculator_1.calculateSplits)(validated.amount, validated.splitType, validated.shares);
        }
        catch (e) {
            return res.status(400).json({ error: e.message });
        }
        const expense = await db_1.prisma.$transaction(async (tx) => {
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function getExpenses(req, res) {
    try {
        const { groupId } = req.query;
        if (!groupId) {
            return res.status(400).json({ error: 'groupId is required' });
        }
        const expenses = await db_1.prisma.expense.findMany({
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
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
