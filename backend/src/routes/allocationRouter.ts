import { Router } from 'express';
import { allocationStore } from '../store/allocationStore.js';

export const allocationRouter = Router();

// ── Series ──────────────────────────────────────────────────────────────────

allocationRouter.get('/series', (_req, res) => {
  res.json({ ok: true, data: allocationStore.getAllSeries() });
});

allocationRouter.post('/series', (req, res) => {
  const { name, sizes } = req.body ?? {};
  if (!name || typeof name !== 'string' || !sizes || typeof sizes !== 'object') {
    res.status(400).json({ ok: false, error: 'name ve sizes gerekli' });
    return;
  }
  const item = allocationStore.addSeries({ name, sizes });
  res.status(201).json({ ok: true, data: item });
});

allocationRouter.put('/series/:id', (req, res) => {
  const updated = allocationStore.updateSeries(req.params.id, req.body ?? {});
  if (!updated) { res.status(404).json({ ok: false, error: 'Bulunamadı' }); return; }
  res.json({ ok: true, data: updated });
});

allocationRouter.delete('/series/:id', (req, res) => {
  const ok = allocationStore.deleteSeries(req.params.id);
  if (!ok) { res.status(404).json({ ok: false, error: 'Bulunamadı' }); return; }
  res.json({ ok: true });
});

// ── Assortment Rules ────────────────────────────────────────────────────────

allocationRouter.get('/assortment', (_req, res) => {
  res.json({ ok: true, data: allocationStore.getAllAssortmentRules() });
});

allocationRouter.post('/assortment', (req, res) => {
  const { type, targetName, seriesId } = req.body ?? {};
  if (!type || !targetName || !seriesId) {
    res.status(400).json({ ok: false, error: 'type, targetName, seriesId gerekli' });
    return;
  }
  if (type !== 'product' && type !== 'category') {
    res.status(400).json({ ok: false, error: 'type "product" veya "category" olmalı' });
    return;
  }
  if (!allocationStore.findSeriesById(seriesId)) {
    res.status(400).json({ ok: false, error: 'Geçersiz seriesId' });
    return;
  }
  const item = allocationStore.addAssortmentRule({ type, targetName, seriesId });
  res.status(201).json({ ok: true, data: item });
});

allocationRouter.put('/assortment/:id', (req, res) => {
  const updated = allocationStore.updateAssortmentRule(req.params.id, req.body ?? {});
  if (!updated) { res.status(404).json({ ok: false, error: 'Bulunamadı' }); return; }
  res.json({ ok: true, data: updated });
});

allocationRouter.delete('/assortment/:id', (req, res) => {
  const ok = allocationStore.deleteAssortmentRule(req.params.id);
  if (!ok) { res.status(404).json({ ok: false, error: 'Bulunamadı' }); return; }
  res.json({ ok: true });
});

// ── Store Allocations ───────────────────────────────────────────────────────

allocationRouter.get('/allocations', (_req, res) => {
  res.json({ ok: true, data: allocationStore.getAllAllocations() });
});

allocationRouter.get('/allocations/store/:storeName', (req, res) => {
  res.json({ ok: true, data: allocationStore.getAllocationsForStore(req.params.storeName) });
});

allocationRouter.post('/allocations', (req, res) => {
  const { storeName, productName, color, seriesId, seriesCount, enabled } = req.body ?? {};
  if (!storeName || !productName || !color || !seriesId || seriesCount == null) {
    res.status(400).json({ ok: false, error: 'storeName, productName, color, seriesId, seriesCount gerekli' });
    return;
  }
  if (!allocationStore.findSeriesById(seriesId)) {
    res.status(400).json({ ok: false, error: 'Geçersiz seriesId' });
    return;
  }
  const item = allocationStore.addAllocation({
    storeName,
    productName,
    color,
    seriesId,
    seriesCount: Number(seriesCount),
    enabled: enabled !== false,
  });
  res.status(201).json({ ok: true, data: item });
});

allocationRouter.post('/allocations/bulk', (req, res) => {
  const { items } = req.body ?? {};
  if (!Array.isArray(items)) {
    res.status(400).json({ ok: false, error: 'items dizisi gerekli' });
    return;
  }
  const result = allocationStore.bulkUpsertAllocations(items);
  res.json({ ok: true, data: result });
});

allocationRouter.put('/allocations/:id', (req, res) => {
  const updated = allocationStore.updateAllocation(req.params.id, req.body ?? {});
  if (!updated) { res.status(404).json({ ok: false, error: 'Bulunamadı' }); return; }
  res.json({ ok: true, data: updated });
});

allocationRouter.delete('/allocations/:id', (req, res) => {
  const ok = allocationStore.deleteAllocation(req.params.id);
  if (!ok) { res.status(404).json({ ok: false, error: 'Bulunamadı' }); return; }
  res.json({ ok: true });
});
