import { Router } from 'express';
import { sessionStore } from '../store/sessionStore';

export const storesRouter = Router();

storesRouter.get('/', (_req, res) => {
  res.json(sessionStore.get().storeMetrics);
});
