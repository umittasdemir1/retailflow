import {
  DEFAULT_PRIORITY_SOURCES,
  STRATEGY_CONFIGS,
  type AnalysisResult,
  type AnalyzeRequest,
  type InventoryRecord,
  type RejectedTransfer,
  type StoreMetrics,
  type StrategyConfig,
  type TransferSimulation,
  type TransferSuggestion,
} from '@retailflow/shared';
import { resolveProductIdentity } from '@retailflow/shared';
import {
  checkTransferConditions,
  computeDOS,
  computeDOSBasedTransfer,
  computeSalesVelocity,
  computeStr,
} from './strCalculator.js';

interface StoreProductAggregate extends InventoryRecord {
  productKey: string;
  strRate: number;
}

interface AnalysisCollections {
  transfers: TransferSuggestion[];
  rejectedTransfers: RejectedTransfer[];
}

function resolveStrategyConfig(request: AnalyzeRequest): StrategyConfig {
  const base = STRATEGY_CONFIGS[request.strategy];
  if (request.strategy === 'custom' && request.customConfig) {
    return { ...base, ...request.customConfig };
  }
  return base;
}

function getProductDOS(aggregate: StoreProductAggregate, analysisDays: number): number | null {
  const velocity = computeSalesVelocity(aggregate.salesQty, analysisDays);
  if (aggregate.inventory === 0) return 0;
  return computeDOS(aggregate.inventory, velocity);
}

export function runTransferAnalysis(records: InventoryRecord[], request: AnalyzeRequest, storeMetrics: StoreMetrics[]): AnalysisResult {
  const startedAt = Date.now();
  const prioritySources = new Set(request.prioritySources?.length ? request.prioritySources : Array.from(DEFAULT_PRIORITY_SOURCES));
  const excludedStores = request.excludedStores ?? [];
  const excluded = new Set(excludedStores);
  const includedCategories = request.includedCategories?.length
    ? new Set(request.includedCategories.map((c) => c.toLowerCase()))
    : null;
  const filteredRecords = includedCategories
    ? records.filter((r) => r.category != null && includedCategories.has(r.category.toLowerCase()))
    : records;
  const allProductGroups = buildProductGroups(filteredRecords, request.groupingMode ?? 'name');

  let transfers: TransferSuggestion[] = [];
  let rejectedTransfers: RejectedTransfer[] = [];

  if (request.transferType === 'targeted') {
    if (request.targetStore == null) {
      throw new Error('Target store required for targeted analysis');
    }

    transfers = runTargetedAnalysis(allProductGroups, request.targetStore, request, prioritySources, excluded);
  } else if (request.transferType === 'size_completion') {
    if (request.targetStore == null) {
      throw new Error('Target store required for size completion');
    }

    transfers = runSizeCompletionAnalysis(allProductGroups, request.targetStore, request, prioritySources, excluded);
  } else {
    const filteredProductGroups = filterExcludedStores(allProductGroups, excluded);
    const globalResult = runGlobalAnalysis(filteredProductGroups, request, prioritySources);
    transfers = globalResult.transfers;
    rejectedTransfers = globalResult.rejectedTransfers;
  }

  const relevantStoreNames = new Set<string>();
  for (const group of allProductGroups.values()) {
    for (const item of group) {
      if (request.transferType === 'global' && excluded.has(item.warehouseName)) {
        continue;
      }
      relevantStoreNames.add(item.warehouseName);
    }
  }

  return {
    analysisType: request.transferType,
    strategy: request.strategy,
    strategyConfig: resolveStrategyConfig(request),
    targetStore: request.targetStore ?? null,
    excludedStores,
    transfers,
    rejectedTransfers,
    storeMetrics,
    simulation: simulateTransferImpact(transfers),
    performance: {
      processingTimeMs: Date.now() - startedAt,
      totalProducts: allProductGroups.size,
      totalStores: relevantStoreNames.size,
      totalRows: records.length,
      rejectedTransfers: rejectedTransfers.length,
      excludedStoresCount: excludedStores.length,
    },
  };
}

