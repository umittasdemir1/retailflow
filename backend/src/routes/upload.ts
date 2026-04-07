import { Router } from 'express';
import type multer from 'multer';
import { processUpload } from '../usecases/processUpload.js';

export function uploadRouter(upload: multer.Multer): Router {
  const router = Router();

  router.post('/', upload.single('file'), (req, res) => {
    if (req.file === undefined) {
      res.status(400).json({ ok: false, error: 'Dosya gerekli' });
      return;
    }

    const result = processUpload(req.file.path, req.file.originalname);
    res.json(result);
  });

  return router;
}
