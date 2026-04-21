import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type multer from 'multer';
import { fileURLToPath } from 'node:url';
import type { StoreCalibration } from '@retailflow/shared';
import { calibrationStore } from '../store/calibrationStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveCalibrationDir(): string {
  for (let levels = 2; levels <= 5; levels++) {
    const parts: string[] = [__dirname];
    for (let i = 0; i < levels; i++) parts.push('..');
    parts.push('calibrations');
    const candidate = path.join(...parts);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(process.cwd(), 'calibrations');
}

const CALIBRATION_DIR = resolveCalibrationDir();

export function calibrationRouter(upload: multer.Multer): Router {
  const router = Router();

  // Tüm kalibrasyonları listele
  router.get('/', (_req, res) => {
    res.json(calibrationStore.getAll());
  });

  // Mağaza adına göre tekil kalibrasyon
  router.get('/store/:storeName', (req, res) => {
    const cal = calibrationStore.findByStore(req.params.storeName);
    if (!cal) { res.status(404).json({ ok: false, error: 'Kalibrasyon bulunamadı' }); return; }
    res.json(cal);
  });

  // Kalibrasyon oluştur / güncelle (fotoğraf + JSON)
  router.post('/', upload.single('image'), (req, res) => {
    const storeName   = (req.body.storeName as string | undefined)?.trim();
    const dataStr     = (req.body.data    as string | undefined)?.trim();

    if (!storeName) {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      res.status(400).json({ ok: false, error: 'storeName zorunludur' });
      return;
    }
    if (!dataStr) {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      res.status(400).json({ ok: false, error: 'data (JSON) zorunludur' });
      return;
    }

    let parsed: Partial<StoreCalibration>;
    try { parsed = JSON.parse(dataStr); }
    catch {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      res.status(400).json({ ok: false, error: 'data JSON parse edilemedi' });
      return;
    }

    // Mevcut kalibrasyonu bul ya da yeni ID üret
    const existing = calibrationStore.findByStore(storeName);
    const id       = existing?.id ?? randomUUID();

    // Referans fotoğrafı kaydet
    if (req.file) {
      const ext      = path.extname(req.file.originalname) || '.jpg';
      const imgName  = `${id}${ext}`;
      const destPath = path.join(CALIBRATION_DIR, imgName);
      fs.copyFileSync(req.file.path, destPath);
      fs.rmSync(req.file.path, { force: true });
    }

    const now = new Date().toISOString();
    const calibration: StoreCalibration = {
      id,
      storeName,
      imageWidth:  parsed.imageWidth  ?? 0,
      imageHeight: parsed.imageHeight ?? 0,
      roi:         parsed.roi         ?? null,
      slots:       parsed.slots       ?? [],
      dots:        parsed.dots        ?? [],
      createdAt:   existing?.createdAt ?? now,
      updatedAt:   now,
    };

    calibrationStore.upsert(calibration);
    console.log(`[CALIBRATION] Kaydedildi: ${storeName} — ${calibration.slots.length} slot, ${calibration.dots.length} dot`);
    res.status(201).json(calibration);
  });

  // Kalibrasyon sil
  router.delete('/:id', (req, res) => {
    const removed = calibrationStore.remove(req.params.id);
    if (!removed) { res.status(404).json({ ok: false, error: 'Kalibrasyon bulunamadı' }); return; }
    // Referans fotoğrafını da sil
    for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
      const p = path.join(CALIBRATION_DIR, `${req.params.id}${ext}`);
      if (fs.existsSync(p)) { fs.rmSync(p, { force: true }); break; }
    }
    res.json({ ok: true });
  });

  // Kalibrasyon referans fotoğrafı
  router.get('/:id/image', (req, res) => {
    for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
      const p = path.join(CALIBRATION_DIR, `${req.params.id}${ext}`);
      if (fs.existsSync(p)) { res.sendFile(p); return; }
    }
    res.status(404).json({ ok: false, error: 'Görsel bulunamadı' });
  });

  return router;
}
