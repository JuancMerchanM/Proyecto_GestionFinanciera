import { HttpError } from './error.mjs';

// Roles por hogar ('admin' | 'member'). req.homeRole lo inyecta el
// middleware de membresía.
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Autenticación requerida'));
  if (!req.homeRole) return next(new HttpError(403, 'No tiene permisos sobre este hogar'));
  if (!roles.includes(req.homeRole)) {
    return next(new HttpError(403, `Requiere rol: ${roles.join(' o ')}`));
  }
  next();
};
