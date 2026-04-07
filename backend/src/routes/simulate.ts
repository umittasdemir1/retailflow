import { Router } from 'express';
import { simulateTransfers } from '../usecases/simulateTransfers.js';

export const simulateRouter = Router();

simulateRouter.post('/', (_req, res, next) => {
  try {
    res.json({
      success: true,
      impact: simulateTransfers(),
    });
  } catch (error) {
    next(error);
  }
});