export function simulateTransferImpact(transfers: TransferSuggestion[]): TransferSimulation {
  const totalItemsMoved = transfers.reduce((sum, transfer) => sum + transfer.quantity, 0);
  const affectedStores = new Set(transfers.flatMap((transfer) => [transfer.senderStore, transfer.receiverStore])).size;
  const dosImprovements = transfers.map((t) => t.dosDiff ?? 0);
  const averageDosImprovement = dosImprovements.length === 0
    ? 0
    : dosImprovements.reduce((a, b) => a + b, 0) / dosImprovements.length;
  const priorityTransfers = transfers.filter((transfer) => transfer.isPrioritySource).length;
  const highVolumeTransfers = transfers.filter((transfer) => transfer.quantity > 10).length;

  let riskLevel: TransferSimulation['riskLevel'] = 'LOW';
  if (transfers.length > 0 && highVolumeTransfers > transfers.length * 0.3) {
    riskLevel = 'HIGH';
  } else if (transfers.length > 0 && highVolumeTransfers > transfers.length * 0.1) {
    riskLevel = 'MEDIUM';
  }

  return {
    totalTransfers: transfers.length,
    totalItemsMoved,
    affectedStores,
    averageDosImprovement: Number(averageDosImprovement.toFixed(1)),
    riskLevel,
    priorityTransfers,
  };
}

function runGlobalAnalysis(
  productGroups: Map<string, StoreProductAggregate[]>,
  request: AnalyzeRequest,
  prioritySources: Set<string>,
): AnalysisCollections {
  const transfers: TransferSuggestion[] = [];
  const rejectedTransfers: RejectedTransfer[] = [];
  const strategyConfig = resolveStrategyConfig(request);
  const analysisDays = request.analysisDays ?? 30;

  for (const [productKey, stores] of productGroups.entries()) {
    if (stores.length < 2) {
      continue;
    }

    // Sort by DOS ascending: lowest DOS (most urgent receiver) first
    const sortedByDOS = [...stores].sort((a, b) => {
      const dosA = getProductDOS(a, analysisDays) ?? Infinity;
      const dosB = getProductDOS(b, analysisDays) ?? Infinity;
      return dosA - dosB;
    });

    const receiver = sortedByDOS[0];
    const sender = pickGlobalSender(sortedByDOS.slice(1), prioritySources);

    const eligibility = checkTransferConditions(
      sender.salesQty,
      sender.inventory,
      receiver.salesQty,
      receiver.inventory,
      strategyConfig,
      analysisDays,
    );

    if (!eligibility.eligible) {
      const averageStr = stores.reduce((sum, store) => sum + store.strRate, 0) / stores.length;
      const senderDOS = getProductDOS(sender, analysisDays);
      const receiverDOS = getProductDOS(receiver, analysisDays);
      const dosDiff = senderDOS !== null && receiverDOS !== null ? senderDOS - receiverDOS : null;

      rejectedTransfers.push({
        productKey,
        productName: receiver.productName,
        color: receiver.color,
        size: receiver.size,
        storeCount: stores.length,
        averageStr: Number((averageStr * 100).toFixed(1)),
        dosDiff: dosDiff !== null ? Number(dosDiff.toFixed(1)) : null,
        reason: eligibility.reason,
      });
      continue;
    }

    const transfer = computeDOSBasedTransfer(
      sender.salesQty,
      sender.inventory,
      receiver.salesQty,
      receiver.inventory,
      strategyConfig,
      analysisDays,
    );

    if (transfer.quantity <= 0) {
      continue;
    }

    transfers.push({
      productKey,
      productCode: sender.productCode || receiver.productCode,
      productName: sender.productName || receiver.productName,
      color: sender.color || receiver.color,
      size: sender.size || receiver.size,
      senderStore: sender.warehouseName,
      receiverStore: receiver.warehouseName,
      quantity: transfer.quantity,
      senderSales: sender.salesQty,
      senderInventory: sender.inventory,
      receiverSales: receiver.salesQty,
      receiverInventory: receiver.inventory,
      senderStr: toPercent(transfer.senderStr),
      receiverStr: toPercent(transfer.receiverStr),
      senderDOS: transfer.senderDOS,
      receiverDOS: transfer.receiverDOS,
      dosDiff: transfer.dosDiff,
      appliedFilter: transfer.appliedFilter,
      strategy: request.strategy,
      transferType: request.transferType,
      isPrioritySource: prioritySources.has(sender.warehouseName),
      stockStatus: stockStatusFromDOS(transfer.receiverDOS),
      storeCount: stores.length,
      minStr: toPercent(Math.min(...stores.map((s) => s.strRate))),
      maxStr: toPercent(Math.max(...stores.map((s) => s.strRate))),
      salesDiff: receiver.salesQty - sender.salesQty,
      inventoryDiff: sender.inventory - receiver.inventory,
    });
  }

  transfers.sort(comparePriorityThenDOS);
  rejectedTransfers.sort((a, b) => (b.dosDiff ?? 0) - (a.dosDiff ?? 0));

  return { transfers, rejectedTransfers };
}

