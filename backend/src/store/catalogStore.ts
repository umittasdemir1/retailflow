import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface CatalogProduct {
  id: string;
  productCode: string;
  productName: string;
  color: string;
  description: string;
  imageNames: string[];    // filenames in backend/catalog/ (ilki primary)
  featureVector: number[]; // visual fingerprint
  addedAt: string;
}

// backend/catalog/ — hem görseller hem catalog.json burada
const CATALOG_DIR  = path.join(process.cwd(), 'catalog');
const CATALOG_JSON = path.join(CATALOG_DIR, 'catalog.json');

if (!existsSync(CATALOG_DIR)) mkdirSync(CATALOG_DIR, { recursive: true });

const catalog: CatalogProduct[] = [];

function loadFromDisk(): void {
  if (!existsSync(CATALOG_JSON)) return;
  try {
    const raw  = readFileSync(CATALOG_JSON, 'utf-8').trim();
    if (!raw) return;
    const data = JSON.parse(raw) as CatalogProduct[];
    catalog.push(...data);
    console.log(`[CATALOG] ${data.length} ürün diskten yüklendi`);
  } catch (err) {
    console.error('[CATALOG] catalog.json okunamadı, boş başlatılıyor:', err);
  }
}

function saveToDisk(): void {
  try {
    writeFileSync(CATALOG_JSON, JSON.stringify(catalog, null, 2), 'utf-8');
  } catch (err) {
    console.error('[CATALOG] catalog.json yazılamadı:', err);
  }
}

// Sunucu başladığında diskten yükle
loadFromDisk();

export const catalogStore = {
  getAll(): CatalogProduct[] {
    return catalog;
  },

  add(product: CatalogProduct): void {
    catalog.push(product);
    saveToDisk();
  },

  remove(id: string): boolean {
    const idx = catalog.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    catalog.splice(idx, 1);
    saveToDisk();
    return true;
  },

  findById(id: string): CatalogProduct | undefined {
    return catalog.find((p) => p.id === id);
  },

  count(): number {
    return catalog.length;
  },
};
