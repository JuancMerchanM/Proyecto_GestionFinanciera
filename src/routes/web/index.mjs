import { Router } from 'express';
import * as siteController from '../../controllers/web/siteController.mjs';
import authRouter from './authRoutes.mjs';
import homeRouter from './homeRoutes.mjs';
import inviteRouter from './inviteRoutes.mjs';

const router = Router();

router.use('/', authRouter);
router.use('/homes', homeRouter);
router.use('/invite', inviteRouter);
router.get('/', siteController.landing);

export default router;
