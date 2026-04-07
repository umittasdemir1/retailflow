import { describe, expect, it } from 'vitest';
import { normalizeUploadedFileName } from '../src/utils/filename.js';

describe('normalizeUploadedFileName', () => {
  it('decodes latin1 mojibake back to utf8', () => {
    const original = 'Yeni Microsoft Excel Çalışma Sayfası (3).xlsx';
    const mojibake = Buffer.from(original, 'utf8').toString('latin1');

    expect(normalizeUploadedFileName(mojibake)).toBe(original);
  });

  it('leaves already-correct filenames unchanged', () => {
    const original = 'Yeni Microsoft Excel Çalışma Sayfası (3).xlsx';

    expect(normalizeUploadedFileName(original)).toBe(original);
  });
});
