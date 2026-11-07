import { env } from '../config/env.ts';

/** Cookie que recuerda el hogar seleccionado por el usuario (vigencia 30 días). */
export const HOME_COOKIE = 'currentHomeId';

const baseOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.isProd,
};

/** Opciones para setear la cookie del hogar actual. */
export const homeCookieOptions = () => ({ ...baseOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

/** Opciones para limpiar la cookie (mismas que al setear, sin maxAge). */
export const homeCookieClearOptions = () => ({ ...baseOptions });
