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
}

export interface AppLocals {
  year: number;
  flash: FlashLocals;
  currentHomeId: string | null;
  formatMoney: (amountMinor: number, currency: string) => string;
  currentUser: { id: string; name: string; email: string } | null;
}

export type AuthedRequest = Request & { user: IUser };
