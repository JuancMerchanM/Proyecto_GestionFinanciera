import { Router } from 'express';
import * as inviteController from '../../controllers/api/inviteController.ts';
import { requireAuth } from '../../middlewares/auth.ts';

const router = Router();

router.get('/:code', requireAuth, inviteController.preview);
router.post('/:code', requireAuth, inviteController.accept);
router.post('/:code/reject', requireAuth, inviteController.reject);

export default router;
