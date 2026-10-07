import { Router } from 'express';
import authRouter from './authRoutes.mjs';
import homeRouter from './homeRoutes.mjs';
import inviteRouter from './inviteRoutes.mjs';

const router = Router();

router.use('/auth', authRouter);
router.use('/homes', homeRouter);
router.use('/invites', inviteRouter);

export default router;
