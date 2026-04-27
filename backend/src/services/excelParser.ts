import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { TextDecoder } from 'node:util';
import { parseLocaleNumber, toText, type InventoryRecord } from '@retailflow/shared';

const require = createRequire(import.meta.url);
function getXLSX(): typeof import('xlsx') {
  return require('xlsx') as typeof import('xlsx');
}

const columnMap = {
  'Depo Adi': 'warehouseName',
  'Depo Adı': 'warehouseName',
  'Urun Kodu': 'productCode',
  'Ürün Kodu': 'productCode',
  'Urun Adi': 'productName',
  'Ürün Adı': 'productName',
  'Renk Aciklamasi': 'color',
  'Renk Açıklaması': 'color',
  Beden: 'size',
  Satis: 'salesQty',
  'Satış': 'salesQty',
  Envanter: 'inventory',
  Iade: 'returnQty',
  'İade': 'returnQty',
  Cinsiyet: 'gender',
  'Uretim Yili': 'productionYear',
  'Üretim Yılı': 'productionYear',
  'Son Satis Tarihi': 'lastSaleDate',
  'Son Satış Tarihi': 'lastSaleDate',
  'Ilk Stok Giris Tarihi': 'firstStockEntryDate',
  'İlk Stok Giriş Tarihi': 'firstStockEntryDate',
  'Ilk Satis Tarihi': 'firstSaleDate',
  'İlk Satış Tarihi': 'firstSaleDate',
  'Item URL': 'itemUrl',
  'Item Url': 'itemUrl',
  'item url': 'itemUrl',
  'Gorsel': 'itemUrl',
  'Görsel': 'itemUrl',
  'Resim': 'itemUrl',
  'Urun Resmi': 'itemUrl',
  'Ürün Resmi': 'itemUrl',
  'Price': 'price',
  'Fiyat': 'price',
  'Satis Fiyati': 'price',
  'Satış Fiyatı': 'price',
  'Category': 'category',
  'Kategori': 'category',
  'Urun Kategorisi': 'category',
  'Ürün Kategorisi': 'category',
  'Beden Araligi': 'sizeRange',
  'Beden Aralığı': 'sizeRange',
} as const;

type ColumnTarget = (typeof columnMap)[keyof typeof columnMap];
const requiredTargets = ['warehouseName', 'productName', 'salesQty', 'inventory'] as const;

export interface ParsedUpload {
  records: InventoryRecord[];
  stores: string[];
  columns: string[];
}

export function parseExcelFile(filePath: string): ParsedUpload {
  const ext = path.extname(filePath).toLowerCase();
  const rows = ext === '.csv' ? readCsvRows(filePath) : readWorkbookRows(filePath);
  const columns = Object.keys(rows[0] ?? {});

  assertRequiredColumns(columns);

  const records = rows
    .map((row) => normalizeRow(row))
    .filter((row) => row.warehouseName.length > 0 && row.productName.length > 0);

  if (records.length === 0) {
    throw new Error('Yüklenen dosyada işlenebilir veri bulunamadı');
  }

  const stores = Array.from(new Set(records.map((record) => record.warehouseName))).sort((a, b) => a.localeCompare(b, 'tr'));
  return { records, stores, columns };
}

function readWorkbookRows(filePath: string): Record<string, unknown>[] {
  const XLSX = getXLSX();
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: false, raw: false, codepage: 65001 });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
}

function readCsvRows(filePath: string): Record<string, unknown>[] {
  const XLSX = getXLSX();
  const buffer = fs.readFileSync(filePath);
  const utf8 = tryDecode(buffer, 'utf-8');
  const text = utf8 ?? tryDecode(buffer, 'windows-1254') ?? buffer.toString('latin1');
  const workbook = XLSX.read(text, { type: 'string', raw: false, codepage: 65001 });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
}

function tryDecode(buffer: Buffer, encoding: string): string | null {
  try {
    return new TextDecoder(encoding as 'utf-8', { fatal: true }).decode(buffer);
  } catch {
    return null;
  }
}

function assertRequiredColumns(columns: string[]): void {
  const availableTargets = new Set<ColumnTarget>();
  for (const column of columns) {
    const target = columnMap[column as keyof typeof columnMap];
    if (target) {
      availableTargets.add(target);
    }
  }

  const missing = requiredTargets.filter((target) => availableTargets.has(target) === false);
  if (missing.length > 0) {
    throw new Error('Gerekli sütunlar eksik: ' + missing.join(', '));
  }
}

function normalizeRow(row: Record<string, unknown>): InventoryRecord {
  const normalized: InventoryRecord = {
    warehouseName: '',
    productCode: '',
    productName: '',
    color: '',
    size: '',
    salesQty: 0,
    inventory: 0,
    itemUrl: null,
    price: null,
    category: null,
    sizeRange: null,
  };

  for (const [sourceKey, targetKey] of Object.entries(columnMap) as Array<[string, ColumnTarget]>) {
    const value = row[sourceKey];
    if (value == null || value === '') {
      continue;
    }

    if (targetKey === 'salesQty' || targetKey === 'inventory' || targetKey === 'returnQty' || targetKey === 'productionYear' || targetKey === 'price') {
      normalized[targetKey] = parseLocaleNumber(value);
      continue;
    }

    normalized[targetKey] = toText(value);
  }

  normalized.salesQty = Math.max(0, normalized.salesQty);
  normalized.inventory = Math.max(0, normalized.inventory);
  normalized.returnQty = normalized.returnQty == null ? undefined : Math.max(0, normalized.returnQty);
  normalized.productionYear = normalized.productionYear == null || normalized.productionYear === 0
    ? null
    : Math.trunc(normalized.productionYear);

  return normalized;
}
