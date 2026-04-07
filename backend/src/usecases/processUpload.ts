import fs from 'node:fs';
import type { UploadResult } from '@retailflow/shared';
import { parseExcelFile } from '../services/excelParser.js';
import { computeStoreMetrics } from '../services/storeMetrics.js';
import { normalizeUploadedFileName } from '../utils/filename.js';
import { sessionStore } from '../store/sessionStore.js';

export function processUpload(filePath: string, originalName: string): UploadResult {
  try {
    const parsed = parseExcelFile(filePath);
    const metrics = computeStoreMetrics(parsed.records);
    const result: UploadResult = {
      success: true,
      fileName: normalizeUploadedFileName(originalName),
      rowCount: parsed.records.length,
      storeCount: parsed.stores.length,
      stores: parsed.stores,
      columns: parsed.columns,
    };

    sessionStore.setUpload(parsed.records, parsed.stores, metrics, result);
    return result;
  } finally {
    fs.rmSync(filePath, { force: true });
  }
}
