import type { FoundLocation, RecognizedProduct } from '@retailflow/shared';
import { catalogStore } from '../store/catalogStore.js';
import { calibrationStore } from '../store/calibrationStore.js';
import { sessionStore } from '../store/sessionStore.js';
import { recognizeWithOpenAICalibrated } from '../services/openaiVision.js';
import { findSwimwearSales } from '../services/swimwearSales.js';

const TEST_STORE_NAME = 'Midtown';
const TEST_PROVIDER = 'openai';
const EXPECTED_SLOT_COUNT = 18;

export interface TelegramMidtownAnalysisResult {
  ok: true;
  mode: 'telegram-test';
  storeName: string;
  provider: string;
  calibrationId: string;
  slotCount: number;
  selectedCatalogCount: number;
  foundCount: number;
  messageText: string;
  foundProducts: Array<{
    catalogProductId: string;
    productCode: string;
    productName: string;
    color: string;
    salesQty: number | null;
    confidence: number;
    foundAtCount: number;
  }>;
}

export function buildTelegramMessage(products: RecognizedProduct[]): string {
  if (products.length === 0) {
    return [
      'Midtown raf analizi tamamlandi.',
      'Bulunan urun yok.',
    ].join('\n');
  }

  const lines = ['Midtown raf analizi tamamlandi.', ''];
  products.forEach((product, index) => {
    lines.push(`${index + 1}. ${product.productName}`);
    lines.push(`Renk: ${product.color || '-'}`);
    lines.push(`Satis Adedi: ${product.swimwearSalesQty ?? 0}`);
    lines.push('');
  });
  return lines.join('\n').trim();
}

export async function runTelegramMidtownAnalysis(
  imagePath: string,
  selectedCatalogIds?: string[] | null,
): Promise<TelegramMidtownAnalysisResult> {
  const calibration = calibrationStore.findByStore(TEST_STORE_NAME);
  if (!calibration) {
    throw new Error(`Kalibrasyon bulunamadi: ${TEST_STORE_NAME}`);
  }
  if (calibration.slots.length !== EXPECTED_SLOT_COUNT) {
    throw new Error(`Beklenen ${EXPECTED_SLOT_COUNT} slot, bulunan ${calibration.slots.length}`);
  }

  const fullCatalog = catalogStore.getAll();
  const catalog = selectedCatalogIds && selectedCatalogIds.length > 0
    ? fullCatalog.filter((item) => selectedCatalogIds.includes(item.id))
    : fullCatalog;

  if (catalog.length === 0) {
    throw new Error('Analiz icin en az bir referans urun secin.');
  }

  const recognitionResult = await recognizeWithOpenAICalibrated(
    imagePath,
    calibration.slots,
    calibration.dots,
    catalog,
  );

  const inventoryRecords = sessionStore.get().data ?? [];
  const productMap = new Map<string, RecognizedProduct>();

  for (const item of catalog) {
    const rows = inventoryRecords.filter(
      (record) =>
        record.productCode === item.productCode ||
        record.productName.toLowerCase().includes(item.productName.toLowerCase()),
    );
    const totalSales = rows.reduce((sum, record) => sum + record.salesQty, 0);
    const totalInventory = rows.reduce((sum, record) => sum + record.inventory, 0);
    const swimwearSales = findSwimwearSales(item.productCode, item.color);

    productMap.set(item.id, {
      catalogProductId: item.id,
      productCode: item.productCode,
      productName: item.productName,
      color: item.color,
      description: item.description,
      foundAt: [],
      bestConfidence: 0,
      found: false,
      totalSales: rows.length > 0 ? totalSales : null,
      totalInventory: rows.length > 0 ? totalInventory : null,
      strPercent:
        rows.length > 0 && totalSales + totalInventory > 0
          ? Math.round((totalSales / (totalSales + totalInventory)) * 100)
          : null,
      storeCount: rows.length > 0 ? new Set(rows.map((record) => record.warehouseName)).size : null,
      swimwearSalesQty: swimwearSales?.salesQty ?? null,
    });
  }

  for (const detection of recognitionResult.detections) {
    const product = productMap.get(detection.catalogProductId);
    if (!product) continue;

    const location: FoundLocation = {
      boundingBox: detection.boundingBox,
      confidence: detection.confidence,
    };
    if ('dotPosition' in detection && detection.dotPosition) {
      location.dotPosition = detection.dotPosition as { x: number; y: number };
    }

    product.foundAt.push(location);
    if (detection.confidence > product.bestConfidence) {
      product.bestConfidence = detection.confidence;
      product.found = true;
    }
  }

  const foundProducts = [...productMap.values()]
    .filter((product) => product.found)
    .sort((left, right) => right.bestConfidence - left.bestConfidence);

  return {
    ok: true,
    mode: 'telegram-test',
    storeName: TEST_STORE_NAME,
    provider: TEST_PROVIDER,
    calibrationId: calibration.id,
    slotCount: calibration.slots.length,
    selectedCatalogCount: catalog.length,
    foundCount: foundProducts.length,
    messageText: buildTelegramMessage(foundProducts),
    foundProducts: foundProducts.map((product) => ({
      catalogProductId: product.catalogProductId,
      productCode: product.productCode,
      productName: product.productName,
      color: product.color,
      salesQty: product.swimwearSalesQty,
      confidence: product.bestConfidence,
      foundAtCount: product.foundAt.length,
    })),
  };
}