function runTargetedAnalysis(
  productGroups: Map<string, StoreProductAggregate[]>,
  targetStore: string,
  request: AnalyzeRequest,
  prioritySources: Set<string>,
  excluded: Set<string>,
): TransferSuggestion[] {
  const transfers: TransferSuggestion[] = [];
  const strategyConfig = resolveStrategyConfig(request);
  const analysisDays = request.analysisDays ?? 30;
  const targetProducts = Array.from(productGroups.values())
    .map((stores) => stores.find((store) => store.warehouseName === targetStore) ?? null)
    .filter((store): store is StoreProductAggregate => store !== null);

  for (const targetProduct of targetProducts) {
    const stores = productGroups.get(targetProduct.productKey) ?? [];
    let bestTransfer: TransferSuggestion | null = null;
    let bestPriorityScore = Number.NEGATIVE_INFINITY;

    const warehouseCandidates = stores
      .filter((store) => (
        store.warehouseName !== targetStore
        && !excluded.has(store.warehouseName)
        && prioritySources.has(store.warehouseName)
        && store.inventory >= strategyConfig.minInventory
      ))
      .sort((a, b) => b.inventory - a.inventory || a.warehouseName.localeCompare(b.warehouseName, 'tr'));

    for (const warehouseCandidate of warehouseCandidates) {
      const transfer = computeDOSBasedTransfer(
        warehouseCandidate.salesQty,
        warehouseCandidate.inventory,
        targetProduct.salesQty,
        targetProduct.inventory,
        strategyConfig,
        analysisDays,
      );

      if (transfer.quantity <= 0) {
        continue;
      }

      bestTransfer = buildTransferSuggestion(warehouseCandidate, targetProduct, transfer, request, true);
      break;
    }

    if (bestTransfer !== null) {
      transfers.push(bestTransfer);
      continue;
    }

    const donorCandidates = stores.filter((store) => (
      store.warehouseName !== targetStore
      && !excluded.has(store.warehouseName)
      && !prioritySources.has(store.warehouseName)
    ));

    for (const donorCandidate of donorCandidates) {
      const eligibility = checkTransferConditions(
        donorCandidate.salesQty,
        donorCandidate.inventory,
        targetProduct.salesQty,
        targetProduct.inventory,
        strategyConfig,
        analysisDays,
      );

      if (!eligibility.eligible) {
        continue;
      }

      const transfer = computeDOSBasedTransfer(
        donorCandidate.salesQty,
        donorCandidate.inventory,
        targetProduct.salesQty,
        targetProduct.inventory,
        strategyConfig,
        analysisDays,
      );

      if (transfer.quantity <= 0) {
        continue;
      }

      // Score: higher DOS gap = more urgent; inventory bonus for availability
      const dosDiff = transfer.dosDiff ?? 0;
      const priorityScore = dosDiff + Math.min(donorCandidate.inventory / 10, 50);
      if (priorityScore <= bestPriorityScore) {
        continue;
      }

      bestPriorityScore = priorityScore;
      bestTransfer = buildTransferSuggestion(donorCandidate, targetProduct, transfer, request, false);
    }

    if (bestTransfer !== null) {
      transfers.push(bestTransfer);
    }
  }

  transfers.sort(comparePriorityThenDOS);
  return transfers;
}

