import { describe, expect, it } from 'vitest';
import { runTransferAnalysis, simulateTransferImpact } from '../src/services/transferEngine.js';
import type { AnalyzeRequest, InventoryRecord } from '@retailflow/shared';

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
      { warehouseName: 'Merkez Depo', productCode: 'SKU-1', productName: 'Gomlek', color: 'Mavi', size: 'M', salesQty: 0, inventory: 20 },
      { warehouseName: 'Ankara', productCode: 'SKU-1', productName: 'Gomlek', color: 'Mavi', size: 'M', salesQty: 10, inventory: 1 },
      { warehouseName: 'Izmir', productCode: 'SKU-1', productName: 'Gomlek', color: 'Mavi', size: 'M', salesQty: 2, inventory: 12 },
    ];

    const result = runTransferAnalysis(records, buildRequest(), []);

    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toMatchObject({
      senderStore: 'Merkez Depo',
      receiverStore: 'Ankara',
      quantity: 5,
      isPrioritySource: true,
      appliedFilter: 'Max 5 adet',
      stockStatus: 'YUKSEK',
    });
  });

  it('uses warehouse inventory first in targeted analysis', () => {
    const records: InventoryRecord[] = [
      { warehouseName: 'Online', productCode: 'SKU-2', productName: 'Pantolon', color: 'Siyah', size: 'L', salesQty: 1, inventory: 6 },
      { warehouseName: 'Bursa', productCode: 'SKU-2', productName: 'Pantolon', color: 'Siyah', size: 'L', salesQty: 0, inventory: 30 },
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
      quantity: 2,
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

  it('records rejected global transfers when STR difference is insufficient', () => {
    const records: InventoryRecord[] = [
      { warehouseName: 'Adana', productCode: 'SKU-4', productName: 'Tshirt', color: 'Beyaz', size: 'XL', salesQty: 5, inventory: 5 },
      { warehouseName: 'Mersin', productCode: 'SKU-4', productName: 'Tshirt', color: 'Beyaz', size: 'XL', salesQty: 4, inventory: 6 },
    ];

    const result = runTransferAnalysis(records, buildRequest(), []);

    expect(result.transfers).toHaveLength(0);
    expect(result.rejectedTransfers).toHaveLength(1);
    expect(result.rejectedTransfers[0]?.reason).toContain('STR farki yetersiz');
  });

  it('simulates risk level from transfer volume mix', () => {
    const simulation = simulateTransferImpact([
      {
        productKey: 'A',
        productCode: 'A',
        productName: 'A',
        color: 'A',
        size: 'A',
        senderStore: 'S1',
        receiverStore: 'R1',
        quantity: 11,
        senderSales: 0,
        senderInventory: 20,
        receiverSales: 10,
        receiverInventory: 0,
        senderStr: 0,
        receiverStr: 100,
        strDiff: 100,
        appliedFilter: 'Max %40',
        strategy: 'sakin',
        transferType: 'global',
        isPrioritySource: true,
      },
      {
        productKey: 'B',
        productCode: 'B',
        productName: 'B',
        color: 'B',
        size: 'B',
        senderStore: 'S2',
        receiverStore: 'R2',
        quantity: 12,
        senderSales: 0,
        senderInventory: 20,
        receiverSales: 10,
        receiverInventory: 0,
        senderStr: 0,
        receiverStr: 100,
        strDiff: 100,
        appliedFilter: 'Max %40',
        strategy: 'sakin',
        transferType: 'global',
        isPrioritySource: false,
      },
      {
        productKey: 'C',
        productCode: 'C',
        productName: 'C',
        color: 'C',
        size: 'C',
        senderStore: 'S3',
        receiverStore: 'R3',
        quantity: 1,
        senderSales: 0,
        senderInventory: 3,
        receiverSales: 1,
        receiverInventory: 0,
        senderStr: 0,
        receiverStr: 100,
        strDiff: 100,
        appliedFilter: 'Teorik',
        strategy: 'sakin',
        transferType: 'global',
        isPrioritySource: false,
      },
    ]);

    expect(simulation.riskLevel).toBe('HIGH');
    expect(simulation.priorityTransfers).toBe(1);
    expect(simulation.totalTransfers).toBe(3);
  });
});
