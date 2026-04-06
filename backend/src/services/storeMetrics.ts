import { DEFAULT_PRIORITY_SOURCES, type InventoryRecord, type StoreMetrics } from '@retailflow/shared';
import { computeCoverDays, computeSalesVelocity, computeStr } from './strCalculator';

export function computeStoreMetrics(records: InventoryRecord[], prioritySources = DEFAULT_PRIORITY_SOURCES): StoreMetrics[] {
  const grouped = new Map<string, { totalSales: number; totalInventory: number; products: Set<string> }>();

  for (const record of records) {
    const current = grouped.get(record.warehouseName) ?? {
      totalSales: 0,
      totalInventory: 0,
      products: new Set<string>(),
    };

    current.totalSales += record.salesQty;
    current.totalInventory += record.inventory;
    current.products.add(record.productCode + ':' + record.color + ':' + record.size);
    grouped.set(record.warehouseName, current);
  }

  return Array.from(grouped.entries()).map(([name, metrics]) => {
    const strRate = computeStr(metrics.totalSales, metrics.totalInventory);
    const coverDays = computeCoverDays(metrics.totalInventory, computeSalesVelocity(metrics.totalSales));

    return {
      name,
      totalSales: metrics.totalSales,
      totalInventory: metrics.totalInventory,
      strRate,
      strPercent: Number((strRate * 100).toFixed(2)),
      productCount: metrics.products.size,
      excessInventory: metrics.totalInventory - metrics.totalSales,
      coverDays,
      isPrioritySource: prioritySources.has(name),
    };
  });
}