function runSizeCompletionAnalysis(
  productGroups: Map<string, StoreProductAggregate[]>,
  targetStore: string,
  request: AnalyzeRequest,
  prioritySources: Set<string>,
  excluded: Set<string>,
): TransferSuggestion[] {
  const transfers: TransferSuggestion[] = [];
  const targetProducts = Array.from(productGroups.values())
    .map((stores) => stores.find((store) => store.warehouseName === targetStore) ?? null)
    .filter((store): store is StoreProductAggregate => store !== null)
    .filter((store) => store.inventory === 0);

  for (const targetProduct of targetProducts) {
    const stores = productGroups.get(targetProduct.productKey) ?? [];
    const donorCandidates = stores.filter((store) => (
      store.warehouseName !== targetStore
      && !excluded.has(store.warehouseName)
      && store.inventory > 0
    ));

    if (donorCandidates.length === 0) {
      continue;
    }

    const priorityCandidates = donorCandidates.filter((store) => prioritySources.has(store.warehouseName));
    const sender = (priorityCandidates.length > 0 ? priorityCandidates : donorCandidates)
      .slice()
      .sort((a, b) => b.inventory - a.inventory || a.warehouseName.localeCompare(b.warehouseName, 'tr'))[0];

    const analysisDays = request.analysisDays ?? 30;
    const senderVelocity = computeSalesVelocity(sender.salesQty, analysisDays);
    const senderDOS = computeDOS(sender.inventory, senderVelocity);
    const receiverDOS = 0; // inventory === 0

    transfers.push({
      productKey: targetProduct.productKey,
      productCode: sender.productCode || targetProduct.productCode,
      productName: sender.productName || targetProduct.productName,
      color: sender.color || targetProduct.color,
      size: sender.size || targetProduct.size,
      senderStore: sender.warehouseName,
      receiverStore: targetStore,
      quantity: 1,
      senderSales: sender.salesQty,
      senderInventory: sender.inventory,
      receiverSales: targetProduct.salesQty,
      receiverInventory: targetProduct.inventory,
      senderStr: toPercent(computeStr(sender.salesQty, sender.inventory)),
      receiverStr: 0,
      senderDOS: senderDOS !== null ? Number(senderDOS.toFixed(1)) : null,
      receiverDOS,
      dosDiff: senderDOS !== null ? Number(senderDOS.toFixed(1)) : null,
      appliedFilter: 'Beden tamamlama',
      strategy: request.strategy,
      transferType: request.transferType,
      isPrioritySource: prioritySources.has(sender.warehouseName),
      storeCount: stores.length,
    });
  }

  transfers.sort((a, b) => {
    if (a.isPrioritySource !== b.isPrioritySource) {
      return a.isPrioritySource ? -1 : 1;
    }

    return a.productKey.localeCompare(b.productKey, 'tr');
  });

  return transfers;
}

function buildTransferSuggestion(
  sender: StoreProductAggregate,
  receiver: StoreProductAggregate,
  transfer: ReturnType<typeof computeDOSBasedTransfer>,
  request: AnalyzeRequest,
  isPrioritySource: boolean,
): TransferSuggestion {
  return {
    productKey: receiver.productKey,
    productCode: sender.productCode || receiver.productCode,
    productName: sender.productName || receiver.productName,
    color: sender.color || receiver.color,
    size: sender.size || receiver.size,
    senderStore: sender.warehouseName,
    receiverStore: receiver.warehouseName,
    quantity: transfer.quantity,
    senderSales: sender.salesQty,
    senderInventory: sender.inventory,
    receiverSales: receiver.salesQty,
    receiverInventory: receiver.inventory,
    senderStr: toPercent(transfer.senderStr),
    receiverStr: toPercent(transfer.receiverStr),
    senderDOS: transfer.senderDOS,
    receiverDOS: transfer.receiverDOS,
    dosDiff: transfer.dosDiff,
    appliedFilter: transfer.appliedFilter,
    strategy: request.strategy,
    transferType: request.transferType,
    isPrioritySource,
  };
}

