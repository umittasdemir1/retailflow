import { Router } from 'express';
import { sessionStore } from '../store/sessionStore.js';

export const dataRouter = Router();

dataRouter.delete('/', (_req, res) => {
  sessionStore.clear();
  res.json({ success: true });
});
