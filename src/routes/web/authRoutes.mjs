import { Router } from 'express';
import * as authController from '../../controllers/web/authController.mjs';

const router = Router();

router.get('/register', authController.showRegister);
router.post('/register', authController.register);
router.get('/login', authController.showLogin);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

export default router;