function buildProductGroups(records: InventoryRecord[], groupingMode: 'name' | 'sku' = 'name'): Map<string, StoreProductAggregate[]> {
  const groupedByProduct = new Map<string, Map<string, StoreProductAggregate>>();
  const resolveKey = groupingMode === 'sku'
    ? (r: InventoryRecord) => r.productCode.trim().toUpperCase()
    : resolveProductIdentity;

  for (const record of records) {
    const productKey = resolveKey(record);
    const productStores = groupedByProduct.get(productKey) ?? new Map<string, StoreProductAggregate>();
    const existing = productStores.get(record.warehouseName);

    if (existing) {
      existing.salesQty += record.salesQty;
      existing.inventory += record.inventory;
      if (!existing.productCode && record.productCode) {
        existing.productCode = record.productCode;
      }
      if (!existing.color && record.color) {
        existing.color = record.color;
      }
      if (!existing.size && record.size) {
        existing.size = record.size;
      }
    } else {
      productStores.set(record.warehouseName, {
        ...record,
        productKey,
        strRate: 0,
      });
    }

    groupedByProduct.set(productKey, productStores);
  }

  const result = new Map<string, StoreProductAggregate[]>();
  for (const [productKey, stores] of groupedByProduct.entries()) {
    const aggregates = Array.from(stores.values()).map((store) => ({
      ...store,
      strRate: computeStr(store.salesQty, store.inventory),
    }));
    result.set(productKey, aggregates);
  }

  return result;
}

function filterExcludedStores(
  productGroups: Map<string, StoreProductAggregate[]>,
  excluded: Set<string>,
): Map<string, StoreProductAggregate[]> {
  const filtered = new Map<string, StoreProductAggregate[]>();

  for (const [productKey, stores] of productGroups.entries()) {
    const remaining = stores.filter((store) => !excluded.has(store.warehouseName));
    if (remaining.length > 0) {
      filtered.set(productKey, remaining);
    }
  }

  return filtered;
}

function pickGlobalSender(stores: StoreProductAggregate[], prioritySources: Set<string>): StoreProductAggregate {
  const warehouseCandidatesGe2 = stores
    .filter((store) => prioritySources.has(store.warehouseName) && store.inventory >= 2)
    .sort((a, b) => b.inventory - a.inventory || a.warehouseName.localeCompare(b.warehouseName, 'tr'));

  if (warehouseCandidatesGe2.length > 0) {
    return warehouseCandidatesGe2[0];
  }

  const warehouseCandidatesEq1 = stores
    .filter((store) => prioritySources.has(store.warehouseName) && store.inventory === 1)
    .sort((a, b) => a.warehouseName.localeCompare(b.warehouseName, 'tr'));

  if (warehouseCandidatesEq1.length > 0) {
    return warehouseCandidatesEq1[0];
  }

  return stores[0];
}

function comparePriorityThenDOS(left: TransferSuggestion, right: TransferSuggestion): number {
  if (left.isPrioritySource !== right.isPrioritySource) {
    return left.isPrioritySource ? -1 : 1;
  }

  const leftDos = left.dosDiff ?? 0;
  const rightDos = right.dosDiff ?? 0;
  if (rightDos !== leftDos) {
    return rightDos - leftDos;
  }

  return left.productKey.localeCompare(right.productKey, 'tr');
}

function stockStatusFromDOS(receiverDOS: number | null): TransferSuggestion['stockStatus'] {
  if (receiverDOS === null) return 'NORMAL';
  if (receiverDOS <= 3) return 'KRITIK';
  if (receiverDOS <= 7) return 'DUSUK';
  if (receiverDOS <= 14) return 'NORMAL';
  return 'YUKSEK';
}

function toPercent(value: number): number {
  return Number((value * 100).toFixed(1));
}
