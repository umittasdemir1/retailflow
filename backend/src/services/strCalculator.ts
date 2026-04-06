import type { StrategyConfig } from '@retailflow/shared';

export interface TransferComputationDetails {
  quantity: number;
  appliedFilter: string;
  senderStr: number;
  receiverStr: number;
  strDiff: number;
  theoreticalTransfer: number;
}

export function computeStr(sales: number, inventory: number): number {
  const total = sales + inventory;
  if (total <= 0) {
    return 0;
  }

  return sales / total;
}

export function computeSalesVelocity(totalSales: number, analysisDays = 30): number {
  if (analysisDays <= 0) {
    return 0;
  }

  return totalSales / analysisDays;
}

export function computeCoverDays(inventory: number, salesVelocity: number): number | null {
  if (salesVelocity <= 0) {
    return null;
  }

  return inventory / salesVelocity;
}

export function checkTransferConditions(
  senderSales: number,
  senderInventory: number,
  receiverSales: number,
  receiverInventory: number,
  config: StrategyConfig,
): { eligible: boolean; reason: string } {
  if (senderInventory < config.minInventory) {
    return {
      eligible: false,
      reason: `Gonderen envanter yetersiz (${senderInventory} < ${config.minInventory})`,
    };
  }

  const senderStr = computeStr(senderSales, senderInventory);
  const receiverStr = computeStr(receiverSales, receiverInventory);
  const strDiff = receiverStr - senderStr;

  if (strDiff < config.minStrDiff) {
    return {
      eligible: false,
      reason: `STR farki yetersiz (${(strDiff * 100).toFixed(1)}% < ${(config.minStrDiff * 100).toFixed(1)}%)`,
    };
  }

  const transfer = computeStrBasedTransfer(senderSales, senderInventory, receiverSales, receiverInventory, config);
  if (transfer.quantity <= 0) {
    return { eligible: false, reason: 'Transfer miktari hesaplanamadi' };
  }

  return {
    eligible: true,
    reason: `STR: A${(transfer.receiverStr * 100).toFixed(1)}%>G${(transfer.senderStr * 100).toFixed(1)}%, T:${transfer.quantity}`,
  };
}

export function computeStrBasedTransfer(
  senderSales: number,
  senderInventory: number,
  receiverSales: number,
  receiverInventory: number,
  config: StrategyConfig,
): TransferComputationDetails {
  const senderStr = computeStr(senderSales, senderInventory);
  const receiverStr = computeStr(receiverSales, receiverInventory);
  const strDiff = receiverStr - senderStr;
  const theoreticalTransfer = strDiff * senderInventory;
  const maxTransfer40 = senderInventory * 0.4;
  const minRemaining = senderInventory - config.minInventory;

  let rawQuantity = theoreticalTransfer;
  let appliedFilter = 'Teorik';

  if (maxTransfer40 < rawQuantity) {
    rawQuantity = maxTransfer40;
    appliedFilter = 'Max %40';
  }

  if (minRemaining < rawQuantity) {
    rawQuantity = minRemaining;
    appliedFilter = `Min ${config.minInventory} kalsin`;
  }

  if (config.maxTransfer != null && config.maxTransfer < rawQuantity) {
    rawQuantity = config.maxTransfer;
    appliedFilter = `Max ${config.maxTransfer} adet`;
  }

  rawQuantity = Math.max(0, Math.min(rawQuantity, senderInventory));

  return {
    quantity: Math.trunc(rawQuantity),
    appliedFilter,
    senderStr,
    receiverStr,
    strDiff,
    theoreticalTransfer: Number(theoreticalTransfer.toFixed(1)),
  };
}
