import { Router } from 'express';
import * as siteController from '../../controllers/web/siteController.ts';
import authRouter from './authRoutes.ts';
import homeRouter from './homeRoutes.ts';
import inviteRouter from './inviteRoutes.ts';
import notificationRouter from './notificationRoutes.ts';

const router = Router();

router.use('/', authRouter);
router.use('/homes', homeRouter);
router.use('/invite', inviteRouter);
router.use('/notifications', notificationRouter);
router.get('/', siteController.landing);

export default router;
