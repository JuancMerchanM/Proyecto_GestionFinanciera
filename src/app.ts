import { env } from './config/env.ts';
import { connectDb } from './config/db.ts';
import { swaggerHtml } from './config/swagger.ts';

import express from 'express';
import type { RequestHandler } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import expressLayouts from 'express-ejs-layouts';
import swaggerUi from 'swagger-ui-express';

import healthRouter from './routes/health.ts';
import apiRouter from './routes/api/index.ts';
import webRouter from './routes/web/index.ts';
import { authenticate } from './middlewares/auth.ts';
import { formatMoney } from './utils/money.ts';
import * as homeService from './services/homeService.ts';
import * as notificationService from './services/notificationService.ts';
import { notFound, errorHandler } from './middlewares/error.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/base');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(authenticate);

// Locales de la vista: datos globales del nav (solo requests web con sesión).
app.use((req, res, next) => {
  res.locals.year = new Date().getFullYear();
  res.locals.flash = {
    success: req.query.success ?? null,
    error: req.query.error ?? null,
    warning: req.query.warning ?? null,
  };
  res.locals.currentHomeId = req.cookies?.currentHomeId ?? null;
  res.locals.formatMoney = formatMoney;
  res.locals.homes = [];
  res.locals.currentHome = null;
  res.locals.unreadCount = 0;

  const isServerRoute = req.path.startsWith('/api') || req.path.startsWith('/health');
  if (!req.user || isServerRoute) return next();

  Promise.all([homeService.listHomesForUser(req.user), notificationService.countUnread(req.user._id)])
    .then(([homes, unread]) => {
      res.locals.homes = homes;
      res.locals.currentHome = homes.find((h) => h.id === res.locals.currentHomeId) ?? null;
      res.locals.unreadCount = unread;
      next();
    })
    .catch(next);
});

const swaggerHandler: RequestHandler = (_req, res) => res.send(swaggerHtml);
app.use('/api-docs', swaggerUi.serve, swaggerHandler);
app.use(healthRouter);
app.use('/api', apiRouter);
app.use('/', webRouter);

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  try {
    await connectDb();
    console.log('[db] conectada');
  } catch (err) {
    console.error('[db] error de conexión:', (err as Error).message);
    process.exit(1);
  }

  app.listen(env.port, () => {
    console.log(`[server] http://localhost:${env.port}`);
    console.log(`[server] swagger  http://localhost:${env.port}/api-docs`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  start();
}

export default app;
