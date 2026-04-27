import { Router } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

export const sizeTemplatesRouter = Router();

export interface SizeTemplate {
  year: number | null;
  productName: string;
  color: string;
  sizes: string[];
}

const XLSX_PATH = path.resolve(process.cwd(), '..', 'Beden Aralığı.xlsx');

let cache: SizeTemplate[] | null = null;

function loadTemplates(): SizeTemplate[] {
  if (cache) return cache;
  if (!existsSync(XLSX_PATH)) return [];

  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

  const templates: SizeTemplate[] = [];
  for (const row of rows.slice(1) as unknown[][]) {
    const productName = String(row[2] ?? '').trim();
    const sizesStr   = String(row[5] ?? '').trim();
    if (!productName || !sizesStr) continue;

    const sizes = sizesStr.split(',').map((s) => s.trim()).filter(Boolean);
    if (!sizes.length) continue;

    templates.push({
      year:        row[0] ? Number(row[0]) : null,
      productName,
      color:       String(row[4] ?? '').trim(),
      sizes,
    });
  }

  cache = templates;
  return templates;
}

sizeTemplatesRouter.get('/', (_req, res) => {
  res.json({ ok: true, data: loadTemplates() });
});
