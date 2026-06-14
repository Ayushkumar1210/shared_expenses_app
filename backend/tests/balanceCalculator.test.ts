import { describe, it, expect, vi } from 'vitest';
import { calculateBalances } from '../src/services/balanceCalculator';
import { prisma } from '../src/utils/db';

vi.mock('../src/utils/db', () => {
  return {
    prisma: {
      group: {
        findUnique: vi.fn(),
      },
    },
  };
});

describe('Balance Calculator & Debt Simplifier', () => {
  it('calculates group balances, traces and simplifies debt', async () => {
    const mockGroup = {
      id: 'g1',
      name: 'Cozy Flat',
      description: 'Test group',
      memberships: [
        { userId: 'u1', joinedAt: new Date('2026-01-01'), leftAt: null, user: { name: 'Aisha' } },
        { userId: 'u2', joinedAt: new Date('2026-01-01'), leftAt: null, user: { name: 'Rohan' } },
        { userId: 'u3', joinedAt: new Date('2026-01-01'), leftAt: null, user: { name: 'Priya' } },
      ],
      expenses: [
        {
          id: 'e1',
          description: 'Grocery',
          amount: 300,
          currency: 'INR',
          amountINR: 300,
          date: new Date('2026-02-10'),
          splitType: 'EQUAL',
          payerId: 'u1',
          payer: { name: 'Aisha' },
          shares: [
            { userId: 'u1', shareAmountINR: 100, user: { name: 'Aisha' } },
            { userId: 'u2', shareAmountINR: 100, user: { name: 'Rohan' } },
            { userId: 'u3', shareAmountINR: 100, user: { name: 'Priya' } },
          ],
        },
      ],
      settlements: [
        {
          id: 's1',
          payerId: 'u2',
          receiverId: 'u1',
          amount: 50,
          currency: 'INR',
          amountINR: 50,
          date: new Date('2026-02-11'),
          payer: { name: 'Rohan' },
          receiver: { name: 'Aisha' },
        }
      ],
    };

    (prisma.group.findUnique as any).mockResolvedValue(mockGroup);

    const result = await calculateBalances('g1');

    const aishaReport = result.reports.find(r => r.userId === 'u1');
    const rohanReport = result.reports.find(r => r.userId === 'u2');
    const priyaReport = result.reports.find(r => r.userId === 'u3');

    expect(aishaReport?.netBalance).toBe(150);
    expect(rohanReport?.netBalance).toBe(-50);
    expect(priyaReport?.netBalance).toBe(-100);

    expect(result.recommendations).toHaveLength(2);
    
    const priyaRec = result.recommendations.find(r => r.fromUserId === 'u3');
    const rohanRec = result.recommendations.find(r => r.fromUserId === 'u2');

    expect(priyaRec?.toUserId).toBe('u1');
    expect(priyaRec?.amount).toBe(100);
    
    expect(rohanRec?.toUserId).toBe('u1');
    expect(rohanRec?.amount).toBe(50);
  });
});
