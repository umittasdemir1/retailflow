import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import type multer from 'multer';
import { randomUUID } from 'node:crypto';
import { catalogStore } from '../store/catalogStore.js';
import {
  embedCatalogImages,
  getPythonVisionStatus,
  publicCatalogProduct,
  recognizeWithPython,
} from '../services/pythonVision.js';
import { sessionStore } from '../store/sessionStore.js';
import type { VisionRecognizeResponse, RecognizedProduct } from '@retailflow/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveCatalogDir(): string {
  for (let levels = 2; levels <= 5; levels++) {
    const parts: string[] = [__dirname];
    for (let i = 0; i < levels; i++) parts.push('..');
    parts.push('catalog');
    const candidate = path.join(...parts);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(process.cwd(), 'catalog');
}

const CATALOG_DIR = resolveCatalogDir();

export function visionRouter(upload: multer.Multer): Router {
  const router = Router();

  router.get('/status', async (_req, res) => {
    try {
      const response = await getPythonVisionStatus();
      res.json(response);
    } catch {
      res.json({
        ready: false,
        modelName: 'python-vision-unavailable',
        loadTimeMs: null,
      });
    }
  });

  router.get('/catalog', (_req, res) => {
    res.json(catalogStore.getAll().map(publicCatalogProduct));
  });

  router.post('/catalog', upload.array('images', 10), async (req, res, next) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ ok: false, error: 'En az bir referans görsel gerekli (images alanı)' });
      return;
    }

    const invalidFile = files.find((f) => !f.mimetype.startsWith('image/'));
    if (invalidFile) {
      files.forEach((f) => fs.rmSync(f.path, { force: true }));
      res.status(400).json({ ok: false, error: 'Sadece görsel dosyalar desteklenir' });
      return;
    }

    const productCode = (req.body.productCode as string | undefined)?.trim() ?? '';
    const productName = (req.body.productName as string | undefined)?.trim() ?? '';
    const color       = (req.body.color       as string | undefined)?.trim() ?? '';
    const description = (req.body.description as string | undefined)?.trim() ?? '';

    if (!productCode || !productName) {
      files.forEach((f) => fs.rmSync(f.path, { force: true }));
      res.status(400).json({ ok: false, error: 'productCode ve productName zorunludur' });
      return;
    }

    try {
      const id = randomUUID();

      // Görselleri catalog klasörüne taşı
      const imageNames: string[] = files.map((file, i) => {
        const ext      = path.extname(file.originalname) || '.jpg';
        const imgName  = `${id}-${i}${ext}`;
        fs.copyFileSync(file.path, path.join(CATALOG_DIR, imgName));
        fs.rmSync(file.path, { force: true });
        return imgName;
      });

      // Tüm referans görsellerden ortalama embedding al
      const imagePaths    = imageNames.map((n) => path.join(CATALOG_DIR, n));
      const featureVector = await embedCatalogImages(imagePaths);

      const product = { id, productCode, productName, color, description, imageNames, featureVector, addedAt: new Date().toISOString() };
      catalogStore.add(product);
      res.status(201).json(publicCatalogProduct(product));
    } catch (error) {
      files.forEach((f) => fs.rmSync(f.path, { force: true }));
      next(error);
    }
  });

  router.delete('/catalog/:id', (req, res) => {
    const product = catalogStore.findById(req.params.id);
    if (!product) {
      res.status(404).json({ ok: false, error: 'Ürün bulunamadı' });
      return;
    }
    product.imageNames.forEach((n) => fs.rmSync(path.join(CATALOG_DIR, n), { force: true }));
    catalogStore.remove(req.params.id);
    res.json({ ok: true });
  });

  // İlk görsel thumbnail olarak döner
  router.get('/catalog/:id/image', (req, res) => {
    const product = catalogStore.findById(req.params.id);
    if (!product) {
      res.status(404).json({ ok: false, error: 'Ürün bulunamadı' });
      return;
    }
    const imgPath = path.join(CATALOG_DIR, product.imageNames[0]);
    if (!fs.existsSync(imgPath)) {
      res.status(404).json({ ok: false, error: 'Görsel bulunamadı' });
      return;
    }
    res.sendFile(imgPath);
  });

  router.post('/recognize', upload.single('image'), async (req, res, next) => {
    if (!req.file) {
      res.status(400).json({ ok: false, error: 'Raf görseli gerekli (image alanı)' });
      return;
    }
    if (!req.file.mimetype.startsWith('image/')) {
      fs.rmSync(req.file.path, { force: true });
      res.status(400).json({ ok: false, error: 'Sadece görsel dosyalar desteklenir' });
      return;
    }
    if (catalogStore.count() === 0) {
      fs.rmSync(req.file.path, { force: true });
      res.status(400).json({ ok: false, error: 'Önce kataloga en az bir referans ürün ekleyin' });
      return;
    }

    try {
      const catalog = catalogStore.getAll();
      const pythonResult = await recognizeWithPython(req.file.path, catalog);

      // Python detection-centric → frontend product-centric dönüşümü
      const inventoryRecords = sessionStore.get().data ?? [];

      // Her katalog ürünü için tespitleri topla
      const productMap = new Map<string, RecognizedProduct>();
      for (const item of catalog) {
        const rows = inventoryRecords.filter(
          (r) =>
            r.productCode === item.productCode ||
            r.productName.toLowerCase().includes(item.productName.toLowerCase()),
        );
        const totalSales     = rows.reduce((a, r) => a + r.salesQty, 0);
        const totalInventory = rows.reduce((a, r) => a + r.inventory, 0);
        productMap.set(item.id, {
          catalogProductId: item.id,
          productCode:      item.productCode,
          productName:      item.productName,
          color:            item.color,
          description:      item.description,
          foundAt:          [],
          bestConfidence:   0,
          found:            false,
          totalSales:       rows.length > 0 ? totalSales     : null,
          totalInventory:   rows.length > 0 ? totalInventory : null,
          strPercent:       rows.length > 0 && (totalSales + totalInventory) > 0
            ? Math.round((totalSales / (totalSales + totalInventory)) * 100)
            : null,
          storeCount:       rows.length > 0
            ? new Set(rows.map((r) => r.warehouseName)).size
            : null,
        });
      }

      // Python tespitlerini ürün kartlarına ekle
      for (const det of pythonResult.detections) {
        const product = productMap.get(det.catalogProductId);
        if (!product) continue;
        product.foundAt.push({ boundingBox: det.boundingBox, confidence: det.confidence });
        if (det.confidence > product.bestConfidence) {
          product.bestConfidence = det.confidence;
          product.found = true;
        }
      }

      // foundAt listelerini güvene göre sırala
      for (const product of productMap.values()) {
        product.foundAt.sort((a, b) => b.confidence - a.confidence);
      }

      // Bulunanlar önce, bulunmayanlar sonra
      const recognizedProducts = [...productMap.values()].sort(
        (a, b) => Number(b.found) - Number(a.found) || b.bestConfidence - a.bestConfidence,
      );

      const response: VisionRecognizeResponse = {
        imageWidth:         pythonResult.imageWidth,
        imageHeight:        pythonResult.imageHeight,
        recognizedProducts,
        scannedRegions:     pythonResult.scannedRegions,
        processingTimeMs:   pythonResult.processingTimeMs,
        modelVersion:       pythonResult.modelVersion,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
