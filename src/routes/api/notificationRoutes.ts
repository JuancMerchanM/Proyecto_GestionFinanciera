import { Router } from 'express';
import * as notificationController from '../../controllers/api/notificationController.ts';
import { requireAuth } from '../../middlewares/auth.ts';

const router = Router();

router.get('/', requireAuth, notificationController.list);
router.post('/read-all', requireAuth, notificationController.readAll);
router.post('/:id/read', requireAuth, notificationController.read);

export default router;
