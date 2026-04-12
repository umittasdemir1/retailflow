import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { appConfig } from './config.js';
import { analyzeRouter } from './routes/analyze.js';
import { dataRouter } from './routes/data.js';
import { exportRouter } from './routes/export.js';
import { healthRouter } from './routes/health.js';
import { productsRouter } from './routes/products.js';
import { simulateRouter } from './routes/simulate.js';
import { storesRouter } from './routes/stores.js';
import { strategiesRouter } from './routes/strategies.js';
import { uploadRouter } from './routes/upload.js';
import { visionRouter } from './routes/vision.js';
import { warmUpPythonVision } from './services/pythonVision.js';

const app = express();
const uploadDir = path.resolve(appConfig.uploadDir);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, uploadDir);
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname ?? '').toLowerCase();
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

app.use(cors({ origin: appConfig.corsOrigin === '*' ? true : appConfig.corsOrigin }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  req.setTimeout?.(120_000);
  res.setTimeout?.(120_000);
  next();
});

app.use('/api/health', healthRouter);
app.use('/api/products', productsRouter);
app.use('/api/stores', storesRouter);
app.use('/api/strategies', strategiesRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/export', exportRouter);
app.use('/api/simulate', simulateRouter);
app.use('/api/data', dataRouter);
app.use('/api/upload', uploadRouter(upload));
app.use('/api/vision', visionRouter(upload));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
  res.status(500).json({ ok: false, error: message });
});

app.listen(appConfig.port, () => {
  console.log(`RetailFlow API listening on :${appConfig.port}`);
  warmUpPythonVision();
});
