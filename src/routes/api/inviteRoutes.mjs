import { Router } from 'express';
import * as inviteController from '../../controllers/api/inviteController.mjs';
import { requireAuth } from '../../middlewares/auth.mjs';

const router = Router();

router.get('/:code', requireAuth, inviteController.preview);
router.post('/:code', requireAuth, inviteController.accept);
router.post('/:code/reject', requireAuth, inviteController.reject);

export default router;
