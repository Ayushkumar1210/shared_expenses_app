import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { calculateBalances } from '../services/balanceCalculator';

export async function getGroupBalances(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: groupId } = req.params;
    const balances = await calculateBalances(groupId);
    return res.json(balances);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
