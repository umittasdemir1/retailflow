import { Router } from 'express';
import { allocationStore } from '../store/allocationStore.js';
import { sessionStore } from '../store/sessionStore.js';

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
  const { storeName, productName, seriesId, seriesCount, enabled } = req.body ?? {};
  if (!storeName || !productName || !seriesId || seriesCount == null) {
    res.status(400).json({ ok: false, error: 'storeName, productName, seriesId, seriesCount gerekli' });
    return;
  }
  if (!allocationStore.findSeriesById(seriesId)) {
    res.status(400).json({ ok: false, error: 'Geçersiz seriesId' });
    return;
  }
  const item = allocationStore.addAllocation({
    storeName,
    productName,
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

// ── Apply assortment rules → auto-fill allocations ──────────────────────────

allocationRouter.post('/apply-rules', (_req, res) => {
  const state = sessionStore.get();
  if (!state.data) {
    res.status(400).json({ ok: false, error: 'Önce veri yükle' });
    return;
  }

  // Build unique store × product set from inventory
  const combos = new Map<string, { storeName: string; productName: string; category: string | null }>();
  for (const r of state.data) {
    const key = `${r.warehouseName}|||${r.productName}`;
    if (!combos.has(key)) {
      combos.set(key, { storeName: r.warehouseName, productName: r.productName, category: r.category ?? null });
    }
  }

  // Existing allocations lookup (skip ones that already have a series set)
  const existingMap = new Map<string, import('@retailflow/shared').StoreAllocation>();
  for (const a of allocationStore.getAllAllocations()) {
    existingMap.set(`${a.storeName}|||${a.productName}`, a);
  }

  const toUpsert: import('@retailflow/shared').StoreAllocation[] = [];
  let applied = 0;
  let skipped = 0;

  for (const combo of combos.values()) {
    const existing = existingMap.get(`${combo.storeName}|||${combo.productName}`);

    // Already has a series manually set → skip
    if (existing?.seriesId) { skipped++; continue; }

    const resolved = allocationStore.resolveSeriesForProduct(combo.productName, combo.category);
    if (!resolved) { skipped++; continue; }

    toUpsert.push({
      id:          existing?.id ?? '',
      storeName:   combo.storeName,
      productName: combo.productName,
      seriesId:    resolved.id,
      seriesCount: existing?.seriesCount ?? 1,
      enabled:     existing?.enabled     ?? true,
      createdAt:   existing?.createdAt   ?? new Date().toISOString(),
    });
    applied++;
  }

  if (toUpsert.length > 0) {
    allocationStore.bulkUpsertAllocations(
      toUpsert.map(({ id: _id, createdAt: _c, ...rest }) => rest),
    );
  }

  res.json({ ok: true, applied, skipped });
});
