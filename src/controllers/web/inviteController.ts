import type { RequestHandler } from 'express';
import type { Types } from 'mongoose';
import { isHttpError } from '../../middlewares/error.ts';
import * as inviteService from '../../services/inviteService.ts';
import { env } from '../../config/env.ts';

const currentHomeCookie = (homeId: string | Types.ObjectId) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.isProd,
  maxAge: 30 * 24 * 60 * 60 * 1000,
});

export const show: RequestHandler = async (req, res, next) => {
  try {
    const invite = await inviteService.previewInvite(req.params.code as string);
    res.render('invites/show', {
      title: 'Invitación',
      invite,
    });
  } catch (err) {
    if (isHttpError(err) && (err.status === 404)) {
      return res.status(404).render('error', {
        title: 'Invitación no encontrada',
        status: 404,
        message: 'El código de invitación no existe o es inválido',
      });
    }
    next(err);
  }
};

export const accept: RequestHandler = async (req, res, next) => {
  try {
    const { home, role } = await inviteService.acceptInvite(req.user!, req.params.code as string);
    res.cookie('currentHomeId', home._id.toString(), currentHomeCookie(home._id));
    res.redirect(
      `/homes/${home._id}?success=${encodeURIComponent(`Te uniste a ${home.name} como ${role}`)}`
    );
  } catch (err) {
    if (isHttpError(err) && (err.status === 403 || err.status === 404 || err.status === 409)) {
      return res.redirect(
        `/invite/${req.params.code as string}?error=${encodeURIComponent(err.message)}`
      );
    }
    next(err);
  }
};

export const reject: RequestHandler = async (req, res, next) => {
  try {
    await inviteService.rejectInvite(req.user!, req.params.code as string);
    res.redirect(`/?success=${encodeURIComponent('Invitación rechazada')}`);
  } catch (err) {
    if (isHttpError(err) && (err.status === 403 || err.status === 404 || err.status === 409)) {
      return res.redirect(
        `/invite/${req.params.code as string}?error=${encodeURIComponent(err.message)}`
      );
    }
    next(err);
  }
};
