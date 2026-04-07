import type { InventoryRecord } from './types.js';

export function toText(value: unknown): string {
  if (value == null) {
    return '';
  }

  return String(value).trim();
}

export function parseLocaleNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalized = toText(value)
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

export function resolveProductIdentity(record: Pick<InventoryRecord, 'productName' | 'color' | 'size'>): string {
  return [record.productName, record.color, record.size]
    .map((part) => toText(part).toUpperCase())
    .filter(Boolean)
    .join(' ');
}
