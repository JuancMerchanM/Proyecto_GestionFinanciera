import { Types } from 'mongoose';
import { HttpError } from './error.mjs';
import { Home } from '../models/home.mjs';

// Aislamiento entre hogares (crítico): homeId de la URL debe pertenecer a user.homeIds.
export const requireHomeMember = async (req, res, next) => {
  try {
    const raw = req.params.homeId;
    if (!raw || !Types.ObjectId.isValid(raw)) {
      throw new HttpError(404, 'Hogar no encontrado');
    }

    const inUserList = req.user.homeIds?.some((id) => id.toString() === raw);
    if (!inUserList) {
      throw new HttpError(403, 'No tiene acceso a este hogar');
    }

    const home = await Home.findById(raw).lean();
    if (!home) throw new HttpError(404, 'Hogar no encontrado');

    const membership = home.members.find((m) => m.userId.toString() === req.user._id.toString());
    if (!membership) throw new HttpError(403, 'No tiene acceso a este hogar');

    req.home = home;
    req.homeId = raw;
    req.homeRole = membership.role;
    next();
  } catch (err) {
    if (err instanceof HttpError && err.status === 403 && !req.path.startsWith('/api')) {
      res.clearCookie('currentHomeId', { httpOnly: true, sameSite: 'lax' });
    }
    next(err);
  }
};
