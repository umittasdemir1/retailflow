import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { afterEach, describe, expect, it } from 'vitest';
import { parseExcelFile } from '../src/services/excelParser';

const tempFiles: string[] = [];

afterEach(() => {
  for (const file of tempFiles.splice(0)) {
    fs.rmSync(file, { force: true });
  }
});

describe('excelParser', () => {
  it('parses xlsx rows and normalizes numeric values', () => {
    const filePath = path.join(os.tmpdir(), 'retailflow-parser-' + Date.now() + '.xlsx');
    tempFiles.push(filePath);

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([
      {
        'Depo Adi': 'Merkez Depo',
        'Urun Kodu': 'SKU-1',
        'Urun Adi': 'Gomlek',
        'Renk Aciklamasi': 'Mavi',
        Beden: 'M',
        Satis: '12,5',
        Envanter: '-4',
      },
      {
        'Depo Adi': 'Kadikoy',
        'Urun Kodu': 'SKU-1',
        'Urun Adi': 'Gomlek',
        'Renk Aciklamasi': 'Mavi',
        Beden: 'M',
        Satis: 2,
        Envanter: 8,
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
    XLSX.writeFile(workbook, filePath);

    const parsed = parseExcelFile(filePath);

    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0]).toMatchObject({
      warehouseName: 'Merkez Depo',
      productCode: 'SKU-1',
      productName: 'Gomlek',
      salesQty: 12.5,
      inventory: 0,
    });
    expect(parsed.stores).toEqual(['Kadikoy', 'Merkez Depo']);
  });

  it('parses csv files and validates required columns', () => {
    const filePath = path.join(os.tmpdir(), 'retailflow-parser-' + Date.now() + '.csv');
    tempFiles.push(filePath);

    fs.writeFileSync(
      filePath,
      'Depo Adi,Urun Adi,Satis,Envanter\nAnkara,Kazak,4,9\n',
      'utf8',
    );

    const parsed = parseExcelFile(filePath);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]?.warehouseName).toBe('Ankara');
    expect(parsed.records[0]?.productName).toBe('Kazak');
  });

  it('throws when required columns are missing', () => {
    const filePath = path.join(os.tmpdir(), 'retailflow-parser-' + Date.now() + '.csv');
    tempFiles.push(filePath);

    fs.writeFileSync(filePath, 'Depo Adi,Urun Adi\nAnkara,Kazak\n', 'utf8');

    expect(() => parseExcelFile(filePath)).toThrow(/Gerekli sutunlar eksik/);
  });
});
