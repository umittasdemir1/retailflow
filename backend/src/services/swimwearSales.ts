import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';

export interface SwimwearSalesMatch {
  productCode: string;
  productName: string;
  color: string;
  salesQty: number;
  salesVH: number;
}

const WORKBOOK_CANDIDATES = ['Swimwear.xlsx', 'swimwear.xlsx'];

let cachedByKey: Map<string, SwimwearSalesMatch> | null = null;
let cachedWorkbookPath: string | null = null;
let cachedMtimeMs: number | null = null;

function normalize(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase();
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value ?? '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildKey(productCode: string, color: string): string {
  return `${normalize(productCode)}::${normalize(color)}`;
}

function resolveWorkbookPath(): string | null {
  const searchRoots = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '../..'),
  ];

  for (const root of searchRoots) {
    for (const candidate of WORKBOOK_CANDIDATES) {
      const workbookPath = path.join(root, candidate);
      if (fs.existsSync(workbookPath)) return workbookPath;
    }
  }

  return null;
}

function loadSwimwearSales(): Map<string, SwimwearSalesMatch> {
  const workbookPath = resolveWorkbookPath();
  if (!workbookPath) return new Map();

  const stat = fs.statSync(workbookPath);
  if (
    cachedByKey &&
    cachedWorkbookPath === workbookPath &&
    cachedMtimeMs === stat.mtimeMs
  ) {
    return cachedByKey;
  }

  const workbook = xlsx.readFile(workbookPath);
  const firstSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheet];
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const byKey = new Map<string, SwimwearSalesMatch>();

  for (const row of rows) {
    const productCode = String(row['Ürün Kodu'] ?? '').trim();
    const productName = String(row['Ürün Adı'] ?? '').trim();
    const color = String(row['Renk Açıklaması'] ?? '').trim();
    if (!normalize(productCode) || !normalize(color)) continue;

    const key = buildKey(productCode, color);
    const existing = byKey.get(key);
    if (existing) {
      existing.salesQty += toNumber(row['Satış Miktarı']);
      existing.salesVH += toNumber(row['Satış (VH)']);
      continue;
    }

    byKey.set(key, {
      productCode,
      productName,
      color,
      salesQty: toNumber(row['Satış Miktarı']),
      salesVH: toNumber(row['Satış (VH)']),
    });
  }

  cachedByKey = byKey;
  cachedWorkbookPath = workbookPath;
  cachedMtimeMs = stat.mtimeMs;
  return byKey;
}

export function findSwimwearSales(productCode: string, color: string): SwimwearSalesMatch | null {
  const byKey = loadSwimwearSales();
  const exact = byKey.get(buildKey(productCode, color));
  if (exact) return exact;

  const normalizedCode = normalize(productCode);
  const normalizedColor = normalize(color);
  const sameCode = [...byKey.values()].filter((entry) => normalize(entry.productCode) === normalizedCode);
  if (sameCode.length === 1) return sameCode[0] ?? null;

  const fuzzyColor = sameCode.filter((entry) => {
    const entryColor = normalize(entry.color);
    return entryColor.includes(normalizedColor) || normalizedColor.includes(entryColor);
  });

  if (fuzzyColor.length === 1) return fuzzyColor[0] ?? null;
  return null;
}
