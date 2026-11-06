import type { RequestHandler } from 'express';
export const landing: RequestHandler = (req, res) => {
  res.render('home', {});
};
