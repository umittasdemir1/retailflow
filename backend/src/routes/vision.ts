import path from 'node:path';
import fs from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import type multer from 'multer';
import { randomUUID } from 'node:crypto';
import { appConfig } from '../config.js';
import { catalogStore } from '../store/catalogStore.js';
import {
  embedCatalogImages,
  getPythonVisionStatus,
  publicCatalogProduct,
  recognizeWithPython,
  recognizeWithCalibration,
} from '../services/pythonVision.js';
import { recognizeWithOpenAI, recognizeWithOpenAICalibrated, embedCatalogImagesWithOpenAI, generateVisualDescription } from '../services/openaiVision.js';
import { sessionStore } from '../store/sessionStore.js';
import { calibrationStore } from '../store/calibrationStore.js';
import { findSwimwearSales } from '../services/swimwearSales.js';
import type { VisionRecognizeResponse, RecognizedProduct } from '@retailflow/shared';

const CDN_BASE = 'https://www.bluemint.com/cdn/shop/files';
const CDN_MAX_IMAGES = 5;

// Ürün lookup tablosu — Excel'den üretilmiş JSON
interface LookupEntry { productCode: string; productName: string; colorCode: string; color: string; }
let _lookupTable: LookupEntry[] = [];
function getLookupTable(): LookupEntry[] {
  if (_lookupTable.length > 0) return _lookupTable;
  const p = path.join(process.cwd(), 'catalog', 'product-lookup.json');
  if (!fs.existsSync(p)) return [];
  try { _lookupTable = JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { /* ignore */ }
  return _lookupTable;
}

function searchProducts(query: string): LookupEntry[] {
  const parts = query.trim().toUpperCase().split(/\s+/);
  return getLookupTable().filter((row) => {
    const haystack = `${row.productCode} ${row.productName} ${row.color}`.toUpperCase();
    return parts.every((p) => haystack.includes(p));
  }).slice(0, 20);
}

async function fetchCdnImages(
  productCode: string,
  colorCode: string,
  destDir: string,
  id: string,
): Promise<string[]> {
  const saved: string[] = [];
  for (let i = 1; i <= CDN_MAX_IMAGES; i++) {
    const url = `${CDN_BASE}/${productCode}-${colorCode}-${i}.jpg`;
    const res = await fetch(url);
    if (!res.ok) break;
    const buf = Buffer.from(await res.arrayBuffer());
    const name = `${id}-${i - 1}.jpg`;
    await writeFile(path.join(destDir, name), buf);
    saved.push(name);
  }
  return saved;
}

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

type VisionProvider = 'python' | 'openai';

function resolveVisionProvider(rawValue: unknown): VisionProvider {
  if (typeof rawValue === 'string' && rawValue.trim().toLowerCase() === 'openai') {
    return 'openai';
  }
  return appConfig.visionProvider;
}

export function visionRouter(upload: multer.Multer): Router {
  const router = Router();

  // Ürün arama — "BM26 BLUE DIVE" gibi sorguyla Excel tablosunda arama
  router.get('/product-search', (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (!q) { res.json([]); return; }
    res.json(searchProducts(q));
  });

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
    const provider    = resolveVisionProvider(req.body.provider);

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

      // Tüm referans görsellerden embedding al (hem ortalama hem tekil)
      const imagePaths = imageNames.map((n) => path.join(CATALOG_DIR, n));

      // Referans görsellerden otomatik görsel açıklama üret
      const aiDescription = await generateVisualDescription(imagePaths);

      // Katalog embedding her zaman CLIP (768-dim) — provider sadece TANIMA aşamasını etkiler.
      // Bu sayede OpenAI ile eklenen ürünler yerel AI ile de, OpenAI ile de tanınabilir.
      const { featureVector, featureVectors } = await embedCatalogImages(imagePaths, aiDescription);


      const product = { id, productCode, productName, color, description: aiDescription, imageNames, featureVector, featureVectors, embeddingProvider: 'python' as const, addedAt: new Date().toISOString() };
      catalogStore.add(product);
      res.status(201).json(publicCatalogProduct(product));
    } catch (error) {
      files.forEach((f) => fs.rmSync(f.path, { force: true }));
      next(error);
    }
  });

  // CDN'den otomatik görsel çekip kataloga ekle
  router.post('/catalog/cdn', async (req, res, next) => {
    const { productCode, colorCode, productName, color, provider: rawProvider } = req.body as Record<string, string>;
    if (!productCode?.trim() || !colorCode?.trim() || !productName?.trim()) {
      res.status(400).json({ ok: false, error: 'productCode, colorCode ve productName zorunludur' });
      return;
    }
    const provider = resolveVisionProvider(rawProvider);

    try {
      const id = randomUUID();
      const imageNames = await fetchCdnImages(productCode.trim(), colorCode.trim(), CATALOG_DIR, id);
      if (imageNames.length === 0) {
        res.status(404).json({ ok: false, error: `CDN'de görsel bulunamadı: ${productCode}-${colorCode}-1.jpg` });
        return;
      }
      const imagePaths = imageNames.map((n) => path.join(CATALOG_DIR, n));

      // Referans görsellerden otomatik görsel açıklama üret
      const aiDescription = await generateVisualDescription(imagePaths);

      // Katalog embedding her zaman CLIP (768-dim) — provider sadece TANIMA aşamasını etkiler.
      // Bu sayede OpenAI ile eklenen ürünler yerel AI ile de, OpenAI ile de tanınabilir.
      const { featureVector, featureVectors } = await embedCatalogImages(imagePaths, aiDescription);

      const product = {
        id, productCode: productCode.trim(), productName: productName.trim(),
        color: color?.trim() ?? '', description: aiDescription,
        imageNames, featureVector, featureVectors, embeddingProvider: 'python' as const, addedAt: new Date().toISOString(),
      };
      catalogStore.add(product);
      console.log(`[CATALOG] CDN'den eklendi: ${productCode} ${color} (${imageNames.length} görsel, provider=${provider})`);
      res.status(201).json(publicCatalogProduct(product));
    } catch (error) {
      next(error);
    }
  });

  // Ürün metadata güncelle (görsel değişmez, açıklama değişirse embedding yeniden hesaplanır)
  router.patch('/catalog/:id', async (req, res) => {
    const product = catalogStore.findById(req.params.id);
    if (!product) {
      res.status(404).json({ ok: false, error: 'Ürün bulunamadı' });
      return;
    }
    const newCode        = (req.body.productCode as string | undefined)?.trim();
    const newName        = (req.body.productName as string | undefined)?.trim();
    const newColor       = (req.body.color       as string | undefined)?.trim() ?? product.color;
    const newDescription = (req.body.description as string | undefined)?.trim() ?? product.description;
    const descChanged    = newDescription !== product.description;

    if (newCode) product.productCode = newCode;
    if (newName) product.productName = newName;
    product.color       = newColor;
    product.description = newDescription;

    // Açıklama değiştiyse yerel AI embedding'ini güncelle (metin blend yeniden hesaplanır)
    if (descChanged && (!product.embeddingProvider || product.embeddingProvider === 'python')) {
      try {
        const imagePaths = product.imageNames.map((n) => path.join(CATALOG_DIR, n));
        const { featureVector, featureVectors } = await embedCatalogImages(imagePaths, newDescription);
        catalogStore.updateEmbeddings(product.id, featureVector, featureVectors);
      } catch {
        catalogStore.save();
      }
    } else {
      catalogStore.save();
    }

    res.json(publicCatalogProduct(product));
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
      const fullCatalog = catalogStore.getAll();
      const selectedCatalogIds = (() => {
        const raw = req.body.catalogProductIds as string | undefined;
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (!Array.isArray(parsed)) return null;
          return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
        } catch {
          return null;
        }
      })();
      const catalog = selectedCatalogIds && selectedCatalogIds.length > 0
        ? fullCatalog.filter((item) => selectedCatalogIds.includes(item.id))
        : fullCatalog;
      if (catalog.length === 0) {
        fs.rmSync(req.file.path, { force: true });
        res.status(400).json({ ok: false, error: 'Analiz için en az bir referans ürün seçin' });
        return;
      }
      const provider    = resolveVisionProvider(req.body.provider);
      const calibrationId = (req.body.calibrationId as string | undefined)?.trim();
      const calibration = calibrationId ? calibrationStore.findById(calibrationId) : undefined;

      let recognitionResult;
      if (calibration && calibration.slots.length > 0) {
        console.log(`[VISION] Kalibrasyonlu tanıma: ${calibration.storeName} — ${calibration.slots.length} slot, provider=${provider}`);
        if (provider === 'openai') {
          // OpenAI + Kalibrasyon: slot dikdörtgenleri görsele çizilir, tek sorguda tanıma yapılır
          recognitionResult = await recognizeWithOpenAICalibrated(
            req.file.path,
            calibration.slots,
            calibration.dots,
            catalog,
          );
        } else {
          // Yerel AI + Kalibrasyon: YOLO atla, CLIP ile her slotu eşleştir
          recognitionResult = await recognizeWithCalibration(
            req.file.path,
            calibration.slots,
            calibration.dots,
            catalog,
          );
        }
      } else if (provider === 'openai') {
        recognitionResult = await recognizeWithOpenAI(req.file.path, catalog);
      } else {
        recognitionResult = await recognizeWithPython(req.file.path, catalog);
      }

      // detection-centric → frontend product-centric dönüşümü
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
        const swimwearSales = findSwimwearSales(item.productCode, item.color);
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
          swimwearSalesQty: swimwearSales?.salesQty ?? null,
        });
      }

      // Python tespitlerini ürün kartlarına ekle
      for (const det of recognitionResult.detections) {
        const product = productMap.get(det.catalogProductId);
        if (!product) continue;
        const location: import('@retailflow/shared').FoundLocation = {
          boundingBox: det.boundingBox,
          confidence:  det.confidence,
        };
        if ('dotPosition' in det && det.dotPosition) {
          location.dotPosition = det.dotPosition as { x: number; y: number };
        }
        product.foundAt.push(location);
        if (det.confidence > product.bestConfidence) {
          product.bestConfidence = det.confidence;
          product.found = true;
        }
      }

      for (const product of productMap.values()) {
        product.foundAt.sort((a, b) => b.confidence - a.confidence);
      }

      const recognizedProducts = [...productMap.values()].sort(
        (a, b) => Number(b.found) - Number(a.found) || b.bestConfidence - a.bestConfidence,
      );

      res.json({
        imageWidth:       recognitionResult.imageWidth,
        imageHeight:      recognitionResult.imageHeight,
        recognizedProducts,
        scannedRegions:   recognitionResult.scannedRegions,
        processingTimeMs: recognitionResult.processingTimeMs,
        modelVersion:     recognitionResult.modelVersion,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}