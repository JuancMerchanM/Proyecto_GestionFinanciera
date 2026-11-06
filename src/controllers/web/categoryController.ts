import type { Request, RequestHandler, Response } from 'express';
import { isHttpError } from '../../middlewares/error.ts';
import * as categoryService from '../../services/categoryService.ts';

export const index: RequestHandler = async (req, res, next) => {
  try {
    const includeArchived = req.query.archived === '1';
    res.render('categories/index', {
      title: 'Categorías',
      home: { id: req.params.homeId as string, name: req.home!.name, currency: req.home!.currency },
      role: req.homeRole,
      includeArchived,
      categories: await categoryService.listCategories(req.home!._id, { includeArchived }),
    });
  } catch (err) {
    next(err);
  }
};

export const showNew: RequestHandler = (req, res) => {
  res.render('categories/form', {
    title: 'Nueva categoría',
    home: { id: req.params.homeId as string, name: req.home!.name, currency: req.home!.currency },
    category: null,
  });
};

const formBack = (req: Request, res: Response, status: number, error: string) =>
  res.status(status).render('categories/form', {
    title: req.params.categoryId as string ? 'Editar categoría' : 'Nueva categoría',
    home: { id: req.params.homeId as string, name: req.home!.name, currency: req.home!.currency },
    category: req.categoryView ?? null,
    form: req.body ?? {},
    error,
  });

export const create: RequestHandler = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.home!._id, req.body ?? {});
    res.redirect(
      `/homes/${req.params.homeId as string}/categories?success=${encodeURIComponent(`Categoría "${category.name}" creada`)}`
    );
  } catch (err) {
    if (isHttpError(err) && (err.status === 400 || err.status === 409)) {
      req.categoryView = null;
      return formBack(req, res, err.status, Object.values(err.details ?? {}).join('. ') || err.message);
    }
    next(err);
  }
};

export const showEdit: RequestHandler = async (req, res, next) => {
  try {
    const cat = await categoryService.getCategory(req.home!._id, req.params.categoryId as string);
    res.render('categories/form', {
      title: 'Editar categoría',
      home: { id: req.params.homeId as string, name: req.home!.name, currency: req.home!.currency },
      category: categoryService.toPublic(cat),
      form: { ...categoryService.toPublic(cat) },
    });
  } catch (err) {
    if (isHttpError(err) && (err.status === 404)) {
      return res.redirect(
        `/homes/${req.params.homeId as string}/categories?error=${encodeURIComponent('Categoría no encontrada')}`
      );
    }
    next(err);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const category = await categoryService.updateCategory(req.home!._id, req.params.categoryId as string, req.body ?? {});
    res.redirect(
      `/homes/${req.params.homeId as string}/categories?success=${encodeURIComponent(`Categoría "${category.name}" actualizada`)}`
    );
  } catch (err) {
    if (isHttpError(err) && (err.status === 400 || err.status === 409)) {
      req.categoryView = { id: req.params.categoryId as string, ...(req.body ?? {}) };
      return formBack(req, res, err.status, Object.values(err.details ?? {}).join('. ') || err.message);
    }
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const result = await categoryService.removeCategory(req.home!._id, req.params.categoryId as string);
    res.redirect(
      `/homes/${req.params.homeId as string}/categories?success=${encodeURIComponent(result.message)}`
    );
  } catch (err) {
    if (isHttpError(err) && (err.status === 404)) {
      return res.redirect(
        `/homes/${req.params.homeId as string}/categories?error=${encodeURIComponent('Categoría no encontrada')}`
      );
    }
    next(err);
  }
};

export const restore: RequestHandler = async (req, res, next) => {
  try {
    const category = await categoryService.restoreCategory(req.home!._id, req.params.categoryId as string);
    res.redirect(
      `/homes/${req.params.homeId as string}/categories?success=${encodeURIComponent(`Categoría "${category.name}" restaurada`)}`
    );
  } catch (err) {
    if (isHttpError(err) && (err.status === 404)) {
      return res.redirect(
        `/homes/${req.params.homeId as string}/categories?error=${encodeURIComponent('Categoría no encontrada')}`
      );
    }
    next(err);
  }
};
