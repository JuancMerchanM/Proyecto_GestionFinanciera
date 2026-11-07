import type { RequestHandler } from 'express';
import { isHttpError } from '../../middlewares/error.ts';
import * as homeService from '../../services/homeService.ts';
import * as inviteService from '../../services/inviteService.ts';
import { HOME_COOKIE, homeCookieClearOptions } from '../../utils/homeCookie.ts';

export const index: RequestHandler = async (req, res, next) => {
  try {
    res.render('homes/index', {
      title: 'Mis hogares',
      homes: await homeService.listHomesForUser(req.user!),
    });
  } catch (err) {
    next(err);
  }
};

export const showNew: RequestHandler = (req, res) => {
  res.render('homes/new', {
    title: 'Crear hogar',
    form: { name: '' },
  });
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const { name = '', currency = '' } = req.body ?? {};
    const home = await homeService.createHome(req.user!, { name, currency });
    res.redirect(`/homes/${home._id}?success=${encodeURIComponent('Hogar creado correctamente')}`);
  } catch (err) {
    if (isHttpError(err) && (err.status === 400)) {
      const details = Object.values(err.details ?? {}).join('. ') || err.message;
      return res.status(400).render('homes/new', {
        title: 'Crear hogar',
        form: { name: req.body?.name ?? '', currency: req.body?.currency ?? '' },
        error: details,
      });
    }
    next(err);
  }
};

export const show: RequestHandler = async (req, res, next) => {
  try {
    const [members, invites] = await Promise.all([
      homeService.listMembers(req.home!),
      req.homeRole === 'admin' ? inviteService.listPendingInvites(req.home!._id) : [],
    ]);
    res.render('homes/show', {
      title: req.home!.name,
      home: homeService.homeToPublic(req.home!, req.homeRole),
      members,
      invites,
      inviteUrl: (code: string) => `${req.protocol}://${req.get('host')}/invite/${code}`,
    });
  } catch (err) {
    next(err);
  }
};

export const createInvite: RequestHandler = async (req, res, next) => {
  try {
    const invite = await inviteService.createInvite(req.home!, req.user!._id, req.body ?? {});
    res.redirect(
      `/homes/${req.params.homeId as string}?success=${encodeURIComponent(
        `Código generado: ${invite.code} — comparte /invite/${invite.code}`
      )}`
    );
  } catch (err) {
    if (isHttpError(err) && (err.status === 400)) {
      const details = Object.values(err.details ?? {}).join('. ') || err.message;
      return res.redirect(`/homes/${req.params.homeId as string}?error=${encodeURIComponent(details)}`);
    }
    next(err);
  }
};

/** Mensaje legible de un error HTTP para el flash (?error=...). */
const errorMessage = (err: unknown): string => {
  if (!isHttpError(err)) return 'Operación no completada';
  return Object.values(err.details ?? {}).join('. ') || err.message;
};

/** ¿Es un error de negocio esperado que se muestra como flash? */
const isFlashError = (err: unknown): boolean =>
  isHttpError(err) && (err.status === 400 || err.status === 404 || err.status === 409);

export const showEdit: RequestHandler = (req, res) => {
  res.render('homes/edit', {
    title: 'Editar hogar',
    home: homeService.homeToPublic(req.home!, req.homeRole),
    form: { name: req.home!.name },
  });
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const home = await homeService.updateHome(req.home!, req.body ?? {});
    res.redirect(
      `/homes/${home._id.toString()}?success=${encodeURIComponent('Hogar actualizado correctamente')}`
    );
  } catch (err) {
    if (isHttpError(err) && err.status === 400) {
      return res.status(400).render('homes/edit', {
        title: 'Editar hogar',
        home: homeService.homeToPublic(req.home!, req.homeRole),
        form: { name: req.body?.name ?? '' },
        error: errorMessage(err),
      });
    }
    next(err);
  }
};

export const leave: RequestHandler = async (req, res, next) => {
  try {
    await homeService.leaveHome(req.home!, req.user!._id);
    res.clearCookie(HOME_COOKIE, homeCookieClearOptions());
    res.redirect(`/homes?success=${encodeURIComponent('Has salido del hogar')}`);
  } catch (err) {
    if (isFlashError(err)) {
      return res.redirect(
        `/homes/${req.params.homeId as string}?error=${encodeURIComponent(errorMessage(err))}`
      );
    }
    next(err);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    await homeService.deleteHome(req.home!);
    res.clearCookie(HOME_COOKIE, homeCookieClearOptions());
    res.redirect(`/homes?success=${encodeURIComponent('Hogar eliminado correctamente')}`);
  } catch (err) {
    next(err);
  }
};

export const updateMember: RequestHandler = async (req, res, next) => {
  try {
    await homeService.updateMemberRole(req.home!, req.params.userId as string, req.body?.role);
    res.redirect(
      `/homes/${req.params.homeId as string}?success=${encodeURIComponent('Rol actualizado correctamente')}`
    );
  } catch (err) {
    if (isFlashError(err)) {
      return res.redirect(
        `/homes/${req.params.homeId as string}?error=${encodeURIComponent(errorMessage(err))}`
      );
    }
    next(err);
  }
};

export const removeMember: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.params.userId as string;
    await homeService.removeMember(req.home!, userId);
    // Si el admin se quitó a sí mismo, sale del hogar (mismo flujo que "salir").
    if (userId === req.user!._id.toString()) {
      res.clearCookie(HOME_COOKIE, homeCookieClearOptions());
      return res.redirect(`/homes?success=${encodeURIComponent('Has salido del hogar')}`);
    }
    res.redirect(
      `/homes/${req.params.homeId as string}?success=${encodeURIComponent('Miembro quitado del hogar')}`
    );
  } catch (err) {
    if (isFlashError(err)) {
      return res.redirect(
        `/homes/${req.params.homeId as string}?error=${encodeURIComponent(errorMessage(err))}`
      );
    }
    next(err);
  }
};

export const revokeInvite: RequestHandler = async (req, res, next) => {
  try {
    await inviteService.revokeInvite(
      req.home!._id,
      req.params.code as string,
      req.user!._id
    );
    res.redirect(
      `/homes/${req.params.homeId as string}?success=${encodeURIComponent('Invitación revocada')}`
    );
  } catch (err) {
    if (isFlashError(err)) {
      return res.redirect(
        `/homes/${req.params.homeId as string}?error=${encodeURIComponent(errorMessage(err))}`
      );
    }
    next(err);
  }
};
