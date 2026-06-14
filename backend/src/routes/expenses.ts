import { Router } from 'express';
import { createExpense, getExpenses } from '../controllers/expenseController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', createExpense);
router.get('/', getExpenses);

export default router;
