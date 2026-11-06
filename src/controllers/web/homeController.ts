import type { RequestHandler } from 'express';
import type { Types } from 'mongoose';
import { isHttpError } from '../../middlewares/error.ts';
import * as homeService from '../../services/homeService.ts';
import * as inviteService from '../../services/inviteService.ts';
import { env } from '../../config/env.ts';

const currentHomeCookie = (homeId: string | Types.ObjectId) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.isProd,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
});

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
    res.cookie('currentHomeId', home._id.toString(), currentHomeCookie(home._id));
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
    res.cookie('currentHomeId', req.params.homeId as string, currentHomeCookie(req.params.homeId as string));
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
