import * as inviteService from '../../services/inviteService.mjs';
import { env } from '../../config/env.mjs';

const currentHomeCookie = (homeId) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProd,
  maxAge: 30 * 24 * 60 * 60 * 1000,
});

export const show = async (req, res, next) => {
  try {
    const invite = await inviteService.previewInvite(req.params.code);
    res.render('invites/show', {
      title: 'Invitación',
      invite,
      error: req.query.error ?? null,
      success: req.query.success ?? null,
    });
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).render('error', {
        title: 'Invitación no encontrada',
        status: 404,
        message: 'El código de invitación no existe o es inválido',
      });
    }
    next(err);
  }
};

export const accept = async (req, res, next) => {
  try {
    const { home, role } = await inviteService.acceptInvite(req.user, req.params.code);
    res.cookie('currentHomeId', home._id.toString(), currentHomeCookie(home._id));
    res.redirect(
      `/homes/${home._id}?success=${encodeURIComponent(`Te uniste a ${home.name} como ${role}`)}`
    );
  } catch (err) {
    if (err.status === 403 || err.status === 404 || err.status === 409) {
      return res.redirect(
        `/invite/${req.params.code}?error=${encodeURIComponent(err.message)}`
      );
    }
    next(err);
  }
};

export const reject = async (req, res, next) => {
  try {
    await inviteService.rejectInvite(req.user, req.params.code);
    res.redirect(`/?success=${encodeURIComponent('Invitación rechazada')}`);
  } catch (err) {
    if (err.status === 403 || err.status === 404 || err.status === 409) {
      return res.redirect(
        `/invite/${req.params.code}?error=${encodeURIComponent(err.message)}`
      );
    }
    next(err);
  }
};
