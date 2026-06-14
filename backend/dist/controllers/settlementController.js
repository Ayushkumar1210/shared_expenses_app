"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSettlement = createSettlement;
exports.getSettlements = getSettlements;
const db_1 = require("../utils/db");
const zod_1 = require("zod");
const settlementSchema = zod_1.z.object({
    groupId: zod_1.z.string(),
    payerId: zod_1.z.string(),
    receiverId: zod_1.z.string(),
    amount: zod_1.z.number().positive(),
    currency: zod_1.z.enum(['INR', 'USD']),
    date: zod_1.z.string().pipe(zod_1.z.coerce.date()).default(() => new Date().toISOString()),
});
async function createSettlement(req, res) {
    try {
        const validated = settlementSchema.parse(req.body);
        if (validated.payerId === validated.receiverId) {
            return res.status(400).json({ error: 'Payer and receiver cannot be the same person' });
        }
        // Check if membership history permits this settlement date
        const memberships = await db_1.prisma.membership.findMany({
            where: {
                groupId: validated.groupId,
                userId: { in: [validated.payerId, validated.receiverId] },
            },
        });
        const payerMem = memberships.find((m) => m.userId === validated.payerId);
        const receiverMem = memberships.find((m) => m.userId === validated.receiverId);
        if (!payerMem || !receiverMem) {
            return res.status(400).json({ error: 'Payer or receiver is not a member of the group' });
        }
        // Verify dates
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
            return res.status(400).json({ error: 'Payer was not a member of the group on the selected date' });
        }
        if (!checkMembershipBound(receiverMem, validated.date)) {
            return res.status(400).json({ error: 'Receiver was not a member of the group on the selected date' });
        }
        let rate = 1.0;
        if (validated.currency === 'USD') {
            const exRate = await db_1.prisma.exchangeRate.findUnique({
                where: { fromCurrency_toCurrency: { fromCurrency: 'USD', toCurrency: 'INR' } },
            });
            rate = exRate ? Number(exRate.rate) : 83.0;
        }
        const amountINR = validated.amount * rate;
        const settlement = await db_1.prisma.settlement.create({
            data: {
                groupId: validated.groupId,
                payerId: validated.payerId,
                receiverId: validated.receiverId,
                amount: validated.amount,
                currency: validated.currency,
                amountINR: amountINR,
                date: validated.date,
            },
            include: {
                payer: { select: { id: true, name: true } },
                receiver: { select: { id: true, name: true } },
            },
        });
        return res.status(201).json(settlement);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function getSettlements(req, res) {
    try {
        const { groupId } = req.query;
        if (!groupId) {
            return res.status(400).json({ error: 'groupId is required' });
        }
        const settlements = await db_1.prisma.settlement.findMany({
            where: { groupId: String(groupId) },
            include: {
                payer: { select: { id: true, name: true } },
                receiver: { select: { id: true, name: true } },
            },
            orderBy: { date: 'desc' },
        });
        return res.json(settlements);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
