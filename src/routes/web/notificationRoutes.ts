import { Router } from 'express';
import * as notificationController from '../../controllers/web/notificationController.ts';
import { requireAuthWeb } from '../../middlewares/auth.ts';

const router = Router();

router.get('/', requireAuthWeb, notificationController.index);
router.post('/read-all', requireAuthWeb, notificationController.readAll);
router.post('/:id/read', requireAuthWeb, notificationController.read);

export default router;
