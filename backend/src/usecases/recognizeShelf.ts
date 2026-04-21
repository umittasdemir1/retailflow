import fs from 'node:fs';
import type { VisionRecognizeResponse, RecognizedProduct } from '@retailflow/shared';
import { catalogStore } from '../store/catalogStore.js';
import { sessionStore } from '../store/sessionStore.js';
import { recognizeWithPython } from '../services/pythonVision.js';
import { findSwimwearSales } from '../services/swimwearSales.js';

function normalize(value: string): string {
  return value.trim().toLocaleUpperCase('tr');
}

function getInventoryRows(
  inventoryRecords: ReturnType<typeof sessionStore.get>['data'],
  product: ReturnType<typeof catalogStore.getAll>[number],
) {
  if (!inventoryRecords) return [];

  const normalizedCode = normalize(product.productCode);
  if (normalizedCode.length > 0) {
    const exactCodeMatches = inventoryRecords.filter((row) => normalize(row.productCode) === normalizedCode);
    if (exactCodeMatches.length > 0) return exactCodeMatches;
  }

  const normalizedName = normalize(product.productName);
  const normalizedColor = normalize(product.color);

  return inventoryRecords.filter((row) => {
    const sameName = normalize(row.productName) === normalizedName;
    const sameColor = normalizedColor.length === 0 || normalize(row.color) === normalizedColor;
    return sameName && sameColor;
  });
}

export async function recognizeShelf(imagePath: string): Promise<VisionRecognizeResponse> {
  try {
    const catalogProducts = catalogStore.getAll();
    const inventoryRecords = sessionStore.get().data ?? [];
    const pythonResult = await recognizeWithPython(imagePath, catalogProducts);

    const locationsByCatalogId = new Map<string, Array<{ boundingBox: { x: number; y: number; width: number; height: number }; confidence: number }>>();
    for (const detection of pythonResult.detections) {
      const bucket = locationsByCatalogId.get(detection.catalogProductId) ?? [];
      bucket.push({
        boundingBox: detection.boundingBox,
        confidence: detection.confidence,
      });
      bucket.sort((left, right) => right.confidence - left.confidence);
      locationsByCatalogId.set(detection.catalogProductId, bucket);
    }

    const recognizedProducts: RecognizedProduct[] = catalogProducts.map((product) => {
      const foundAt = locationsByCatalogId.get(product.id) ?? [];
      const bestConfidence = foundAt[0]?.confidence ?? 0;
      const rows = getInventoryRows(inventoryRecords, product);
      const totalSales = rows.reduce((a, r) => a + r.salesQty, 0);
      const totalInventory = rows.reduce((a, r) => a + r.inventory, 0);
      const swimwearSales = findSwimwearSales(product.productCode, product.color);
      const strPercent =
        totalSales + totalInventory > 0
          ? Math.round((totalSales / (totalSales + totalInventory)) * 100)
          : null;

      return {
        catalogProductId: product.id,
        productCode: product.productCode,
        productName: product.productName,
        color: product.color,
        description: product.description,
        foundAt,
        bestConfidence,
        found: foundAt.length > 0,
        totalSales: rows.length > 0 ? totalSales : null,
        totalInventory: rows.length > 0 ? totalInventory : null,
        strPercent,
        storeCount: rows.length > 0 ? new Set(rows.map((r) => r.warehouseName)).size : null,
        swimwearSalesQty: swimwearSales?.salesQty ?? null,
      };
    });

    return {
      imageWidth: pythonResult.imageWidth,
      imageHeight: pythonResult.imageHeight,
      recognizedProducts,
      scannedRegions: pythonResult.scannedRegions,
      processingTimeMs: pythonResult.processingTimeMs,
      modelVersion: pythonResult.modelVersion,
    };
  } finally {
    fs.rmSync(imagePath, { force: true });
  }
}
