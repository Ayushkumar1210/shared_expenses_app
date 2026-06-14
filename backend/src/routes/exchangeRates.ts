import { Router } from 'express';
import { getExchangeRates, updateExchangeRate } from '../controllers/exchangeRateController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getExchangeRates);
router.post('/', updateExchangeRate);

export default router;
