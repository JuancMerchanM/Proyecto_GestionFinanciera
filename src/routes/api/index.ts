import { Router } from 'express';
import authRouter from './authRoutes.ts';
import homeRouter from './homeRoutes.ts';
import inviteRouter from './inviteRoutes.ts';

const router = Router();

router.use('/auth', authRouter);
router.use('/homes', homeRouter);
router.use('/invites', inviteRouter);

export default router;
