import type { InventoryRecord, TransferSuggestion, AnalysisResult, StoreAllocation, Series } from '@retailflow/shared';
import { allocationStore } from '../store/allocationStore.js';

interface StoreProductInventory {
  inventory: number;
  salesQty: number;
  str: number;
  productCode: string;
  category: string | null;
}

type InventoryMap = Map<string, StoreProductInventory>;

function makeKey(store: string, product: string, color: string, size: string): string {
  return `${store}|||${product}|||${color}|||${size}`;
}

function buildInventoryMap(records: InventoryRecord[]): InventoryMap {
  const map: InventoryMap = new Map();
  for (const r of records) {
    const key = makeKey(r.warehouseName, r.productName, r.color, r.size);
    const existing = map.get(key);
    if (existing) {
      existing.inventory += r.inventory;
      existing.salesQty += r.salesQty;
    } else {
      map.set(key, {
        inventory: r.inventory,
        salesQty: r.salesQty,
        str: 0,
        productCode: r.productCode,
        category: r.category ?? null,
      });
    }
  }
  // Compute STR
  for (const [, v] of map) {
    const total = v.salesQty + v.inventory;
    v.str = total > 0 ? v.salesQty / total : 0;
  }
  return map;
}

function getAllStores(records: InventoryRecord[]): string[] {
  return [...new Set(records.map((r) => r.warehouseName))];
}

