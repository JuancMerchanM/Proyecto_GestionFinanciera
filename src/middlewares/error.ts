import type { ErrorRequestHandler, RequestHandler } from 'express';

export class HttpError extends Error {
  status: number;
  details: Record<string, string> | null;

  constructor(status: number, message: string, details: Record<string, string> | null = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

/** Type guard para usar en catch: `if (isHttpError(err) && err.status === 404)`. */
export const isHttpError = (err: unknown): err is HttpError => err instanceof HttpError;

export const notFound: RequestHandler = (req, _res, next) => {
  const error = new HttpError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  next(error);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const maybe = err as Partial<HttpError> | undefined;
  const status = Number.isInteger(maybe?.status) ? (maybe!.status as number) : 500;
  const message =
    status >= 500 && envIsProd()
      ? 'Error interno del servidor'
      : maybe?.message ?? 'Error inesperado';

  if (status >= 500) {
    console.error(err);
  }

  if (req.path.startsWith('/api') || req.accepts(['json', 'html']) === 'json') {
    res.status(status).json({ error: message, details: maybe?.details ?? null });
    return;
  }

  res.status(status).render('error', {
    title: `Error ${status}`,
    status,
    message,
  });
};

function envIsProd(): boolean {
  return process.env.NODE_ENV === 'production';
}
