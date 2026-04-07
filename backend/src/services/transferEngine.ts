import {
  DEFAULT_PRIORITY_SOURCES,
  STRATEGY_CONFIGS,
  type AnalysisResult,
  type AnalyzeRequest,
  type InventoryRecord,
  type RejectedTransfer,
  type StoreMetrics,
  type TransferSimulation,
  type TransferSuggestion,
} from '@retailflow/shared';
import { resolveProductIdentity } from '@retailflow/shared';
import { checkTransferConditions, computeStr, computeStrBasedTransfer } from './strCalculator.js';

interface StoreProductAggregate extends InventoryRecord {
  productKey: string;
  strRate: number;
}

interface AnalysisCollections {
  transfers: TransferSuggestion[];
  rejectedTransfers: RejectedTransfer[];
}

export function runTransferAnalysis(records: InventoryRecord[], request: AnalyzeRequest, storeMetrics: StoreMetrics[]): AnalysisResult {
  const startedAt = Date.now();
  const prioritySources = new Set(request.prioritySources?.length ? request.prioritySources : Array.from(DEFAULT_PRIORITY_SOURCES));
  const excludedStores = request.excludedStores ?? [];
  const excluded = new Set(excludedStores);
  const allProductGroups = buildProductGroups(records);

  let transfers: TransferSuggestion[] = [];
  let rejectedTransfers: RejectedTransfer[] = [];

  if (request.transferType === 'targeted') {
    if (request.targetStore == null) {
      throw new Error('Hedefli analiz için hedef mağaza gerekli');
    }

    transfers = runTargetedAnalysis(allProductGroups, request.targetStore, request, prioritySources, excluded);
  } else if (request.transferType === 'size_completion') {
    if (request.targetStore == null) {
      throw new Error('Beden tamamlama için hedef mağaza gerekli');
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
    strategyConfig: STRATEGY_CONFIGS[request.strategy],
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
  const averageStrImprovement = transfers.length === 0
    ? 0
    : transfers.reduce((sum, transfer) => sum + transfer.strDiff, 0) / transfers.length;
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
    averageStrImprovement: Number(averageStrImprovement.toFixed(2)),
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
  const strategyConfig = STRATEGY_CONFIGS[request.strategy];

  for (const [productKey, stores] of productGroups.entries()) {
    if (stores.length < 2) {
      continue;
    }

    const sortedByStr = [...stores].sort((left, right) => left.strRate - right.strRate);
    const receiver = sortedByStr[sortedByStr.length - 1];
    const sender = pickGlobalSender(sortedByStr, prioritySources);

    const eligibility = checkTransferConditions(
      sender.salesQty,
      sender.inventory,
      receiver.salesQty,
      receiver.inventory,
      strategyConfig,
    );

    if (!eligibility.eligible) {
      const averageStr = sortedByStr.reduce((sum, store) => sum + store.strRate, 0) / sortedByStr.length;
      const strDiff = receiver.strRate - sortedByStr[0].strRate;

      rejectedTransfers.push({
        productKey,
        productName: receiver.productName,
        color: receiver.color,
        size: receiver.size,
        storeCount: sortedByStr.length,
        averageStr: Number((averageStr * 100).toFixed(1)),
        strDiff: Number((strDiff * 100).toFixed(1)),
        reason: eligibility.reason,
      });
      continue;
    }

    const transfer = computeStrBasedTransfer(
      sender.salesQty,
      sender.inventory,
      receiver.salesQty,
      receiver.inventory,
      strategyConfig,
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
      strDiff: toPercent(transfer.strDiff),
      theoreticalTransfer: transfer.theoreticalTransfer,
      appliedFilter: transfer.appliedFilter,
      strategy: request.strategy,
      transferType: request.transferType,
      isPrioritySource: prioritySources.has(sender.warehouseName),
      stockStatus: stockStatusFromPercent(toPercent(transfer.receiverStr)),
      storeCount: sortedByStr.length,
      minStr: toPercent(sortedByStr[0].strRate),
      maxStr: toPercent(receiver.strRate),
      salesDiff: receiver.salesQty - sender.salesQty,
      inventoryDiff: sender.inventory - receiver.inventory,
    });
  }

  transfers.sort(comparePriorityThenStr);
  rejectedTransfers.sort((left, right) => right.strDiff - left.strDiff);

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
  const strategyConfig = STRATEGY_CONFIGS[request.strategy];
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
        && store.inventory >= 2
      ))
      .sort((left, right) => right.inventory - left.inventory || left.warehouseName.localeCompare(right.warehouseName, 'tr'));

    for (const warehouseCandidate of warehouseCandidates) {
      const transfer = computeStrBasedTransfer(
        warehouseCandidate.salesQty,
        warehouseCandidate.inventory,
        targetProduct.salesQty,
        targetProduct.inventory,
        strategyConfig,
      );

      if (transfer.quantity <= 0) {
        continue;
      }

      bestTransfer = buildTransferSuggestion(
        warehouseCandidate,
        targetProduct,
        transfer,
        request,
        true,
      );
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
      );

      if (!eligibility.eligible) {
        continue;
      }

      const transfer = computeStrBasedTransfer(
        donorCandidate.salesQty,
        donorCandidate.inventory,
        targetProduct.salesQty,
        targetProduct.inventory,
        strategyConfig,
      );

      if (transfer.quantity <= 0) {
        continue;
      }

      const priorityScore = toPercent(transfer.strDiff) + Math.min(donorCandidate.inventory / 10, 50);
      if (priorityScore <= bestPriorityScore) {
        continue;
      }

      bestPriorityScore = priorityScore;
      bestTransfer = buildTransferSuggestion(
        donorCandidate,
        targetProduct,
        transfer,
        request,
        false,
      );
    }

    if (bestTransfer !== null) {
      transfers.push(bestTransfer);
    }
  }

  transfers.sort(comparePriorityThenStr);
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
      .sort((left, right) => right.inventory - left.inventory || left.warehouseName.localeCompare(right.warehouseName, 'tr'))[0];

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
      receiverStr: toPercent(computeStr(targetProduct.salesQty, targetProduct.inventory)),
      strDiff: toPercent(computeStr(targetProduct.salesQty, targetProduct.inventory) - computeStr(sender.salesQty, sender.inventory)),
      appliedFilter: 'Beden tamamlama',
      strategy: request.strategy,
      transferType: request.transferType,
      isPrioritySource: prioritySources.has(sender.warehouseName),
      storeCount: stores.length,
    });
  }

  transfers.sort((left, right) => {
    if (left.isPrioritySource !== right.isPrioritySource) {
      return left.isPrioritySource ? -1 : 1;
    }

    return left.productKey.localeCompare(right.productKey, 'tr');
  });

  return transfers;
}

