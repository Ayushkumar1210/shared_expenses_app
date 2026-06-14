import { Router } from 'express';
import { createSettlement, getSettlements } from '../controllers/settlementController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', createSettlement);
router.get('/', getSettlements);

export default router;
