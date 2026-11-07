import type { RequestHandler } from 'express';
import { isHttpError } from '../../middlewares/error.ts';
import * as reportService from '../../services/reportService.ts';
import * as homeService from '../../services/homeService.ts';

// vista del dashboard con tarjetas, donut + serie temporal + por persona
// (Chart.js local) y filtros from/to (y persona, solo para admin).
export const index: RequestHandler = async (req, res, next) => {
  try {
    const isAdmin = req.homeRole === 'admin';
    const [summary, timeline, members] = await Promise.all([
      reportService.summary(req.home!, req.query),
      reportService.timeline(req.home!, req.query, { userId: req.user!._id, isAdmin }),
      isAdmin ? homeService.listMembers(req.home!) : Promise.resolve([]),
    ]);
    res.render('dashboard/index', {
      title: 'Dashboard',
      home: { id: req.params.homeId as string, name: req.home!.name, currency: req.home!.currency },
      role: req.homeRole,
      summary,
      timeline,
      members,
      scripts: ['/js/vendor/chart.umd.js', '/js/dashboard.js'],
    });
  } catch (err) {
    if (isHttpError(err) && (err.status === 400 || err.status === 403)) {
      return res.status(err.status).render('error', {
        title: err.status === 403 ? 'Sin permiso' : 'Rango de fechas inválido',
        status: err.status,
        message: Object.values(err.details ?? {}).join('. ') || err.message,
      });
    }
    next(err);
  }
};
