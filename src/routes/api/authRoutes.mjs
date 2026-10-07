import { Router } from 'express';
import * as authController from '../../controllers/api/authController.mjs';
import { requireAuth } from '../../middlewares/auth.mjs';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

export default router;
