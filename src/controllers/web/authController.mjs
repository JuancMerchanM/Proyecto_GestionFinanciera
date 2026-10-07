import * as authService from '../../services/authService.mjs';
import { COOKIE_NAME } from '../../middlewares/auth.mjs';
import { env } from '../../config/env.mjs';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProd,
  maxAge: 8 * 60 * 60 * 1000,
});

const detailsToMessage = (err) => {
  if (err.details && typeof err.details === 'object') {
    return Object.values(err.details).join('. ');
  }
  return err.message;
};

export const showRegister = (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/register', { title: 'Crear cuenta', form: { name: '', email: '' } });
};

export const register = async (req, res, next) => {
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
    if (err.status === 400 || err.status === 409) {
      return res.status(err.status).render('auth/register', {
        title: 'Crear cuenta',
        form: { name: req.body?.name ?? '', email: req.body?.email ?? '' },
        error: detailsToMessage(err),
      });
    }
    next(err);
  }
};

const safeNext = (value) =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';

export const showLogin = (req, res) => {
  if (req.user) return res.redirect(safeNext(req.query.next));
  res.render('auth/login', {
    title: 'Iniciar sesión',
    form: { email: '' },
    next: safeNext(req.query.next),
    error: req.query.error ?? null,
    success: req.query.success ?? null,
  });
};

export const login = async (req, res, next) => {
  const { email = '', password = '', next: nextPath = '/' } = req.body ?? {};
  try {
    const user = await authService.login({ email, password });
    const token = authService.issueToken(user);
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.redirect(safeNext(nextPath));
  } catch (err) {
    if (err.status === 400 || err.status === 401) {
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

export const logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: env.isProd });
  res.redirect(`/login?success=${encodeURIComponent('Sesión cerrada')}`);
};
