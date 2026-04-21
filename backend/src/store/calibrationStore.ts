import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { StoreCalibration } from '@retailflow/shared';

const CALIBRATION_DIR  = path.join(process.cwd(), 'calibrations');
const CALIBRATION_JSON = path.join(CALIBRATION_DIR, 'calibrations.json');

if (!existsSync(CALIBRATION_DIR)) mkdirSync(CALIBRATION_DIR, { recursive: true });

const calibrations: StoreCalibration[] = [];

function loadFromDisk(): void {
  if (!existsSync(CALIBRATION_JSON)) return;
  try {
    const raw = readFileSync(CALIBRATION_JSON, 'utf-8').trim();
    if (!raw) return;
    const data = JSON.parse(raw) as StoreCalibration[];
    calibrations.push(...data);
    console.log(`[CALIBRATION] ${data.length} kalibrasyon diskten yüklendi`);
  } catch (err) {
    console.error('[CALIBRATION] calibrations.json okunamadı:', err);
  }
}

function saveToDisk(): void {
  try {
    writeFileSync(CALIBRATION_JSON, JSON.stringify(calibrations, null, 2), 'utf-8');
  } catch (err) {
    console.error('[CALIBRATION] calibrations.json yazılamadı:', err);
  }
}

loadFromDisk();

export const calibrationStore = {
  getAll(): StoreCalibration[] {
    return calibrations;
  },

  findById(id: string): StoreCalibration | undefined {
    return calibrations.find((c) => c.id === id);
  },

  findByStore(storeName: string): StoreCalibration | undefined {
    return calibrations.find(
      (c) => c.storeName.toLowerCase() === storeName.toLowerCase(),
    );
  },

  upsert(calibration: StoreCalibration): StoreCalibration {
    const idx = calibrations.findIndex((c) => c.id === calibration.id);
    if (idx !== -1) {
      calibrations[idx] = calibration;
    } else {
      calibrations.push(calibration);
    }
    saveToDisk();
    return calibration;
  },

  remove(id: string): boolean {
    const idx = calibrations.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    calibrations.splice(idx, 1);
    saveToDisk();
    return true;
  },
};
