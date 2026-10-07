import * as authService from '../../services/authService.mjs';
import { COOKIE_NAME } from '../../middlewares/auth.mjs';
import { env } from '../../config/env.mjs';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProd,
  maxAge: 8 * 60 * 60 * 1000, // 8h (misma vigencia que JWT_EXPIRES_IN)
});

const setTokenCookie = (res, token) => res.cookie(COOKIE_NAME, token, cookieOptions());

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Autenticación]
 *     summary: Registro de usuario (email y contraseña con bcrypt)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 80, example: Ana Pérez }
 *               email: { type: string, format: email, example: ana@ejemplo.com }
 *               password: { type: string, minLength: 8, maxLength: 72, example: clave12345 }
 *           example: { name: 'Ana Pérez', email: 'ana@ejemplo.com', password: 'clave12345' }
 *     responses:
 *       '201':
 *         description: Usuario creado; devuelve token JWT y setea cookie httpOnly
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *                 token: { type: string }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '409': { description: Email ya registrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
export const register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body ?? {});
    const token = authService.issueToken(user);
    setTokenCookie(res, token);
    res.status(201).json({ user: authService.toPublic(user), token });
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Autenticación]
 *     summary: Login que devuelve JWT (access token)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: ana@ejemplo.com }
 *               password: { type: string, example: clave12345 }
 *           example: { email: 'ana@ejemplo.com', password: 'clave12345' }
 *     responses:
 *       '200':
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *                 token: { type: string }
 *       '400': { $ref: '#/components/responses/Validation' }
 *       '401': { description: Credenciales inválidas }
 */
export const login = async (req, res, next) => {
  try {
    const user = await authService.login(req.body ?? {});
    const token = authService.issueToken(user);
    setTokenCookie(res, token);
    res.json({ user: authService.toPublic(user), token });
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Autenticación]
 *     summary: Logout (elimina la cookie httpOnly en el cliente)
 *     responses:
 *       '200':
 *         description: Sesión cerrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Sesión cerrada }
 */
export const logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: env.isProd });
  res.json({ message: 'Sesión cerrada' });
};

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Autenticación]
 *     summary: Usuario autenticado a partir del JWT
 *     responses:
 *       '200':
 *         description: Usuario actual
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       '401': { description: No autenticado }
 */
export const me = (req, res) => {
  res.json({ user: authService.toPublic(req.user) });
};
