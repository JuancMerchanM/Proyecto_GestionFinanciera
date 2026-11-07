import { Router } from 'express';
import * as homeController from '../../controllers/web/homeController.ts';
import * as categoryController from '../../controllers/web/categoryController.ts';
import * as accountController from '../../controllers/web/accountController.ts';
import * as transactionController from '../../controllers/web/transactionController.ts';
import * as budgetController from '../../controllers/web/budgetController.ts';
import * as dashboardController from '../../controllers/web/dashboardController.ts';
import { requireAuthWeb } from '../../middlewares/auth.ts';
import { requireHomeMember } from '../../middlewares/home.ts';
import { requireRole } from '../../middlewares/role.ts';

const router = Router();

router.get('/', requireAuthWeb, homeController.index);
router.get('/new', requireAuthWeb, homeController.showNew);
router.post('/', requireAuthWeb, homeController.create);
router.post(
  '/:homeId/invites',
  requireAuthWeb,
  requireHomeMember,
  requireRole('admin'),
  homeController.createInvite
);

// Categorías
const member = [requireAuthWeb, requireHomeMember];
const admin = [...member, requireRole('admin')];
router.get('/:homeId/categories', ...member, categoryController.index);
router.get('/:homeId/categories/new', ...admin, categoryController.showNew);
router.post('/:homeId/categories', ...admin, categoryController.create);
router.get('/:homeId/categories/:categoryId/edit', ...admin, categoryController.showEdit);
router.post('/:homeId/categories/:categoryId', ...admin, categoryController.update);
router.post('/:homeId/categories/:categoryId/delete', ...admin, categoryController.remove);
router.post('/:homeId/categories/:categoryId/restore', ...admin, categoryController.restore);

// Cuentas
router.get('/:homeId/accounts', ...member, accountController.index);
router.get('/:homeId/accounts/new', ...admin, accountController.showNew);
router.post('/:homeId/accounts', ...admin, accountController.create);
router.get('/:homeId/accounts/:accountId/edit', ...admin, accountController.showEdit);
router.post('/:homeId/accounts/:accountId', ...admin, accountController.update);
router.post('/:homeId/accounts/:accountId/delete', ...admin, accountController.remove);
router.post('/:homeId/accounts/:accountId/restore', ...admin, accountController.restore);

// Transacciones
router.get('/:homeId/transactions', ...member, transactionController.index);
router.get('/:homeId/transactions/new', ...member, transactionController.showNew);
router.post('/:homeId/transactions', ...member, transactionController.create);
router.get(
  '/:homeId/transactions/:transactionId/edit',
  ...member,
  transactionController.showEdit
);
router.post('/:homeId/transactions/:transactionId', ...member, transactionController.update);
router.post(
  '/:homeId/transactions/:transactionId/delete',
  ...member,
  transactionController.remove
);

// Presupuestos: lectura miembros, escritura solo admin
router.get('/:homeId/budgets', ...member, budgetController.index);
router.get('/:homeId/budgets/new', ...admin, budgetController.showNew);
router.post('/:homeId/budgets', ...admin, budgetController.create);
router.get('/:homeId/budgets/:budgetId/edit', ...admin, budgetController.showEdit);
router.post('/:homeId/budgets/:budgetId', ...admin, budgetController.update);
router.post('/:homeId/budgets/:budgetId/delete', ...admin, budgetController.remove);

// Dashboard
router.get('/:homeId/dashboard', ...member, dashboardController.index);

// Gestión del hogar (editar nombre, bajas, miembros, invitaciones)
router.get('/:homeId/edit', ...admin, homeController.showEdit);
router.post('/:homeId', ...admin, homeController.update);
router.post('/:homeId/leave', ...member, homeController.leave);
router.post('/:homeId/delete', ...admin, homeController.remove);
router.post('/:homeId/members/:userId', ...admin, homeController.updateMember);
router.post('/:homeId/members/:userId/delete', ...admin, homeController.removeMember);
router.post('/:homeId/invites/:code/revoke', ...admin, homeController.revokeInvite);

router.get('/:homeId', ...member, homeController.show);

export default router;
