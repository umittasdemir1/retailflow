import { Router } from 'express';
import { sessionStore } from '../store/sessionStore.js';

export const storesRouter = Router();

storesRouter.get('/', (_req, res) => {
  res.json(sessionStore.get().storeMetrics);
});
