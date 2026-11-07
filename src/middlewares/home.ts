import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import { HttpError } from './error.ts';
import { Home } from '../models/home.ts';
import { HOME_COOKIE, homeCookieClearOptions, homeCookieOptions } from '../utils/homeCookie.ts';

// Aislamiento entre hogares (crítico): homeId de la URL debe pertenecer a user.homeIds.
export const requireHomeMember: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.homeId;
    if (typeof raw !== 'string' || !raw || !Types.ObjectId.isValid(raw)) {
      throw new HttpError(404, 'Hogar no encontrado');
    }

    const inUserList = req.user?.homeIds?.some((id) => id.toString() === raw);
    if (!inUserList) {
      throw new HttpError(403, 'No tiene acceso a este hogar');
    }

    const home = await Home.findById(raw).lean();
    if (!home) throw new HttpError(404, 'Hogar no encontrado');

    const membership = Home.getMembership(home, req.user!._id);
    if (!membership) throw new HttpError(403, 'No tiene acceso a este hogar');

    req.home = home;
    req.homeId = raw;
    req.homeRole = membership.role;

    // Selector del nav: recuerda el hogar visitado (solo si difiere y solo en web).
    if (!req.baseUrl.startsWith('/api') && req.cookies?.[HOME_COOKIE] !== raw) {
      res.cookie(HOME_COOKIE, raw, homeCookieOptions());
    }
    next();
  } catch (err) {
    if (err instanceof HttpError && err.status === 403 && !req.baseUrl.startsWith('/api')) {
      res.clearCookie(HOME_COOKIE, homeCookieClearOptions());
    }
    next(err);
  }
};
