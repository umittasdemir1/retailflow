import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { appConfig } from './config';
import { analyzeRouter } from './routes/analyze';
import { dataRouter } from './routes/data';
import { exportRouter } from './routes/export';
import { healthRouter } from './routes/health';
import { simulateRouter } from './routes/simulate';
import { storesRouter } from './routes/stores';
import { strategiesRouter } from './routes/strategies';
import { uploadRouter } from './routes/upload';

const app = express();
const upload = multer({
  dest: appConfig.uploadDir,
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
app.use('/api/stores', storesRouter);
app.use('/api/strategies', strategiesRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/export', exportRouter);
app.use('/api/simulate', simulateRouter);
app.use('/api/data', dataRouter);
app.use('/api/upload', uploadRouter(upload));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({ ok: false, error: message });
});

app.listen(appConfig.port, () => {
  console.log(`RetailFlow API listening on :${appConfig.port}`);
});
