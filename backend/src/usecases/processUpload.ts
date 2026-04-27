import fs from 'node:fs';
import type { UploadResult } from '@retailflow/shared';
import { parseExcelFile } from '../services/excelParser.js';
import { computeStoreMetrics } from '../services/storeMetrics.js';
import { normalizeUploadedFileName } from '../utils/filename.js';
import { sessionStore } from '../store/sessionStore.js';
import { allocationStore } from '../store/allocationStore.js';

export function processUpload(filePath: string, originalName: string): UploadResult {
  try {
    const parsed = parseExcelFile(filePath);
    const metrics = computeStoreMetrics(parsed.records);
    const uniqueProductCount = new Set(parsed.records.map((r) => r.productCode || r.productName)).size;
    const uniqueColorCount = new Set(parsed.records.map((r) => r.color)).size;

    const result: UploadResult = {
      success: true,
      fileName: normalizeUploadedFileName(originalName),
      rowCount: parsed.records.length,
      storeCount: parsed.stores.length,
      uniqueProductCount,
      uniqueColorCount,
      stores: parsed.stores,
      columns: parsed.columns,
    };

    sessionStore.setUpload(parsed.records, parsed.stores, metrics, result);
    autoCreateSeriesFromRecords(parsed.records);
    return result;
  } finally {
    fs.rmSync(filePath, { force: true });
  }
}

function autoCreateSeriesFromRecords(records: import('@retailflow/shared').InventoryRecord[]): void {
  // Collect unique (productName, productionYear, sizeRange) — prefer latest year per product
  const productMap = new Map<string, { year: number | null; sizeRange: string; category: string | null }>();
  for (const r of records) {
    if (!r.sizeRange) continue;
    const existing = productMap.get(r.productName);
    const year = r.productionYear ?? null;
    if (!existing || (year !== null && (existing.year === null || year > existing.year))) {
      productMap.set(r.productName, { year, sizeRange: r.sizeRange, category: r.category ?? null });
    }
  }

  for (const [productName, { year, sizeRange, category }] of productMap) {
    const sizes = sizeRange.split(',').map((s) => s.trim()).filter(Boolean);
    if (!sizes.length) continue;

    const seriesName = year ? `${productName} ${year}` : productName;

    // Skip if a series for this product already exists (don't overwrite manual edits)
    const existingSeries = allocationStore.getAllSeries().find((s) => s.name === seriesName);
    let seriesId: string;

    if (existingSeries) {
      seriesId = existingSeries.id;
    } else {
      const sizesMap = Object.fromEntries(sizes.map((s) => [s, 1]));
      const created = allocationStore.addSeries({ name: seriesName, sizes: sizesMap });
      seriesId = created.id;
    }

    // Create product-level assortment rule if none exists for this product
    const existingRule = allocationStore.getAllAssortmentRules().find(
      (r) => r.type === 'product' && r.targetName.toLowerCase() === productName.toLowerCase()
    );
    if (!existingRule) {
      allocationStore.addAssortmentRule({ type: 'product', targetName: productName, seriesId });
    }

    // Also create category-level rule if category available and no rule exists
    if (category) {
      const existingCatRule = allocationStore.getAllAssortmentRules().find(
        (r) => r.type === 'category' && r.targetName.toLowerCase() === category.toLowerCase()
      );
      if (!existingCatRule) {
        allocationStore.addAssortmentRule({ type: 'category', targetName: category, seriesId });
      }
    }
  }
}
