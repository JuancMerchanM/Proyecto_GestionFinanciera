import { env } from './config/env.mjs';
import { connectDb } from './config/db.mjs';
import { swaggerSpec } from './config/swagger.mjs';

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import expressLayouts from 'express-ejs-layouts';
import swaggerUi from 'swagger-ui-express';

import healthRouter from './routes/health.mjs';
import apiRouter from './routes/api/index.mjs';
import webRouter from './routes/web/index.mjs';
import { authenticate } from './middlewares/auth.mjs';
import { formatMoney } from './utils/money.mjs';
import { notFound, errorHandler } from './middlewares/error.mjs';

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

app.use((req, res, next) => {
  res.locals.year = new Date().getFullYear();
  res.locals.flash = { success: req.query.success ?? null, error: req.query.error ?? null };
  res.locals.currentHomeId = req.cookies?.currentHomeId ?? null;
  res.locals.formatMoney = formatMoney;
  next();
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: false }));
app.use(healthRouter);
app.use('/api', apiRouter);
app.use('/', webRouter);

app.use(notFound);
app.use(errorHandler);

// const start = async () => {
//   try {
//     await connectDb();
//     console.log('[db] conectada');
//   } catch (err) {
//     console.error('[db] error de conexión:', err.message);
//     process.exit(1);
//   }
//
//   app.listen(env.port, () => {
//     console.log(`[server] http://localhost:${env.port}`);
//     console.log(`[server] swagger  http://localhost:${env.port}/api-docs`);
//   });
// };
//
// if (process.env.NODE_ENV !== 'test') {
//   start();
// }
//

const start = async () => {
  try {
    await connectDb();
    console.log('[db] conectada');
  } catch (err) {
    console.error('[db] error de conexión:', err.message);
    process.exit(1);
  }
}
start();

export default app;
