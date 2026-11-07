import type { Request } from 'express';
import type { IHome, Role } from '../models/home.ts';
import type { IUser } from '../models/user.ts';

declare global {
  namespace Express {
    interface Request {
      /** Usuario autenticado (documento lean) — lo adjuntan los middlewares de auth. */
      user?: IUser;
      /** Hogar actual (documento lean) — lo adjunta requireHomeMember. */
      home?: IHome;
      homeId?: string;
      homeRole?: Role;
      /** Copia previa del formulario para repintar cuentas/categorías en errores POST. */
      accountView?: { id: string } & Record<string, unknown> | null;
      categoryView?: { id: string } & Record<string, unknown> | null;
    }
  }
}

export interface FlashLocals {
  success: string | null;
  error: string | null;
  /** Aviso (ámbar) aditivo: presupuesto excedido, etc. */
  warning: string | null;
}

/** Forma pública mínima de un hogar para el selector del nav. */
export interface HomeNavOption {
  id: string;
  name: string;
  currency: string;
  role: Role | null;
}

export interface AppLocals {
  year: number;
  flash: FlashLocals;
  currentHomeId: string | null;
  /** Hogares del usuario autenticado (selector del nav); vacío sin sesión o en API. */
  homes: HomeNavOption[];
  /** Hogar al que apunta la cookie actual, si sigue perteneciendo al usuario. */
  currentHome: HomeNavOption | null;
  formatMoney: (amountMinor: number, currency: string) => string;
  currentUser: { id: string; name: string; email: string } | null;
  /** Notificaciones no leídas del usuario (campana del nav); 0 sin sesión o en API. */
  unreadCount: number;
}

export type AuthedRequest = Request & { user: IUser };
