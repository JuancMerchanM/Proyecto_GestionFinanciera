export class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (req, res, next) => {
  const error = new HttpError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  next(error);
};

export const errorHandler = (err, req, res, _next) => {
  const status = Number.isInteger(err?.status) ? err.status : 500;
  const message =
    status >= 500 && envIsProd() ? 'Error interno del servidor' : err?.message ?? 'Error inesperado';

  if (status >= 500) {
    console.error(err);
  }

  if (req.path.startsWith('/api') || req.accepts(['json', 'html']) === 'json') {
    return res.status(status).json({ error: message, details: err?.details ?? null });
  }

  return res.status(status).render('error', {
    title: `Error ${status}`,
    status,
    message,
  });
};

function envIsProd() {
  return process.env.NODE_ENV === 'production';
}
