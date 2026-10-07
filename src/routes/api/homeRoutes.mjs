import { Router } from 'express';
import * as homeController from '../../controllers/api/homeController.mjs';
import * as categoryController from '../../controllers/api/categoryController.mjs';
import * as accountController from '../../controllers/api/accountController.mjs';
import * as transactionController from '../../controllers/api/transactionController.mjs';
import * as budgetController from '../../controllers/api/budgetController.mjs';
import * as reportController from '../../controllers/api/reportController.mjs';
import { requireAuth } from '../../middlewares/auth.mjs';
import { requireHomeMember } from '../../middlewares/home.mjs';
import { requireRole } from '../../middlewares/role.mjs';

const router = Router();

router.get('/', requireAuth, homeController.list);
router.post('/', requireAuth, homeController.create);
router.get('/:homeId', requireAuth, requireHomeMember, homeController.detail);
router.get('/:homeId/members', requireAuth, requireHomeMember, homeController.members);
router.post(
  '/:homeId/invites',
  requireAuth,
  requireHomeMember,
  requireRole('admin'),
  homeController.createInvite
);
router.get(
  '/:homeId/invites',
  requireAuth,
  requireHomeMember,
  requireRole('admin'),
  homeController.listInvites
);

// Categorías: lectura para miembros, escritura solo admin
router.get('/:homeId/categories', requireAuth, requireHomeMember, categoryController.list);
router.post(
  '/:homeId/categories',
  requireAuth,
  requireHomeMember,
  requireRole('admin'),
  categoryController.create
);
router.put(
  '/:homeId/categories/:categoryId',
  requireAuth,
  requireHomeMember,
  requireRole('admin'),
  categoryController.update
);
router.delete(
  '/:homeId/categories/:categoryId',
  requireAuth,
  requireHomeMember,
  requireRole('admin'),
  categoryController.remove
);
router.post(
  '/:homeId/categories/:categoryId/restore',
  requireAuth,
  requireHomeMember,
  requireRole('admin'),
  categoryController.restore
);

// Cuentas: lectura para miembros, escritura solo admin
router.get('/:homeId/accounts', requireAuth, requireHomeMember, accountController.list);
router.post(
  '/:homeId/accounts',
  requireAuth,
  requireHomeMember,
  requireRole('admin'),
  accountController.create
);
router.get('/:homeId/accounts/:accountId', requireAuth, requireHomeMember, accountController.detail);
router.put(
  '/:homeId/accounts/:accountId',
  requireAuth,
  requireHomeMember,
  requireRole('admin'),
  accountController.update
);
router.delete(
  '/:homeId/accounts/:accountId',
  requireAuth,
  requireHomeMember,
  requireRole('admin'),
  accountController.remove
);
router.post(
  '/:homeId/accounts/:accountId/restore',
  requireAuth,
  requireHomeMember,
  requireRole('admin'),
  accountController.restore
);

// Transacciones: cualquier miembro registra; modifica las suyas (admin: todas)
router.get('/:homeId/transactions', requireAuth, requireHomeMember, transactionController.list);
router.post('/:homeId/transactions', requireAuth, requireHomeMember, transactionController.create);
router.get(
  '/:homeId/transactions/:transactionId',
  requireAuth,
  requireHomeMember,
  transactionController.detail
);
router.put(
  '/:homeId/transactions/:transactionId',
  requireAuth,
  requireHomeMember,
  transactionController.update
);
router.delete(
  '/:homeId/transactions/:transactionId',
  requireAuth,
  requireHomeMember,
  transactionController.remove
);

// Presupuestos: lectura miembros, escritura solo admin
router.get('/:homeId/budgets', requireAuth, requireHomeMember, budgetController.list);
router.post(
  '/:homeId/budgets',
  requireAuth,
  requireHomeMember,
  requireRole('admin'),
  budgetController.create
);
router.get(
  '/:homeId/budgets/:budgetId',
  requireAuth,
  requireHomeMember,
  budgetController.detail
);
router.put(
  '/:homeId/budgets/:budgetId',
  requireAuth,
  requireHomeMember,
  requireRole('admin'),
  budgetController.update
);
router.delete(
  '/:homeId/budgets/:budgetId',
  requireAuth,
  requireHomeMember,
  requireRole('admin'),
  budgetController.remove
);

// Reportes / dashboard: lectura para miembros
router.get(
  '/:homeId/reports/summary',
  requireAuth,
  requireHomeMember,
  reportController.summary
);

export default router;
