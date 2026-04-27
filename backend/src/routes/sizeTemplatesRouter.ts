import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Multer } from 'multer';
import * as XLSX from 'xlsx';

export interface SizeTemplate {
  year: number | null;
  productName: string;
  color: string;
  sizes: string[];
}

let uploadedTemplates: SizeTemplate[] | null = null;

function parseWorkbook(buffer: Buffer): SizeTemplate[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

  if (rows.length < 2) return [];

  const header = (rows[0] as string[]).map((h) => String(h).trim().toLowerCase());

  // Detect columns by header name
  const colYear    = header.findIndex((h) => h.includes('yıl') || h.includes('yil') || h === 'year');
  const colProduct = header.findIndex((h) => h.includes('ürün adı') || h.includes('urun adi') || h.includes('model'));
  const colColor   = header.findIndex((h) => h.includes('renk açıklama') || h.includes('renk adi') || h.includes('color'));
  // "Beden Aralığı" column — user adds this at the end; use the LAST column containing "beden"
  const colSizes = header.reduce((last, h, i) => (h.includes('beden') ? i : last), -1);

  if (colProduct === -1 || colSizes === -1) return [];

  const templates: SizeTemplate[] = [];
  for (const row of rows.slice(1) as unknown[][]) {
    const productName = String(row[colProduct] ?? '').trim();
    const sizesStr    = String(row[colSizes]   ?? '').trim();
    if (!productName || !sizesStr) continue;

    const sizes = sizesStr.split(',').map((s) => s.trim()).filter(Boolean);
    if (!sizes.length) continue;

    templates.push({
      year:        colYear  >= 0 && row[colYear]  ? Number(row[colYear])  : null,
      productName,
      color:       colColor >= 0 && row[colColor] ? String(row[colColor]).trim() : '',
      sizes,
    });
  }
  return templates;
}

export function createSizeTemplatesRouter(upload: Multer): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    if (!uploadedTemplates) {
      res.json({ ok: true, data: [], uploaded: false });
      return;
    }
    res.json({ ok: true, data: uploadedTemplates, uploaded: true });
  });

  const handleUpload: RequestHandler = (req, res) => {
    if (!req.file) {
      res.status(400).json({ ok: false, error: 'Dosya bulunamadı' });
      return;
    }
    try {
      uploadedTemplates = parseWorkbook(req.file.buffer);
      res.json({ ok: true, count: uploadedTemplates.length });
    } catch {
      res.status(400).json({ ok: false, error: 'Excel okunamadı' });
    }
  };

  router.post('/upload', upload.single('file'), handleUpload);

  return router;
}
