import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { JwtPayload, SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.ts';
import { HttpError } from '../middlewares/error.ts';
import { User } from '../models/user.ts';
import type { IUser } from '../models/user.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Credenciales crudas (tipadas como unknown: llegan desde req.body). */
interface Credentials {
  name?: unknown;
  email?: unknown;
  password?: unknown;
}

const validate = ({ name, email, password }: Credentials): void => {
  const details: Record<string, string> = {};
  if (!name || (name as string).trim().length < 2 || (name as string).trim().length > 80) {
    details.name = 'El nombre debe tener entre 2 y 80 caracteres';
  }
  if (!email || !EMAIL_RE.test(email as string)) {
    details.email = 'Ingrese un email válido';
  }
  if (!password || (password as string).length < 8 || (password as string).length > 72) {
    details.password = 'La contraseña debe tener entre 8 y 72 caracteres';
  }
  if (Object.keys(details).length) {
    throw new HttpError(400, 'Datos de registro inválidos', details);
  }
};

/**
 * Registra un usuario nuevo con contraseña hasheada y devuelve el documento creado.
 * Lanza HttpError(400) con detalles si los datos son inválidos o 409 si el email ya existe.
 */
export const register = async ({ name, email, password }: Credentials) => {
  validate({ name, email, password });
  const normalizedEmail = (email as string).trim().toLowerCase();

  const existing = await User.findByEmail(normalizedEmail);
  if (existing) {
    throw new HttpError(409, 'El email ya está registrado', { email: 'El email ya está registrado' });
  }

  const passwordHash = await bcrypt.hash(password as string, env.bcryptRounds);
  try {
    const user = await User.create({
      name: (name as string).trim(),
      email: normalizedEmail,
      passwordHash,
    });
    return user;
  } catch (err) {
    if ((err as { code?: number } | null)?.code === 11000) {
      throw new HttpError(409, 'El email ya está registrado', { email: 'El email ya está registrado' });
    }
    throw err;
  }
};

/**
 * Valida credenciales y devuelve el usuario cuando coinciden.
 * Lanza HttpError(400) si faltan datos o 401 si son incorrectas.
 */
export const login = async ({ email, password }: Credentials) => {
  if (!email || !password) {
    throw new HttpError(400, 'Email y contraseña son requeridos', {
      ...(!email ? { email: 'Email requerido' } : {}),
      ...(!password ? { password: 'Contraseña requerida' } : {}),
    });
  }
  const user = await User.findOne({ email: (email as string).trim().toLowerCase() });
  const ok = user ? await bcrypt.compare(password as string, user.passwordHash) : false;
  if (!ok || !user) {
    throw new HttpError(401, 'Credenciales inválidas');
  }
  return user;
};

/**
 * Firma un JWT HS256 con el id y email del usuario y la expiración configurada.
 * Devuelve el token como string.
 */
export const issueToken = (user: Pick<IUser, '_id' | 'email'>): string =>
  jwt.sign({ sub: user._id.toString(), email: user.email }, env.jwtSecret, {
    algorithm: 'HS256', // firma explícita HS256 con secreto de .env
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  });

/**
 * Verifica firma y vigencia de un JWT; lanza error si es inválido o expiró.
 */
export const verifyToken = (token: string): JwtPayload | string =>
  jwt.verify(token, env.jwtSecret);

/**
 * Devuelve los campos públicos del usuario (sin contraseña).
 */
export const toPublic = (user: Pick<IUser, '_id' | 'name' | 'email'>) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
});
