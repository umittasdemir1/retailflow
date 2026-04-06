import { Router } from 'express';
import { STRATEGY_CONFIGS } from '@retailflow/shared';

export const strategiesRouter = Router();

strategiesRouter.get('/', (_req, res) => {
  res.json(Object.values(STRATEGY_CONFIGS));
});