function buildTransferSuggestion(
  sender: StoreProductAggregate,
  receiver: StoreProductAggregate,
  transfer: ReturnType<typeof computeStrBasedTransfer>,
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
    strDiff: toPercent(transfer.strDiff),
    theoreticalTransfer: transfer.theoreticalTransfer,
    appliedFilter: transfer.appliedFilter,
    strategy: request.strategy,
    transferType: request.transferType,
    isPrioritySource,
    storeCount: (request.transferType === 'targeted' ? undefined : undefined),
  };
}

function buildProductGroups(records: InventoryRecord[]): Map<string, StoreProductAggregate[]> {
  const groupedByProduct = new Map<string, Map<string, StoreProductAggregate>>();

  for (const record of records) {
    const productKey = resolveProductIdentity(record);
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
    .sort((left, right) => right.inventory - left.inventory || left.warehouseName.localeCompare(right.warehouseName, 'tr'));

  if (warehouseCandidatesGe2.length > 0) {
    return warehouseCandidatesGe2[0];
  }

  const warehouseCandidatesEq1 = stores
    .filter((store) => prioritySources.has(store.warehouseName) && store.inventory === 1)
    .sort((left, right) => left.warehouseName.localeCompare(right.warehouseName, 'tr'));

  if (warehouseCandidatesEq1.length > 0) {
    return warehouseCandidatesEq1[0];
  }

  return stores[0];
}

function comparePriorityThenStr(left: TransferSuggestion, right: TransferSuggestion): number {
  if (left.isPrioritySource !== right.isPrioritySource) {
    return left.isPrioritySource ? -1 : 1;
  }

  if (right.strDiff !== left.strDiff) {
    return right.strDiff - left.strDiff;
  }

  return left.productKey.localeCompare(right.productKey, 'tr');
}

function stockStatusFromPercent(receiverStr: number): TransferSuggestion['stockStatus'] {
  if (receiverStr >= 80) {
    return 'YUKSEK';
  }
  if (receiverStr >= 50) {
    return 'NORMAL';
  }
  if (receiverStr >= 20) {
    return 'DUSUK';
  }
  return 'KRITIK';
}

function toPercent(value: number): number {
  return Number((value * 100).toFixed(1));
}
