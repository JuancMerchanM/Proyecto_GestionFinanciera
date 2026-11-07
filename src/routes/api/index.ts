import { Router } from 'express';
import authRouter from './authRoutes.ts';
import homeRouter from './homeRoutes.ts';
import inviteRouter from './inviteRoutes.ts';
import notificationRouter from './notificationRoutes.ts';

const router = Router();

router.use('/auth', authRouter);
router.use('/homes', homeRouter);
router.use('/invites', inviteRouter);
router.use('/notifications', notificationRouter);

export default router;
