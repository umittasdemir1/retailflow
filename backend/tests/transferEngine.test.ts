import { describe, expect, it } from 'vitest';
import { runTransferAnalysis, simulateTransferImpact } from '../src/services/transferEngine.js';
import type { AnalyzeRequest, InventoryRecord, TransferSuggestion } from '@retailflow/shared';

function buildRequest(overrides: Partial<AnalyzeRequest> = {}): AnalyzeRequest {
  return {
    strategy: 'sakin',
    transferType: 'global',
    ...overrides,
  };
}

describe('transferEngine', () => {
  it('prefers priority sources in global analysis and applies strategy caps', () => {
    const records: InventoryRecord[] = [
      // Merkez Depo: warehouse (0 velocity), 20 inv → DOS = null (infinite)
      { warehouseName: 'Merkez Depo', productCode: 'SKU-1', productName: 'Gomlek', color: 'Mavi', size: 'M', salesQty: 0, inventory: 20 },
      // Ankara: 10 sales / 30 days = 0.333/day, 1 inv → DOS = 3 days (urgent, lowest DOS → receiver)
      { warehouseName: 'Ankara', productCode: 'SKU-1', productName: 'Gomlek', color: 'Mavi', size: 'M', salesQty: 10, inventory: 1 },
      // Izmir: 2 sales / 30 days = 0.067/day, 12 inv → DOS = 180 days (plenty)
      { warehouseName: 'Izmir', productCode: 'SKU-1', productName: 'Gomlek', color: 'Mavi', size: 'M', salesQty: 2, inventory: 12 },
    ];

    const result = runTransferAnalysis(records, buildRequest(), []);

    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toMatchObject({
      senderStore: 'Merkez Depo',
      receiverStore: 'Ankara',
      quantity: 5,
      isPrioritySource: true,
      appliedFilter: 'Maks. 5 adet',
      stockStatus: 'KRITIK', // receiverDOS = 3 days < 3 → KRITIK
    });
  });

  it('uses warehouse inventory first in targeted analysis', () => {
    const records: InventoryRecord[] = [
      // Online (priority source): 1 sale/30d, 6 inv → DOS = 180 days
      { warehouseName: 'Online', productCode: 'SKU-2', productName: 'Pantolon', color: 'Siyah', size: 'L', salesQty: 1, inventory: 6 },
      // Bursa: 0 sales, 30 inv (not priority, not targeted)
      { warehouseName: 'Bursa', productCode: 'SKU-2', productName: 'Pantolon', color: 'Siyah', size: 'L', salesQty: 0, inventory: 30 },
      // Kadikoy (target): 12 sales/30d = 0.4/day, 0 inv → DOS = 0 (critical)
      { warehouseName: 'Kadikoy', productCode: 'SKU-2', productName: 'Pantolon', color: 'Siyah', size: 'L', salesQty: 12, inventory: 0 },
    ];

    const result = runTransferAnalysis(
      records,
      buildRequest({ transferType: 'targeted', targetStore: 'Kadikoy' }),
      [],
    );

    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toMatchObject({
      senderStore: 'Online',
      receiverStore: 'Kadikoy',
      isPrioritySource: true,
      // Online → Kadikoy: equilibrium = (6+0)/0.433 ≈ 13.85d, needed = 13.85*0.4 = 5.54
      // Source protection: 6 - ceil(14 * 1/30) = 6 - 1 = 5; hard floor: 6-3 = 3 → available = 3
      // maxTransfer = 5; quantity = min(5.54, 3, 5) = 3
      quantity: 3,
    });
  });

  it('creates one-unit transfers for size completion and prioritizes warehouses', () => {
    const records: InventoryRecord[] = [
      { warehouseName: 'Merkez Depo', productCode: 'SKU-3', productName: 'Mont', color: 'Haki', size: 'S', salesQty: 0, inventory: 4 },
      { warehouseName: 'Antalya', productCode: 'SKU-3', productName: 'Mont', color: 'Haki', size: 'S', salesQty: 2, inventory: 8 },
      { warehouseName: 'Nisantasi', productCode: 'SKU-3', productName: 'Mont', color: 'Haki', size: 'S', salesQty: 5, inventory: 0 },
    ];

    const result = runTransferAnalysis(
      records,
      buildRequest({ transferType: 'size_completion', targetStore: 'Nisantasi' }),
      [],
    );

    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toMatchObject({
      senderStore: 'Merkez Depo',
      receiverStore: 'Nisantasi',
      quantity: 1,
      isPrioritySource: true,
      appliedFilter: 'Beden tamamlama',
    });
  });

  it('records rejected global transfers when receiver DOS is sufficient', () => {
    const records: InventoryRecord[] = [
      // Adana: 5 sales/30d = 0.167/day, 5 inv → DOS = 30 days
      { warehouseName: 'Adana', productCode: 'SKU-4', productName: 'Tshirt', color: 'Beyaz', size: 'XL', salesQty: 5, inventory: 5 },
      // Mersin: 4 sales/30d = 0.133/day, 6 inv → DOS = 45 days
      { warehouseName: 'Mersin', productCode: 'SKU-4', productName: 'Tshirt', color: 'Beyaz', size: 'XL', salesQty: 4, inventory: 6 },
    ];
    // Receiver (lowest DOS) = Adana (30 days). maxReceiverDOS for sakin = 7. 30 ≥ 7 → reject.

    const result = runTransferAnalysis(records, buildRequest(), []);

    expect(result.transfers).toHaveLength(0);
    expect(result.rejectedTransfers).toHaveLength(1);
    expect(result.rejectedTransfers[0]?.reason).toContain('Alıcı kapama günü yeterli');
  });

  it('simulates risk level from transfer volume mix', () => {
    const base: Pick<TransferSuggestion, 'senderStr' | 'receiverStr' | 'senderDOS' | 'receiverDOS' | 'dosDiff' | 'appliedFilter' | 'strategy' | 'transferType'> = {
      senderStr: 0, receiverStr: 100, senderDOS: 180, receiverDOS: 0, dosDiff: 180,
      appliedFilter: 'Maks. 5 adet', strategy: 'sakin', transferType: 'global',
    };

    const simulation = simulateTransferImpact([
      { ...base, productKey: 'A', productCode: 'A', productName: 'A', color: 'A', size: 'A', senderStore: 'S1', receiverStore: 'R1', quantity: 11, senderSales: 0, senderInventory: 20, receiverSales: 10, receiverInventory: 0, isPrioritySource: true },
      { ...base, productKey: 'B', productCode: 'B', productName: 'B', color: 'B', size: 'B', senderStore: 'S2', receiverStore: 'R2', quantity: 12, senderSales: 0, senderInventory: 20, receiverSales: 10, receiverInventory: 0, isPrioritySource: false },
      { ...base, productKey: 'C', productCode: 'C', productName: 'C', color: 'C', size: 'C', senderStore: 'S3', receiverStore: 'R3', quantity: 1, senderSales: 0, senderInventory: 3, receiverSales: 1, receiverInventory: 0, isPrioritySource: false },
    ]);

    expect(simulation.riskLevel).toBe('HIGH');
    expect(simulation.priorityTransfers).toBe(1);
    expect(simulation.totalTransfers).toBe(3);
  });
});
