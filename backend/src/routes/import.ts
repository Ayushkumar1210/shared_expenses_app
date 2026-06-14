import { Router } from 'express';
import { uploadAndProcessCsv, getImportReport, confirmImport } from '../controllers/importController';
import { authMiddleware } from '../middlewares/auth';
import multer from 'multer';
import * as path from 'path';

const upload = multer({ dest: path.join(__dirname, '../../uploads/') });

const router = Router();

router.use(authMiddleware);

router.post('/', upload.single('file'), uploadAndProcessCsv);
router.get('/:id/report', getImportReport);
router.post('/:id/confirm', confirmImport);

export default router;
