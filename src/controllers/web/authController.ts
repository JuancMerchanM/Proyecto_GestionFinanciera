import type { RequestHandler } from 'express';
import { HttpError, isHttpError } from '../../middlewares/error.ts';
import * as authService from '../../services/authService.ts';
import { COOKIE_NAME } from '../../middlewares/auth.ts';
import { env } from '../../config/env.ts';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.isProd,
  maxAge: 8 * 60 * 60 * 1000,
});

const detailsToMessage = (err: unknown): string => {
  const e = err as HttpError;
  if (e.details && typeof e.details === 'object') {
    return Object.values(e.details).join('. ');
  }
  return e.message;
};

export const showRegister: RequestHandler = (req, res) => {
  if (req.user!) return res.redirect('/');
  res.render('auth/register', { title: 'Crear cuenta', form: { name: '', email: '' } });
};

export const register: RequestHandler = async (req, res, next) => {
  try {
    const { name = '', email = '', password = '', password2 = '' } = req.body ?? {};
    if (password !== password2) {
      return res.status(400).render('auth/register', {
        title: 'Crear cuenta',
        form: { name, email },
        error: 'Las contraseñas no coinciden',
      });
    }
    const user = await authService.register({ name, email, password });
    const token = authService.issueToken(user);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.redirect(`/?success=${encodeURIComponent('Cuenta creada. ¡Bienvenido/a!')}`);
  } catch (err) {
    if (isHttpError(err) && (err.status === 400 || err.status === 409)) {
      return res.status(err.status).render('auth/register', {
        title: 'Crear cuenta',
        form: { name: req.body?.name ?? '', email: req.body?.email ?? '' },
        error: detailsToMessage(err),
      });
    }
    next(err);
  }
};

const safeNext = (value: unknown): string =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';

export const showLogin: RequestHandler = (req, res) => {
  if (req.user!) return res.redirect(safeNext(req.query.next));
  res.render('auth/login', {
    title: 'Iniciar sesión',
    form: { email: '' },
    next: safeNext(req.query.next),
  });
};

export const login: RequestHandler = async (req, res, next) => {
  const { email = '', password = '', next: nextPath = '/' } = req.body ?? {};
  try {
    const user = await authService.login({ email, password });
    const token = authService.issueToken(user);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.redirect(safeNext(nextPath));
  } catch (err) {
    if (isHttpError(err) && (err.status === 400 || err.status === 401)) {
      return res.status(err.status).render('auth/login', {
        title: 'Iniciar sesión',
        form: { email },
        next: safeNext(nextPath),
        error: detailsToMessage(err),
      });
    }
    next(err);
  }
};

export const logout: RequestHandler = (req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: env.isProd });
  res.redirect(`/login?success=${encodeURIComponent('Sesión cerrada')}`);
};
