"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSplits = calculateSplits;
function calculateSplits(amount, splitType, shares) {
    const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;
    if (shares.length === 0) {
        throw new Error('Splits must include at least one user.');
    }
    const calculated = [];
    switch (splitType) {
        case 'EQUAL': {
            const equalShare = round2(amount / shares.length);
            let totalAssigned = 0;
            shares.forEach((s, idx) => {
                const personShare = idx === shares.length - 1 ? round2(amount - totalAssigned) : equalShare;
                totalAssigned += personShare;
                calculated.push({
                    userId: s.userId,
                    originalShare: 1,
                    shareAmount: personShare,
                });
            });
            break;
        }
        case 'EXACT': {
            let total = 0;
            shares.forEach((s) => {
                total += s.value;
                calculated.push({
                    userId: s.userId,
                    originalShare: s.value,
                    shareAmount: round2(s.value),
                });
            });
            if (Math.abs(total - amount) > 0.02) {
                throw new Error(`Total split amount (${total}) must equal the expense amount (${amount}).`);
            }
            break;
        }
        case 'PERCENTAGE': {
            let totalPct = 0;
            shares.forEach((s) => {
                totalPct += s.value;
            });
            if (Math.abs(totalPct - 100) > 0.01) {
                throw new Error(`Total percentages must equal 100%. Current sum: ${totalPct}%`);
            }
            let totalAssigned = 0;
            shares.forEach((s, idx) => {
                const shareAmt = idx === shares.length - 1
                    ? round2(amount - totalAssigned)
                    : round2((amount * s.value) / 100);
                totalAssigned += shareAmt;
                calculated.push({
                    userId: s.userId,
                    originalShare: s.value,
                    shareAmount: shareAmt,
                });
            });
            break;
        }
        case 'WEIGHTED': {
            let totalWeight = 0;
            shares.forEach((s) => {
                if (s.value <= 0) {
                    throw new Error('Weights must be positive numbers.');
                }
                totalWeight += s.value;
            });
            if (totalWeight <= 0) {
                throw new Error('Total weights must be greater than 0.');
            }
            let totalAssigned = 0;
            shares.forEach((s, idx) => {
                const shareAmt = idx === shares.length - 1
                    ? round2(amount - totalAssigned)
                    : round2((amount * s.value) / totalWeight);
                totalAssigned += shareAmt;
                calculated.push({
                    userId: s.userId,
                    originalShare: s.value,
                    shareAmount: shareAmt,
                });
            });
            break;
        }
        default:
            throw new Error(`Invalid split type: ${splitType}`);
    }
    return calculated;
}
