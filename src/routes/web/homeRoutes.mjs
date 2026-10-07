import { Router } from 'express';
import * as homeController from '../../controllers/web/homeController.mjs';
import * as categoryController from '../../controllers/web/categoryController.mjs';
import * as accountController from '../../controllers/web/accountController.mjs';
import * as transactionController from '../../controllers/web/transactionController.mjs';
import * as budgetController from '../../controllers/web/budgetController.mjs';
import * as dashboardController from '../../controllers/web/dashboardController.mjs';
import { requireAuthWeb } from '../../middlewares/auth.mjs';
import { requireHomeMember } from '../../middlewares/home.mjs';
import { requireRole } from '../../middlewares/role.mjs';

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

router.get('/:homeId', ...member, homeController.show);

export default router;
