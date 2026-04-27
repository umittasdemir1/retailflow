import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Series, AssortmentRule, StoreAllocation } from '@retailflow/shared';

const DATA_DIR = path.join(process.cwd(), 'data');
const SERIES_FILE = path.join(DATA_DIR, 'series.json');
const ASSORTMENT_FILE = path.join(DATA_DIR, 'assortment.json');
const ALLOCATION_FILE = path.join(DATA_DIR, 'allocations.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadJson<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  try {
    const raw = readFileSync(file, 'utf-8').trim();
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function saveJson<T>(file: string, data: T[]): void {
  try {
    writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[ALLOCATION] ${file} yazılamadı:`, err);
  }
}

const series: Series[] = loadJson<Series>(SERIES_FILE);
const assortmentRules: AssortmentRule[] = loadJson<AssortmentRule>(ASSORTMENT_FILE);
const allocations: StoreAllocation[] = loadJson<StoreAllocation>(ALLOCATION_FILE);

export const allocationStore = {
  // ── Series ──────────────────────────────────────────────────────────────────
  getAllSeries(): Series[] { return series; },

  addSeries(data: Omit<Series, 'id' | 'createdAt'>): Series {
    const item: Series = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
    series.push(item);
    saveJson(SERIES_FILE, series);
    return item;
  },

  updateSeries(id: string, data: Partial<Omit<Series, 'id' | 'createdAt'>>): Series | null {
    const idx = series.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    series[idx] = { ...series[idx], ...data };
    saveJson(SERIES_FILE, series);
    return series[idx];
  },

  deleteSeries(id: string): boolean {
    const idx = series.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    series.splice(idx, 1);
    saveJson(SERIES_FILE, series);
    return true;
  },

  findSeriesById(id: string): Series | undefined {
    return series.find((s) => s.id === id);
  },

  // ── Assortment Rules ────────────────────────────────────────────────────────
  getAllAssortmentRules(): AssortmentRule[] { return assortmentRules; },

  addAssortmentRule(data: Omit<AssortmentRule, 'id' | 'createdAt'>): AssortmentRule {
    const item: AssortmentRule = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
    assortmentRules.push(item);
    saveJson(ASSORTMENT_FILE, assortmentRules);
    return item;
  },

  updateAssortmentRule(id: string, data: Partial<Omit<AssortmentRule, 'id' | 'createdAt'>>): AssortmentRule | null {
    const idx = assortmentRules.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    assortmentRules[idx] = { ...assortmentRules[idx], ...data };
    saveJson(ASSORTMENT_FILE, assortmentRules);
    return assortmentRules[idx];
  },

  deleteAssortmentRule(id: string): boolean {
    const idx = assortmentRules.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    assortmentRules.splice(idx, 1);
    saveJson(ASSORTMENT_FILE, assortmentRules);
    return true;
  },

  resolveSeriesForProduct(productName: string, category: string | null): Series | null {
    // Product-level rule takes precedence over category-level
    const productRule = assortmentRules.find(
      (r) => r.type === 'product' && r.targetName.toLowerCase() === productName.toLowerCase()
    );
    if (productRule) return series.find((s) => s.id === productRule.seriesId) ?? null;

    if (category) {
      const categoryRule = assortmentRules.find(
        (r) => r.type === 'category' && r.targetName.toLowerCase() === category.toLowerCase()
      );
      if (categoryRule) return series.find((s) => s.id === categoryRule.seriesId) ?? null;
    }

    return null;
  },

  // ── Store Allocations ───────────────────────────────────────────────────────
  getAllAllocations(): StoreAllocation[] { return allocations; },

  getAllocationsForStore(storeName: string): StoreAllocation[] {
    return allocations.filter((a) => a.storeName === storeName);
  },

  addAllocation(data: Omit<StoreAllocation, 'id' | 'createdAt'>): StoreAllocation {
    const item: StoreAllocation = { ...data, id: randomUUID(), createdAt: new Date().toISOString() };
    allocations.push(item);
    saveJson(ALLOCATION_FILE, allocations);
    return item;
  },

  updateAllocation(id: string, data: Partial<Omit<StoreAllocation, 'id' | 'createdAt'>>): StoreAllocation | null {
    const idx = allocations.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    allocations[idx] = { ...allocations[idx], ...data };
    saveJson(ALLOCATION_FILE, allocations);
    return allocations[idx];
  },

  deleteAllocation(id: string): boolean {
    const idx = allocations.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    allocations.splice(idx, 1);
    saveJson(ALLOCATION_FILE, allocations);
    return true;
  },

  bulkUpsertAllocations(items: Omit<StoreAllocation, 'id' | 'createdAt'>[]): StoreAllocation[] {
    const result: StoreAllocation[] = [];
    for (const item of items) {
      const existing = allocations.find(
        (a) => a.storeName === item.storeName && a.productName === item.productName
      );
      if (existing) {
        Object.assign(existing, item);
        result.push(existing);
      } else {
        const newItem: StoreAllocation = { ...item, id: randomUUID(), createdAt: new Date().toISOString() };
        allocations.push(newItem);
        result.push(newItem);
      }
    }
    saveJson(ALLOCATION_FILE, allocations);
    return result;
  },
};
