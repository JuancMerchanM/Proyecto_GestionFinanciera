import { Router } from 'express';
import * as inviteController from '../../controllers/web/inviteController.mjs';
import { requireAuthWeb } from '../../middlewares/auth.mjs';

const router = Router();

router.get('/:code', requireAuthWeb, inviteController.show);
router.post('/:code/accept', requireAuthWeb, inviteController.accept);
router.post('/:code/reject', requireAuthWeb, inviteController.reject);

export default router;
