import { describe, it, expect } from 'vitest';
import { detectAnomalies } from '../src/services/anomalyDetector';

describe('Anomaly Detector Engine', () => {
  const members = [
    { id: '1', name: 'Aisha', joinedAt: new Date('2026-01-01T00:00:00Z'), leftAt: null },
    { id: '2', name: 'Rohan', joinedAt: new Date('2026-01-01T00:00:00Z'), leftAt: null },
    { id: '3', name: 'Meera', joinedAt: new Date('2026-01-01T00:00:00Z'), leftAt: new Date('2026-03-31T23:59:59Z') },
    { id: '4', name: 'Sam', joinedAt: new Date('2026-04-15T00:00:00Z'), leftAt: null },
  ];

  it('detects negative and zero amount anomalies', () => {
    const rows = [
      { date: '2026-02-10', description: 'Dinner', payer: 'Aisha', amount: '-500', currency: 'INR', splitType: 'EQUAL', splits: 'Aisha, Rohan' },
      { date: '2026-02-10', description: 'Grocery', payer: 'Rohan', amount: '0', currency: 'INR', splitType: 'EQUAL', splits: 'Aisha, Rohan' },
    ];
    const report = detectAnomalies(rows, members, [], 83.0);
    expect(report.anomalies).toHaveLength(2);
    expect(report.anomalies[0].anomalyType).toBe('NEGATIVE_AMOUNT');
    expect(report.anomalies[0].severity).toBe('ERROR');
    expect(report.anomalies[1].anomalyType).toBe('ZERO_AMOUNT');
    expect(report.anomalies[1].severity).toBe('ERROR');
  });

  it('detects missing payer and currency mismatch anomalies', () => {
    const rows = [
      { date: '2026-02-10', description: 'Taxi', payer: '', amount: '1200', currency: 'INR', splitType: 'EQUAL', splits: 'Aisha, Rohan' },
      { date: '2026-02-10', description: 'Taxi', payer: 'UnknownPerson', amount: '1200', currency: 'INR', splitType: 'EQUAL', splits: 'Aisha, Rohan' },
      { date: '2026-02-10', description: 'Lunch', payer: 'Aisha', amount: '20', currency: 'EUR', splitType: 'EQUAL', splits: 'Aisha, Rohan' },
    ];
    const report = detectAnomalies(rows, members, [], 83.0);
    expect(report.anomalies.filter(a => a.anomalyType === 'MISSING_PAYER')).toHaveLength(2);
    expect(report.anomalies.filter(a => a.anomalyType === 'CURRENCY_MISMATCH')).toHaveLength(1);
  });

  it('detects timeline bounds anomalies (member before joining, member after leaving)', () => {
    const rows = [
      { date: '2026-04-10', description: 'Dinner', payer: 'Aisha', amount: '900', currency: 'INR', splitType: 'EQUAL', splits: 'Aisha, Meera' },
      { date: '2026-03-10', description: 'Grocery', payer: 'Sam', amount: '1000', currency: 'INR', splitType: 'EQUAL', splits: 'Aisha, Rohan' },
    ];
    const report = detectAnomalies(rows, members, [], 83.0);
    expect(report.anomalies.some(a => a.anomalyType === 'MEMBER_AFTER_LEAVING')).toBe(true);
    expect(report.anomalies.some(a => a.anomalyType === 'MEMBER_BEFORE_JOINING')).toBe(true);
  });

  it('normalizes names and tracks date ambiguity', () => {
    const rows = [
      { date: '04/05/2026', description: 'Rent', payer: 'rohan', amount: '1000', currency: 'INR', splitType: 'EQUAL', splits: 'Aisha, rohan' },
    ];
    const report = detectAnomalies(rows, members, [], 83.0);
    expect(report.anomalies.some(a => a.anomalyType === 'NAME_NORMALIZATION')).toBe(true);
    expect(report.anomalies.some(a => a.anomalyType === 'AMBIGUOUS_DATE')).toBe(true);
  });

  it('detects duplicate expenses and staged settlements', () => {
    const existing = [
      { date: new Date('2026-02-15'), payer: { name: 'Aisha' }, amountINR: 900, description: 'Electricity' }
    ];
    const rows = [
      { date: '2026-02-15', description: 'Electricity', payer: 'Aisha', amount: '900', currency: 'INR', splitType: 'EQUAL', splits: 'Aisha, Rohan' },
      { date: '2026-02-20', description: 'Repayment for trip', payer: 'Rohan', amount: '1200', currency: 'INR', splitType: 'EXACT', splits: 'Aisha:1200' },
    ];
    const report = detectAnomalies(rows, members, existing, 83.0);
    expect(report.anomalies.some(a => a.anomalyType === 'DUPLICATE_EXPENSE')).toBe(true);
    expect(report.anomalies.some(a => a.anomalyType === 'SETTLEMENT_AS_EXPENSE')).toBe(true);
    expect(report.processedSettlements).toHaveLength(1);
  });
});