export function runAllocationAnalysis(
  records: InventoryRecord[],
  analysisDays: number = 30,
  excludedStores: string[] = [],
): AnalysisResult {
  const started = Date.now();
  const invMap = buildInventoryMap(records);
  const allStores = getAllStores(records).filter((s) => !excludedStores.includes(s));

  const allAllocations = allocationStore.getAllAllocations().filter((a) => a.enabled);
  const allSeries = allocationStore.getAllSeries();

  // Mutable inventory remaining per key (to track what's been "committed" to transfers)
  const remainingInventory = new Map<string, number>();
  for (const [key, v] of invMap) {
    remainingInventory.set(key, v.inventory);
  }

  const transfers: TransferSuggestion[] = [];

  // Build receiver list: all allocations with deficit
  interface ReceiverNeed {
    allocation: StoreAllocation;
    series: Series;
    color: string;
    size: string;
    targetQty: number;
    currentQty: number;
    deficitQty: number;
    str: number;
  }

  // Build unique colors per (store, product) from inventory
  const storeProductColors = new Map<string, Set<string>>();
  for (const r of records) {
    const k = `${r.warehouseName}|||${r.productName}`;
    if (!storeProductColors.has(k)) storeProductColors.set(k, new Set());
    storeProductColors.get(k)!.add(r.color);
  }

  const receiverNeeds: ReceiverNeed[] = [];

  for (const alloc of allAllocations) {
    if (excludedStores.includes(alloc.storeName)) continue;

    const s = allSeries.find((x) => x.id === alloc.seriesId);
    if (!s) continue;

    // Iterate all colors of this product at this store
    const colors = storeProductColors.get(`${alloc.storeName}|||${alloc.productName}`);
    if (!colors) continue;

    for (const color of colors) {
      const sizeEntries = Object.entries(s.sizes);

      // Skip colors that don't exist at this store at all — don't introduce new colors
      const currentColorTotal = sizeEntries.reduce((sum, [size]) => {
        return sum + (invMap.get(makeKey(alloc.storeName, alloc.productName, color, size))?.inventory ?? 0);
      }, 0);
      if (currentColorTotal === 0) continue;

      for (const [size, ratio] of sizeEntries) {
        const targetQty = ratio * alloc.seriesCount;
        const key = makeKey(alloc.storeName, alloc.productName, color, size);
        const inv = invMap.get(key);
        const currentQty = inv?.inventory ?? 0;
        const deficitQty = Math.max(0, targetQty - currentQty);

        if (deficitQty <= 0) continue;

        receiverNeeds.push({
          allocation: alloc,
          series: s,
          color,
          size,
          targetQty,
          currentQty,
          deficitQty,
          str: inv?.str ?? 0,
        });
      }
    }
  }

  // Sort receivers: highest STR first (selling most urgently needs stock)
  receiverNeeds.sort((a, b) => b.str - a.str || b.deficitQty - a.deficitQty);

  for (const need of receiverNeeds) {
    const color = need.color;
    let remaining = need.deficitQty;

    // Find all potential sources: same product+color+size, different store, has inventory
    const sources: Array<{ store: string; str: number; inventory: number; key: string }> = [];

    for (const store of allStores) {
      if (store === need.allocation.storeName) continue;
      const key = makeKey(store, need.allocation.productName, color, need.size);
      const inv = invMap.get(key);
      const rem = remainingInventory.get(key) ?? 0;
      if (!inv || rem <= 0) continue;

      sources.push({ store, str: inv.str, inventory: rem, key });
    }

    // Sort sources: lowest STR first (not selling → give away first)
    sources.sort((a, b) => a.str - b.str);

    for (const src of sources) {
      if (remaining <= 0) break;

      const canSend = Math.min(remaining, src.inventory);
      if (canSend <= 0) continue;

      remaining -= canSend;
      remainingInventory.set(src.key, (remainingInventory.get(src.key) ?? 0) - canSend);

      const srcInv = invMap.get(src.key)!;
      const rcvKey = makeKey(need.allocation.storeName, need.allocation.productName, color, need.size);
      const rcvInv = invMap.get(rcvKey);

      const senderTotal = srcInv.salesQty + srcInv.inventory;
      const receiverTotal = (rcvInv?.salesQty ?? 0) + (rcvInv?.inventory ?? 0);

      transfers.push({
        productKey: `${need.allocation.productName}|||${color}|||${need.size}`,
        productCode: srcInv.productCode,
        productName: need.allocation.productName,
        color,
        size: need.size,
        senderStore: src.store,
        receiverStore: need.allocation.storeName,
        quantity: canSend,
        senderSales: srcInv.salesQty,
        senderInventory: srcInv.inventory,
        receiverSales: rcvInv?.salesQty ?? 0,
        receiverInventory: rcvInv?.inventory ?? 0,
        senderStr: srcInv.str,
        receiverStr: rcvInv?.str ?? 0,
        senderDOS: srcInv.salesQty > 0 ? (srcInv.inventory / (srcInv.salesQty / analysisDays)) : null,
        receiverDOS: rcvInv && rcvInv.salesQty > 0 ? (rcvInv.inventory / (rcvInv.salesQty / analysisDays)) : 0,
        dosDiff: null,
        appliedFilter: `Tahsisat hedefi (${need.series.name} ×${need.allocation.seriesCount})`,
        strategy: 'kontrollu',
        transferType: 'allocation',
        isPrioritySource: false,
        stockStatus: need.currentQty === 0 ? 'KRITIK' : need.deficitQty > need.targetQty / 2 ? 'DUSUK' : 'NORMAL',
        allocationTargetQty: need.targetQty,
        allocationCurrentQty: need.currentQty,
        allocationDeficitQty: need.deficitQty,
        storeCount: senderTotal > 0 || receiverTotal > 0 ? 2 : 1,
      });
    }
  }

  const elapsed = Date.now() - started;
  const uniqueStores = new Set([...transfers.map((t) => t.senderStore), ...transfers.map((t) => t.receiverStore)]);

  return {
    analysisType: 'allocation',
    strategy: 'kontrollu',
    strategyConfig: {
      name: 'kontrollu',
      label: 'Allocation',
      description: 'Tahsisat hedefine tamamlama',
      minSourceDOS: 0,
      maxReceiverDOS: 0,
      minInventory: 0,
      maxTransfer: null,
      deadStockStrThreshold: 0,
    },
    targetStore: null,
    excludedStores,
    transfers,
    rejectedTransfers: [],
    storeMetrics: [],
    simulation: {
      totalTransfers: transfers.length,
      totalItemsMoved: transfers.reduce((s, t) => s + t.quantity, 0),
      affectedStores: uniqueStores.size,
      averageDosImprovement: 0,
      riskLevel: transfers.length > 50 ? 'HIGH' : transfers.length > 20 ? 'MEDIUM' : 'LOW',
      priorityTransfers: 0,
    },
    performance: {
      processingTimeMs: elapsed,
      totalProducts: new Set(transfers.map((t) => t.productName)).size,
      totalStores: allStores.length,
      totalRows: records.length,
    },
  };
}
