export type RetailFlowStrategy = 'sakin' | 'kontrollu' | 'agresif' | 'custom';
export type TransferType = 'global' | 'targeted' | 'size_completion';

export interface StrategyConfig {
  name: RetailFlowStrategy;
  label: string;
  description: string;
  /** Source store must have more than this many days of supply remaining after transfer */
  minSourceDOS: number;
  /** Only trigger a transfer if the receiver has fewer than this many days of supply */
  maxReceiverDOS: number;
  /** Hard minimum unit count that must stay at the source after transfer */
  minInventory: number;
  /** Hard cap on units transferred in a single suggestion (null = unlimited) */
  maxTransfer: number | null;
  /** Products with STR below this ratio are treated as dead stock and skipped */
  deadStockStrThreshold: number;
}

export interface InventoryRecord {
  warehouseName: string;
  productCode: string;
  productName: string;
  color: string;
  size: string;
  salesQty: number;
  inventory: number;
  returnQty?: number;
  gender?: string;
  productionYear?: number | null;
  lastSaleDate?: string | null;
  firstStockEntryDate?: string | null;
  firstSaleDate?: string | null;
  itemUrl?: string | null;
  price?: number | null;
  category?: string | null;
}

export interface ProductVariantKey {
  productName: string;
  color: string;
  size: string;
}

export interface StoreMetrics {
  name: string;
  totalSales: number;
  totalInventory: number;
  strRate: number;
  strPercent: number;
  productCount: number;
  excessInventory: number;
  coverDays: number | null;
  isPrioritySource: boolean;
}

export interface TransferSuggestion {
  productKey: string;
  productCode: string;
  productName: string;
  color: string;
  size: string;
  senderStore: string;
  receiverStore: string;
  quantity: number;
  senderSales: number;
  senderInventory: number;
  receiverSales: number;
  receiverInventory: number;
  senderStr: number;
  receiverStr: number;
  senderDOS: number | null;
  receiverDOS: number | null;
  dosDiff: number | null;
  appliedFilter: string;
  strategy: RetailFlowStrategy;
  transferType: TransferType;
  isPrioritySource: boolean;
  coverDaysAfter?: number | null;
  stockStatus?: 'KRITIK' | 'DUSUK' | 'NORMAL' | 'YUKSEK';
  storeCount?: number;
  minStr?: number;
  maxStr?: number;
  salesDiff?: number;
  inventoryDiff?: number;
}

export interface RejectedTransfer {
  productKey: string;
  productName: string;
  color: string;
  size: string;
  storeCount: number;
  averageStr: number;
  dosDiff: number | null;
  reason: string;
}

export interface TransferSimulation {
  totalTransfers: number;
  totalItemsMoved: number;
  affectedStores: number;
  averageDosImprovement: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  priorityTransfers: number;
}

export interface PerformanceMetrics {
  processingTimeMs: number;
  totalProducts: number;
  totalStores: number;
  totalRows: number;
  rejectedTransfers?: number;
  excludedStoresCount?: number;
  memoryUsageStart?: number;
  memoryUsageEnd?: number;
}

export interface AnalysisResult {
  analysisType: TransferType;
  strategy: RetailFlowStrategy;
  strategyConfig: StrategyConfig;
  targetStore: string | null;
  excludedStores: string[];
  transfers: TransferSuggestion[];
  rejectedTransfers: RejectedTransfer[];
  storeMetrics: StoreMetrics[];
  simulation: TransferSimulation;
  performance: PerformanceMetrics;
}

export interface UploadResult {
  success: boolean;
  fileName: string;
  rowCount: number;
  storeCount: number;
  uniqueProductCount: number;
  uniqueColorCount: number;
  stores: string[];
  columns: string[];
}

export interface AnalyzeRequest {
  strategy: RetailFlowStrategy;
  transferType: TransferType;
  targetStore?: string;
  excludedStores?: string[];
  prioritySources?: string[];
  analysisDays?: number;
  includedCategories?: string[];
  groupingMode?: 'name' | 'sku';
  customConfig?: Partial<StrategyConfig>;
}

