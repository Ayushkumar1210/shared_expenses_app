import { Router } from 'express';
import { createGroup, getGroups, getGroupById, joinGroup, leaveGroup } from '../controllers/groupController';
import { getGroupBalances } from '../controllers/balanceController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/', getGroups);
router.post('/', createGroup);
router.get('/:id', getGroupById);
router.post('/:id/join', joinGroup);
router.post('/:id/leave', leaveGroup);
router.get('/:id/balances', getGroupBalances);

export default router;
