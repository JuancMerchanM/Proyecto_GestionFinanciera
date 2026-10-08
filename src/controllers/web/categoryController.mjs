import * as categoryService from '../../services/categoryService.mjs';

export const index = async (req, res, next) => {
  try {
    const includeArchived = req.query.archived === '1';
    res.render('categories/index', {
      title: 'Categorías',
      home: { id: req.params.homeId, name: req.home.name, currency: req.home.currency },
      role: req.homeRole,
      includeArchived,
      categories: await categoryService.listCategories(req.home._id, { includeArchived }),
    });
  } catch (err) {
    next(err);
  }
};

export const showNew = (req, res) => {
  res.render('categories/form', {
    title: 'Nueva categoría',
    home: { id: req.params.homeId, name: req.home.name, currency: req.home.currency },
    category: null,
  });
};

const formBack = (req, res, status, error) =>
  res.status(status).render('categories/form', {
    title: req.params.categoryId ? 'Editar categoría' : 'Nueva categoría',
    home: { id: req.params.homeId, name: req.home.name, currency: req.home.currency },
    category: req.categoryView ?? null,
    form: req.body ?? {},
    error,
  });

export const create = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.home._id, req.body ?? {});
    res.redirect(
      `/homes/${req.params.homeId}/categories?success=${encodeURIComponent(`Categoría "${category.name}" creada`)}`
    );
  } catch (err) {
    if (err.status === 400 || err.status === 409) {
      req.categoryView = null;
      return formBack(req, res, err.status, Object.values(err.details ?? {}).join('. ') || err.message);
    }
    next(err);
  }
};

export const showEdit = async (req, res, next) => {
  try {
    const cat = await categoryService.getCategory(req.home._id, req.params.categoryId);
    res.render('categories/form', {
      title: 'Editar categoría',
      home: { id: req.params.homeId, name: req.home.name, currency: req.home.currency },
      category: categoryService.toPublic(cat),
      form: { ...categoryService.toPublic(cat) },
    });
  } catch (err) {
    if (err.status === 404) {
      return res.redirect(
        `/homes/${req.params.homeId}/categories?error=${encodeURIComponent('Categoría no encontrada')}`
      );
    }
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const category = await categoryService.updateCategory(req.home._id, req.params.categoryId, req.body ?? {});
    res.redirect(
      `/homes/${req.params.homeId}/categories?success=${encodeURIComponent(`Categoría "${category.name}" actualizada`)}`
    );
  } catch (err) {
    if (err.status === 400 || err.status === 409) {
      req.categoryView = { id: req.params.categoryId, ...(req.body ?? {}) };
      return formBack(req, res, err.status, Object.values(err.details ?? {}).join('. ') || err.message);
    }
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const result = await categoryService.removeCategory(req.home._id, req.params.categoryId);
    res.redirect(
      `/homes/${req.params.homeId}/categories?success=${encodeURIComponent(result.message)}`
    );
  } catch (err) {
    if (err.status === 404) {
      return res.redirect(
        `/homes/${req.params.homeId}/categories?error=${encodeURIComponent('Categoría no encontrada')}`
      );
    }
    next(err);
  }
};

export const restore = async (req, res, next) => {
  try {
    const category = await categoryService.restoreCategory(req.home._id, req.params.categoryId);
    res.redirect(
      `/homes/${req.params.homeId}/categories?success=${encodeURIComponent(`Categoría "${category.name}" restaurada`)}`
    );
  } catch (err) {
    if (err.status === 404) {
      return res.redirect(
        `/homes/${req.params.homeId}/categories?error=${encodeURIComponent('Categoría no encontrada')}`
      );
    }
    next(err);
  }
};