export interface ExportRequest {
  strategy: RetailFlowStrategy;
  transferType: TransferType;
  targetStore?: string;
  excludedStores?: string[];
  prioritySources?: string[];
}

// ─── Products ────────────────────────────────────────────────────────────────

export interface ProductSummary {
  productCode: string;
  productName: string;
  imageUrl: string | null;
  colors: string[];
  sizes: string[];
  totalInventory: number;
  totalSales: number;
  totalReturns: number;
  str: number;
  strPercent: number;
  storeCount: number;
  variantCount: number;
  seasonCount: number;
  gender: string | null;
  stockStatus: 'KRITIK' | 'DUSUK' | 'NORMAL' | 'YUKSEK';
  price: number | null;
  category: string | null;
}

export interface ProductsResponse {
  products: ProductSummary[];
  stats: {
    totalProducts: number;
    totalSold: number;
    totalReturned: number;
    avgStrPercent: number;
    bestSeller: { productName: string; totalSales: number } | null;
  };
}

// ─── Vision / Visual Recognition ────────────────────────────────────────────

export interface DetectedAttributes {
  dominantColor: string;
  colorHex: string;
  colorTr: string;
}

// ─── Calibration ─────────────────────────────────────────────────────────────

export interface CalibrationRect {
  x: number; y: number; width: number; height: number;
}

export interface CalibrationDot {
  x: number; y: number;
}

export interface StoreCalibration {
  id: string;
  storeName: string;
  imageWidth: number;
  imageHeight: number;
  /** Overall analysis ROI — if null, full image is used */
  roi: CalibrationRect | null;
  /** Individual product slot rectangles */
  slots: CalibrationRect[];
  /** Dot marker positions (one per slot, same index) */
  dots: CalibrationDot[];
  createdAt: string;
  updatedAt: string;
}

/** One location where a catalog product was found in the shelf photo */
export interface FoundLocation {
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number; // 0-100
  /** Calibration dot position — set when calibrated recognition is used */
  dotPosition?: { x: number; y: number };
}

/** Recognition result — one entry per catalog product */
export interface RecognizedProduct {
  catalogProductId: string;
  productCode: string;
  productName: string;
  color: string;
  description: string;
  /** Locations found in the shelf photo, sorted by confidence desc */
  foundAt: FoundLocation[];
  bestConfidence: number; // 0-100, 0 = not found
  found: boolean;
  // Sales data (null if no inventory loaded)
  totalSales:     number | null;
  totalInventory: number | null;
  strPercent:     number | null;
  storeCount:     number | null;
  swimwearSalesQty: number | null;
}

export interface VisionRecognizeResponse {
  imageWidth: number;
  imageHeight: number;
  /** One entry per catalog product */
  recognizedProducts: RecognizedProduct[];
  scannedRegions: number;
  processingTimeMs: number;
  modelVersion: string;
}

// Keep DetectedProduct for backwards-compat shape (used in canvas drawing)
export interface DetectedProduct {
  id: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
  classId: number;
  className: string;
  attributes: DetectedAttributes;
  matches: CatalogMatch[];
}

export interface CatalogMatch {
  catalogProductId: string;
  productCode: string;
  productName: string;
  color: string;
  description: string;
  matchScore: number;
  totalSales:     number | null;
  totalInventory: number | null;
  strPercent:     number | null;
  storeCount:     number | null;
}

export interface VisionStatusResponse {
  ready: boolean;
  modelName: string;
  loadTimeMs: number | null;
}

/** A product in the visual catalog (reference image + metadata) */
export interface CatalogProductPublic {
  id: string;
  productCode: string;
  productName: string;
  color: string;
  description: string;
  imageNames: string[];  // tüm referans görseller (ilki thumbnail olarak kullanılır)
  addedAt: string;
}
