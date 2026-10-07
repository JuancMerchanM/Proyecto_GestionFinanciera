import * as categoryService from '../../services/categoryService.mjs';

/**
 * @openapi
 * /api/homes/{homeId}/categories:
 *   get:
 *     tags: [Categorías]
 *     summary: Listar categorías del hogar
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - in: query
 *         name: includeArchived
 *         schema: { type: boolean, default: false }
 *         description: Incluir categorías archivadas
 *     responses:
 *       '200':
 *         description: Categorías (gastos e ingresos)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 categories:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Category' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     tags: [Categorías]
 *     summary: Crear categoría (solo admin del hogar)
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CategoryInput' }
 *           example: { name: 'Mascotas', color: '#ff8a3d', type: 'expense' }
 *     responses:
 *       '201':
 *         description: Categoría creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 category: { $ref: '#/components/schemas/Category' }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '403': { description: Requiere rol admin o acceso denegado al hogar }
 *       '409': { description: Nombre duplicado en el mismo tipo }
 */
export const list = async (req, res, next) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    res.json({
      categories: await categoryService.listCategories(req.home._id, { includeArchived }),
    });
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.home._id, req.body ?? {});
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/homes/{homeId}/categories/{categoryId}:
 *   put:
 *     tags: [Categorías]
 *     summary: Editar categoría (solo admin)
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/categoryId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CategoryInput' }
 *           example: { name: 'Mascotas', color: '#ff8a3d', type: 'expense' }
 *     responses:
 *       '200': { description: Categoría actualizada }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '403': { description: Requiere rol admin }
 *       '404': { description: Categoría no encontrada }
 *       '409': { description: Nombre duplicado }
 *   delete:
 *     tags: [Categorías]
 *     summary: Eliminar categoría (solo admin). Si tiene transacciones se archiva
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/categoryId'
 *     responses:
 *       '200':
 *         description: 'mode=deleted (sin transacciones) o mode=archived (con transacciones)'
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mode: { type: string, enum: [deleted, archived] }
 *                 message: { type: string }
 *       '403': { description: Requiere rol admin }
 *       '404': { description: Categoría no encontrada }
 */
export const update = async (req, res, next) => {
  try {
    res.json({ category: await categoryService.updateCategory(req.home._id, req.params.categoryId, req.body ?? {}) });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    res.json(await categoryService.removeCategory(req.home._id, req.params.categoryId));
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/homes/{homeId}/categories/{categoryId}/restore:
 *   post:
 *     tags: [Categorías]
 *     summary: Restaurar una categoría archivada (solo admin)
 *     parameters:
 *       - $ref: '#/components/parameters/homeId'
 *       - $ref: '#/components/parameters/categoryId'
 *     responses:
 *       '200': { description: Categoría restaurada }
 *       '403': { description: Requiere rol admin }
 *       '404': { description: Categoría no encontrada }
 */
export const restore = async (req, res, next) => {
  try {
    res.json({ category: await categoryService.restoreCategory(req.home._id, req.params.categoryId) });
  } catch (err) {
    next(err);
  }
};
