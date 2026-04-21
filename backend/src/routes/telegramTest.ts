import fs from 'node:fs';
import { Router } from 'express';
import type multer from 'multer';
import { runTelegramMidtownAnalysis } from '../usecases/runTelegramMidtownAnalysis.js';

function parseSelectedCatalogIds(raw: unknown): string[] | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  } catch {
    return null;
  }
}

export function telegramTestRouter(upload: multer.Multer): Router {
  const router = Router();

  router.post('/midtown', upload.single('image'), async (req, res, next) => {
    if (!req.file) {
      res.status(400).json({ ok: false, error: 'Fotograf gerekli (image alani).' });
      return;
    }

    if (!req.file.mimetype.startsWith('image/')) {
      fs.rmSync(req.file.path, { force: true });
      res.status(400).json({ ok: false, error: 'Sadece gorsel dosyalar desteklenir.' });
      return;
    }

    try {
      const selectedCatalogIds = parseSelectedCatalogIds(req.body.catalogProductIds);
      const result = await runTelegramMidtownAnalysis(req.file.path, selectedCatalogIds);
      res.json(result);
    } catch (error) {
      next(error);
    } finally {
      fs.rmSync(req.file.path, { force: true });
    }
  });

  return router;
}
