import type { Request, RequestHandler } from 'express';
import { HttpError } from './error.ts';
import { verifyToken } from '../services/authService.ts';
import { User } from '../models/user.ts';

export const COOKIE_NAME = 'token';

export const extractToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME] as string;
  return null;
};

// Adjunta req.user si hay token válido; no falla si no lo hay (para nav/layout).
export const authenticate: RequestHandler = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      const payload = verifyToken(token);
      const sub = typeof payload === 'string' ? undefined : payload.sub;
      const user = sub ? await User.findLeanById(sub) : null;
      if (user) {
        req.user = user;
        res.locals.currentUser = { id: user._id.toString(), name: user.name, email: user.email };
      }
    }
  } catch {
    // token inválido/expirado: se ignora aquí; requireAuth responde 401
  }
  if (!res.locals.currentUser) res.locals.currentUser = null;
  next();
};

// Exige JWT valido
export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) throw new HttpError(401, 'Autenticación requerida');
    const payload = verifyToken(token);
    const sub = typeof payload === 'string' ? undefined : payload.sub;
    const user = sub ? await User.findLeanById(sub) : null;
    if (!user) throw new HttpError(401, 'Usuario no encontrado o sesión inválida');
    req.user = user;
    res.locals.currentUser = { id: user._id.toString(), name: user.name, email: user.email };
    next();
  } catch (err) {
    if (err instanceof HttpError) return next(err);
    return next(new HttpError(401, 'Token inválido o expirado'));
  }
};

// Redirige a /login en vez de devolver 401.
export const requireAuthWeb: RequestHandler = (req, res, next) => {
  if (req.user) return next();
  const params = new URLSearchParams({
    error: 'Debe iniciar sesión para continuar',
    next: req.originalUrl,
  });
  return res.redirect(`/login?${params.toString()}`);
};
