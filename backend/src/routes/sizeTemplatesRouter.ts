import { Router } from 'express';
import { sessionStore } from '../store/sessionStore.js';

export const sizeTemplatesRouter = Router();

export interface SizeTemplate {
  year: number | null;
  productName: string;
  color: string;
  sizes: string[];
}

sizeTemplatesRouter.get('/', (_req, res) => {
  const { data } = sessionStore.get();

  if (!data || data.length === 0) {
    res.json({ ok: true, data: [], uploaded: false });
    return;
  }

  // Build unique (productName, color, year, sizeRange) from records that have sizeRange
  const map = new Map<string, SizeTemplate>();

  for (const r of data) {
    if (!r.sizeRange) continue;

    const key = `${r.productName}|||${r.color}|||${r.productionYear ?? ''}`;
    if (map.has(key)) continue;

    const sizes = r.sizeRange
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!sizes.length) continue;

    map.set(key, {
      year:        r.productionYear ?? null,
      productName: r.productName,
      color:       r.color,
      sizes,
    });
  }

  const templates = [...map.values()].sort((a, b) =>
    a.productName.localeCompare(b.productName, 'tr') ||
    (a.year ?? 0) - (b.year ?? 0)
  );

  res.json({ ok: true, data: templates, uploaded: true });
});
