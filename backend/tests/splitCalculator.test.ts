import { describe, it, expect } from 'vitest';
import { calculateSplits } from '../src/utils/splitCalculator';

describe('Split Calculator Math', () => {
  it('calculates equal splits with penny rounding corrections', () => {
    const shares = [
      { userId: 'u1', value: 1 },
      { userId: 'u2', value: 1 },
      { userId: 'u3', value: 1 },
    ];
    // ₹100.00 / 3 = 33.33 each, with the last person getting 33.34
    const result = calculateSplits(100, 'EQUAL', shares);
    expect(result).toHaveLength(3);
    expect(result[0].shareAmount).toBe(33.33);
    expect(result[1].shareAmount).toBe(33.33);
    expect(result[2].shareAmount).toBe(33.34);
    
    const sum = result.reduce((acc, curr) => acc + curr.shareAmount, 0);
    expect(sum).toBe(100);
  });

  it('calculates exact splits and validates totals', () => {
    const shares = [
      { userId: 'u1', value: 40.50 },
      { userId: 'u2', value: 59.50 },
    ];
    const result = calculateSplits(100, 'EXACT', shares);
    expect(result).toHaveLength(2);
    expect(result[0].shareAmount).toBe(40.50);
    expect(result[1].shareAmount).toBe(59.50);
    expect(() => calculateSplits(100, 'EXACT', [{ userId: 'u1', value: 50 }])).toThrow();
  });

  it('calculates percentage splits and validates totals sum to 100%', () => {
    const shares = [
      { userId: 'u1', value: 33.33 },
      { userId: 'u2', value: 33.33 },
      { userId: 'u3', value: 33.34 },
    ];
    const result = calculateSplits(150, 'PERCENTAGE', shares);
    expect(result).toHaveLength(3);
    
    const sum = result.reduce((acc, curr) => acc + curr.shareAmount, 0);
    expect(sum).toBe(150);
    expect(() => calculateSplits(100, 'PERCENTAGE', [{ userId: 'u1', value: 90 }])).toThrow();
  });

  it('calculates weighted splits', () => {
    const shares = [
      { userId: 'u1', value: 2 }, // double share
      { userId: 'u2', value: 1 }, // single share
      { userId: 'u3', value: 1 }, // single share
    ];
    const result = calculateSplits(200, 'WEIGHTED', shares);
    expect(result).toHaveLength(3);
    expect(result[0].shareAmount).toBe(100);
    expect(result[1].shareAmount).toBe(50);
    expect(result[2].shareAmount).toBe(50);
  });
});
