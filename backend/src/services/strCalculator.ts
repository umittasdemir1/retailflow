import type { StrategyConfig } from '@retailflow/shared';

export interface TransferComputationDetails {
  quantity: number;
  appliedFilter: string;
  senderStr: number;
  receiverStr: number;
  senderDOS: number | null;
  receiverDOS: number | null;
  dosDiff: number | null;
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

export function computeDOS(inventory: number, velocity: number): number | null {
  return computeCoverDays(inventory, velocity);
}

export function checkTransferConditions(
  senderSales: number,
  senderInventory: number,
  receiverSales: number,
  receiverInventory: number,
  config: StrategyConfig,
  analysisDays = 30,
): { eligible: boolean; reason: string } {
  if (senderInventory <= config.minInventory) {
    return {
      eligible: false,
      reason: `Kaynak stok yetersiz (${senderInventory} ≤ ${config.minInventory})`,
    };
  }

  const senderVelocity = computeSalesVelocity(senderSales, analysisDays);
  const senderDOS = computeDOS(senderInventory, senderVelocity);

  // senderDOS null → sender has zero velocity (warehouse/depot) → treat as infinite supply, skip check
  if (senderDOS !== null && senderDOS < config.minSourceDOS) {
    return {
      eligible: false,
      reason: `Kaynak kapama günü yetersiz (${senderDOS.toFixed(1)}g < ${config.minSourceDOS}g)`,
    };
  }

  const receiverVelocity = computeSalesVelocity(receiverSales, analysisDays);
  // inventory=0 with any velocity → completely out of stock → treat as 0 DOS (critical)
  const receiverDOS = receiverInventory === 0
    ? 0
    : computeDOS(receiverInventory, receiverVelocity);

  // receiverDOS null → receiver has stock but no velocity (items aren't selling) → skip transfer
  if (receiverDOS === null || receiverDOS >= config.maxReceiverDOS) {
    const dosLabel = receiverDOS === null ? '∞' : receiverDOS.toFixed(1);
    return {
      eligible: false,
      reason: `Alıcı kapama günü yeterli (${dosLabel}g ≥ ${config.maxReceiverDOS}g)`,
    };
  }

  const transfer = computeDOSBasedTransfer(
    senderSales, senderInventory,
    receiverSales, receiverInventory,
    config, analysisDays,
  );

  if (transfer.quantity <= 0) {
    return { eligible: false, reason: 'Transfer miktarı hesaplanamadı' };
  }

  const senderDOSLabel = senderDOS === null ? '∞' : senderDOS.toFixed(1);
  return {
    eligible: true,
    reason: `Kaynak: ${senderDOSLabel}g → Alıcı: ${receiverDOS.toFixed(1)}g, miktar: ${transfer.quantity}`,
  };
}

export function computeDOSBasedTransfer(
  senderSales: number,
  senderInventory: number,
  receiverSales: number,
  receiverInventory: number,
  config: StrategyConfig,
  analysisDays = 30,
): TransferComputationDetails {
  const senderStr = computeStr(senderSales, senderInventory);
  const receiverStr = computeStr(receiverSales, receiverInventory);

  const senderVelocity = computeSalesVelocity(senderSales, analysisDays);
  const receiverVelocity = computeSalesVelocity(receiverSales, analysisDays);

  const senderDOS = computeDOS(senderInventory, senderVelocity);
  const receiverDOS = receiverInventory === 0
    ? 0
    : (computeDOS(receiverInventory, receiverVelocity) ?? null);

  const dosDiff = senderDOS !== null && receiverDOS !== null
    ? Number((senderDOS - receiverDOS).toFixed(1))
    : null;

  // Theoretical quantity: equilibrate DOS between sender and receiver
  const totalVelocity = senderVelocity + receiverVelocity;
  let theoreticalTransfer: number;
  if (totalVelocity > 0) {
    const equilibriumDOS = (senderInventory + receiverInventory) / totalVelocity;
    theoreticalTransfer = Math.max(0, equilibriumDOS * receiverVelocity - receiverInventory);
  } else {
    // Both stores have zero velocity (e.g., warehouse-to-depot); transfer half the excess
    theoreticalTransfer = Math.max(0, (senderInventory - config.minInventory) / 2);
  }

  let rawQuantity = theoreticalTransfer;
  let appliedFilter = 'Teorik (DOS dengesi)';

  // Source protection: don't drain sender below minSourceDOS
  const sourceProtectionUnits = senderInventory - Math.ceil(config.minSourceDOS * senderVelocity);
  const hardFloorUnits = senderInventory - config.minInventory;
  const availableFromSource = Math.min(sourceProtectionUnits, hardFloorUnits);

  if (availableFromSource < rawQuantity) {
    rawQuantity = availableFromSource;
    appliedFilter = `Kaynak koruma (min ${config.minSourceDOS}g)`;
  }

  if (config.maxTransfer != null && config.maxTransfer < rawQuantity) {
    rawQuantity = config.maxTransfer;
    appliedFilter = `Maks. ${config.maxTransfer} adet`;
  }

  rawQuantity = Math.max(0, Math.min(rawQuantity, senderInventory));

  return {
    quantity: Math.trunc(rawQuantity),
    appliedFilter,
    senderStr,
    receiverStr,
    senderDOS: senderDOS !== null ? Number(senderDOS.toFixed(1)) : null,
    receiverDOS: receiverDOS !== null ? Number(receiverDOS.toFixed(1)) : null,
    dosDiff,
    theoreticalTransfer: Number(theoreticalTransfer.toFixed(1)),
  };
}
