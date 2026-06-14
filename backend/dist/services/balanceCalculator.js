"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBalances = calculateBalances;
const db_1 = require("../utils/db");
async function calculateBalances(groupId) {
    // 1. Fetch group, memberships, users
    const group = await db_1.prisma.group.findUnique({
        where: { id: groupId },
        include: {
            memberships: {
                include: {
                    user: {
                        select: { id: true, name: true, email: true },
                    },
                },
            },
            expenses: {
                include: {
                    payer: { select: { id: true, name: true } },
                    shares: {
                        include: {
                            user: { select: { id: true, name: true } },
                        },
                    },
                },
            },
            settlements: {
                include: {
                    payer: { select: { id: true, name: true } },
                    receiver: { select: { id: true, name: true } },
                },
            },
        },
    });
    if (!group) {
        throw new Error('Group not found');
    }
    // Get all members who were ever in the group
    const membersMap = new Map(); // userId -> userName
    group.memberships.forEach((m) => {
        membersMap.set(m.userId, m.user.name);
    });
    // Initialize reports for each member
    const reports = {};
    for (const [userId, userName] of membersMap.entries()) {
        reports[userId] = {
            userId,
            userName,
            totalPaidExpenses: 0,
            totalOwedShares: 0,
            totalPaidSettlements: 0,
            totalReceivedSettlements: 0,
            netBalance: 0,
            trace: [],
        };
    }
    const toNumber = (val) => {
        if (!val)
            return 0;
        return typeof val.toNumber === 'function' ? val.toNumber() : Number(val);
    };
    // 2. Process Expenses
    for (const expense of group.expenses) {
        const payerId = expense.payerId;
        const amountINR = toNumber(expense.amountINR);
        // If payer is a group member
        if (reports[payerId]) {
            reports[payerId].totalPaidExpenses += amountINR;
            reports[payerId].trace.push({
                type: 'paid',
                expenseId: expense.id,
                description: `Paid for "${expense.description}"`,
                date: expense.date,
                amount: amountINR,
            });
        }
        // Process shares
        for (const share of expense.shares) {
            const shareUserId = share.userId;
            const shareAmountINR = toNumber(share.shareAmountINR);
            if (reports[shareUserId]) {
                reports[shareUserId].totalOwedShares += shareAmountINR;
                reports[shareUserId].trace.push({
                    type: 'owed',
                    expenseId: expense.id,
                    description: `Owed for "${expense.description}" (paid by ${expense.payer.name})`,
                    date: expense.date,
                    amount: shareAmountINR,
                });
            }
        }
    }
    // 3. Process Settlements
    for (const settlement of group.settlements) {
        const payerId = settlement.payerId;
        const receiverId = settlement.receiverId;
        const amountINR = toNumber(settlement.amountINR);
        if (reports[payerId]) {
            reports[payerId].totalPaidSettlements += amountINR;
            reports[payerId].trace.push({
                type: 'settlement_paid',
                settlementId: settlement.id,
                description: `Settled debt to ${settlement.receiver.name}`,
                date: settlement.date,
                amount: amountINR,
            });
        }
        if (reports[receiverId]) {
            reports[receiverId].totalReceivedSettlements += amountINR;
            reports[receiverId].trace.push({
                type: 'settlement_received',
                settlementId: settlement.id,
                description: `Received settlement from ${settlement.payer.name}`,
                date: settlement.date,
                amount: amountINR,
            });
        }
    }
    // 4. Calculate Net Balances
    const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;
    for (const userId of Object.keys(reports)) {
        const r = reports[userId];
        r.totalPaidExpenses = round2(r.totalPaidExpenses);
        r.totalOwedShares = round2(r.totalOwedShares);
        r.totalPaidSettlements = round2(r.totalPaidSettlements);
        r.totalReceivedSettlements = round2(r.totalReceivedSettlements);
        // net = (paid expenses + paid settlements) - (owed shares + received settlements)
        const net = (r.totalPaidExpenses + r.totalPaidSettlements) - (r.totalOwedShares + r.totalReceivedSettlements);
        r.netBalance = round2(net);
        // Sort trace by date descending
        r.trace.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
    const debtors = [];
    const creditors = [];
    for (const userId of Object.keys(reports)) {
        const balance = reports[userId].netBalance;
        if (balance < -0.01) {
            debtors.push({ userId, userName: reports[userId].userName, amount: Math.abs(balance) });
        }
        else if (balance > 0.01) {
            creditors.push({ userId, userName: reports[userId].userName, amount: balance });
        }
    }
    // Sort: largest debtor first, largest creditor first
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    const recommendations = [];
    let dIdx = 0;
    let cIdx = 0;
    while (dIdx < debtors.length && cIdx < creditors.length) {
        const debtor = debtors[dIdx];
        const creditor = creditors[cIdx];
        const settledAmount = Math.min(debtor.amount, creditor.amount);
        if (settledAmount > 0.01) {
            recommendations.push({
                fromUserId: debtor.userId,
                fromUserName: debtor.userName,
                toUserId: creditor.userId,
                toUserName: creditor.userName,
                amount: round2(settledAmount),
            });
        }
        debtor.amount -= settledAmount;
        creditor.amount -= settledAmount;
        if (debtor.amount <= 0.01) {
            dIdx++;
        }
        if (creditor.amount <= 0.01) {
            cIdx++;
        }
    }
    return {
        reports: Object.values(reports),
        recommendations,
    };
}
