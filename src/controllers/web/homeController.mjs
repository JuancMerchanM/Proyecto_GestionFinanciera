import * as homeService from '../../services/homeService.mjs';
import * as inviteService from '../../services/inviteService.mjs';
import { env } from '../../config/env.mjs';

const currentHomeCookie = (homeId) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProd,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
});

const message = (req, key) => req.query[key] ?? null;

export const index = async (req, res, next) => {
  try {
    res.render('homes/index', {
      title: 'Mis hogares',
      homes: await homeService.listHomesForUser(req.user),
      error: message(req, 'error'),
    });
  } catch (err) {
    next(err);
  }
};

export const showNew = (req, res) => {
  res.render('homes/new', {
    title: 'Crear hogar',
    form: { name: '' },
    error: message(req, 'error'),
  });
};

export const create = async (req, res, next) => {
  try {
    const { name = '', currency = '' } = req.body ?? {};
    const home = await homeService.createHome(req.user, { name, currency });
    res.cookie('currentHomeId', home._id.toString(), currentHomeCookie(home._id));
    res.redirect(`/homes/${home._id}?success=${encodeURIComponent('Hogar creado correctamente')}`);
  } catch (err) {
    if (err.status === 400) {
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

export const show = async (req, res, next) => {
  try {
    res.cookie('currentHomeId', req.params.homeId, currentHomeCookie(req.params.homeId));
    const [members, invites] = await Promise.all([
      homeService.listMembers(req.home),
      req.homeRole === 'admin' ? inviteService.listPendingInvites(req.home._id) : [],
    ]);
    res.render('homes/show', {
      title: req.home.name,
      home: homeService.homeToPublic(req.home, req.homeRole),
      members,
      invites,
      inviteUrl: (code) => `${req.protocol}://${req.get('host')}/invite/${code}`,
      success: message(req, 'success'),
      error: message(req, 'error'),
    });
  } catch (err) {
    next(err);
  }
};

export const createInvite = async (req, res, next) => {
  try {
    const invite = await inviteService.createInvite(req.home, req.user._id, req.body ?? {});
    res.redirect(
      `/homes/${req.params.homeId}?success=${encodeURIComponent(
        `Código generado: ${invite.code} — comparte /invite/${invite.code}`
      )}`
    );
  } catch (err) {
    if (err.status === 400) {
      const details = Object.values(err.details ?? {}).join('. ') || err.message;
      return res.redirect(`/homes/${req.params.homeId}?error=${encodeURIComponent(details)}`);
    }
    next(err);
  }
};
