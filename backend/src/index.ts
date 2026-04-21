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
import { calibrationRouter } from './routes/calibration.js';
import { telegramTestRouter } from './routes/telegramTest.js';
import { warmUpPythonVision, embedCatalogImages } from './services/pythonVision.js';
import { startTelegramBot } from './services/telegramBot.js';
import { catalogStore } from './store/catalogStore.js';

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
app.use('/api/calibration', calibrationRouter(upload));
app.use('/api/telegram-test', telegramTestRouter(upload));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
  res.status(500).json({ ok: false, error: message });
});

app.listen(appConfig.port, () => {
  console.log(`RetailFlow API listening on :${appConfig.port}`);
  warmUpPythonVision();
  reEmbedCatalogIfNeeded();
  void startTelegramBot();
});

const CLIP_DIM = 768;

async function reEmbedCatalogIfNeeded(): Promise<void> {
  const products = catalogStore.getAll().filter((product) => {
    if (product.featureVector.length === 0) return true;
    // Boyut yanlışsa (eski DINOv2=808, OpenAI=1536 vb.) → CLIP ile yeniden embed et
    if (product.featureVector.length !== CLIP_DIM) return true;
    if (!product.featureVectors || product.featureVectors.length === 0) return true;
    return product.featureVectors.some((v) => v.length !== CLIP_DIM);
  });
  if (products.length === 0) return;
  console.log(`[CATALOG] ${products.length} ürün CLIP ile yeniden embed ediliyor...`);
  const nodePath = await import('node:path');
  const catalogDir = nodePath.default.join(process.cwd(), 'catalog');
  for (const product of products) {
    try {
      const imagePaths = product.imageNames.map((name) => nodePath.default.join(catalogDir, name));
      const { featureVector, featureVectors } = await embedCatalogImages(imagePaths, product.description);
      catalogStore.updateEmbeddings(product.id, featureVector, featureVectors);
      console.log(`[CATALOG] Re-embed OK: ${product.productCode} ${product.color}`);
    } catch (err) {
      console.error(`[CATALOG] Re-embed HATA: ${product.productCode}`, err);
    }
  }
  console.log(`[CATALOG] Yeniden embed tamamlandı.`);
}
