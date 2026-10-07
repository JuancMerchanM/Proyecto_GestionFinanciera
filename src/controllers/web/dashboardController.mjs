import * as reportService from '../../services/reportService.mjs';

// vista del dashboard con tarjetas, donut (Chart.js local) y filtro from/to.
export const index = async (req, res, next) => {
  try {
    const summary = await reportService.summary(req.home, req.query);
    res.render('dashboard/index', {
      title: 'Dashboard',
      home: { id: req.params.homeId, name: req.home.name, currency: req.home.currency },
      role: req.homeRole,
      summary,
      scripts: ['/js/vendor/chart.umd.js', '/js/dashboard.js'],
    });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).render('error', {
        title: 'Rango de fechas inválido',
        status: 400,
        message: Object.values(err.details ?? {}).join('. ') || err.message,
      });
    }
    next(err);
  }
};
