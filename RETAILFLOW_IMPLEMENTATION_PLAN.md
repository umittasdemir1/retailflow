# RetailFlow — Sıfırdan Kurulum & Implementation Plan

## Proje Tanımı

RetailFlow: Perakende tekstil mağazaları arası stok transfer optimizasyon sistemi. Mevcut `app.py` (Flask, 1644 satır) prototipinin production-grade, modüler, SaaS-ready versiyonu.

**Geliştirme Kısıtları:**
- Supabase, VPS, dış bağlantılar bu aşamada YOK
- Mevcut Render profili üzerinden deploy
- MVP-ready: Auth, DB, multi-tenant sonra basit adımlarla eklenebilir yapı

---

## 1. Teknoloji Stack

### Backend
| Teknoloji | Versiyon | Amaç |
|-----------|---------|------|
| **Node.js** | 20+ | Runtime |
| **TypeScript** | 5.x | Type safety |
| **Express** | 4.x | HTTP framework |
| **multer** | 1.x | File upload (disk storage) |
| **xlsx** (SheetJS) | 0.18+ | Excel okuma/yazma |
| **exceljs** | 4.x | Formatlı Excel export (header styling, renkler) |
| **cors** | 2.x | CORS yönetimi |
| **dotenv** | 16.x | Environment variables |
| **tsx** | 4.x | Dev runner (ts-node alternatifi) |
| **vitest** | 1.x | Unit test |

### Frontend
| Teknoloji | Versiyon | Amaç |
|-----------|---------|------|
| **React** | 18.x | UI framework |
| **TypeScript** | 5.x | Type safety |
| **Vite** | 5.x | Build tool & dev server |
| **Tailwind CSS** | 3.x | Styling |
| **shadcn/ui** | latest | UI component library |
| **Lucide React** | latest | Icon library |
| **Axios** | 1.x | HTTP client |
| **React Query (TanStack)** | 5.x | Server state management |
| **Recharts** | 2.x | Chart/grafik (STR dashboard) |
| **TanStack Table** | 8.x | Büyük veri tabloları (virtual scroll) |

### Shared
| Teknoloji | Amaç |
|-----------|------|
| **TypeScript interfaces** | Backend-frontend arası paylaşılan type'lar |

---

## 2. Proje Yapısı

```
retailflow/
├── package.json                    # Root workspace config
├── tsconfig.base.json              # Paylaşılan TS config
├── .env.example                    # Environment template
├── .gitignore
├── render.yaml                     # Render deploy config
│
├── shared/                         # Paylaşılan types & utils
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── types.ts                # Tüm shared type/interface tanımları
│   │   ├── constants.ts            # Strategy configs, sabitler
│   │   └── normalization.ts        # parseLocaleNumber, toText, resolveProductIdentity
│   └── index.ts                    # Barrel export
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── Dockerfile                  # Render/Docker deploy
│   ├── src/
│   │   ├── index.ts                # Express app entry point
│   │   ├── config.ts               # Environment config (dotenv)
│   │   │
│   │   ├── routes/
│   │   │   ├── health.ts           # GET  /api/health
│   │   │   ├── upload.ts           # POST /api/upload
│   │   │   ├── stores.ts           # GET  /api/stores
│   │   │   ├── strategies.ts       # GET  /api/strategies
│   │   │   ├── analyze.ts          # POST /api/analyze
│   │   │   ├── export.ts           # POST /api/export/excel
│   │   │   ├── simulate.ts         # POST /api/simulate
│   │   │   └── data.ts             # DELETE /api/data (clear)
│   │   │
│   │   ├── usecases/
│   │   │   ├── processUpload.ts        # Excel parse + validate + store metrics
│   │   │   ├── runAnalysis.ts          # Strateji dispatch (global/targeted/size_completion)
│   │   │   ├── exportAnalysis.ts       # Analiz → formatlı Excel
│   │   │   └── simulateTransfers.ts    # Transfer impact simülasyonu
│   │   │
│   │   ├── services/
│   │   │   ├── excelParser.ts          # CSV/XLSX okuma, kolon eşleştirme, veri temizleme
│   │   │   ├── strCalculator.ts        # STR, cover days, satış hızı hesaplama
│   │   │   ├── transferEngine.ts       # Ana transfer algoritması (global/targeted/size_completion)
│   │   │   ├── storeMetrics.ts         # Mağaza bazlı metrik hesaplama
│   │   │   └── excelExporter.ts        # Formatlı Excel export (exceljs)
│   │   │
│   │   ├── store/
│   │   │   └── sessionStore.ts         # In-memory session store (parsed data, analiz sonuçları)
│   │   │                               # MVP: RAM'de tutar (app.py gibi)
│   │   │                               # Sonra: Supabase'e geçiş için interface hazır
│   │   │
│   │   └── utils/
│   │       └── validators.ts           # Request validation helpers
│   │
│   └── tests/
│       ├── strCalculator.test.ts
│       ├── transferEngine.test.ts
│       └── excelParser.test.ts
│
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── index.html
    ├── public/
    │   └── favicon.svg
    │
    └── src/
        ├── main.tsx                    # React entry point
        ├── App.tsx                     # Router / layout
        ├── index.css                   # Tailwind directives
        │
        ├── lib/
        │   ├── api.ts                  # Axios instance + API fonksiyonları
        │   └── utils.ts               # cn(), formatNumber(), vb.
        │
        ├── hooks/
        │   ├── useUpload.ts            # Upload mutation (React Query)
        │   ├── useAnalysis.ts          # Analiz mutation & state
        │   ├── useStores.ts            # Mağaza listesi query
        │   └── useExport.ts            # Excel export mutation
        │
        ├── components/
        │   ├── ui/                     # shadcn/ui bileşenleri (button, card, badge, select, vb.)
        │   ├── layout/
        │   │   ├── AppShell.tsx         # Ana layout (sidebar + content)
        │   │   ├── Sidebar.tsx          # Sol navigasyon
        │   │   └── Header.tsx           # Üst bar
        │   │
        │   ├── upload/
        │   │   └── UploadZone.tsx       # Drag & drop Excel yükleme
        │   │
        │   ├── dashboard/
        │   │   ├── OverviewCards.tsx     # Toplam KPI kartları
        │   │   ├── StoreMetricsTable.tsx # Mağaza bazlı metrikler
        │   │   └── StrChart.tsx         # STR dağılım grafiği (Recharts)
        │   │
        │   ├── analysis/
        │   │   ├── StrategySelector.tsx  # 3 strateji kartı (sakin/kontrollu/agresif)
        │   │   ├── TransferTypeSelector.tsx # Global/Targeted/Size Completion
        │   │   ├── StoreSelector.tsx     # Hedef mağaza + excluded stores
        │   │   └── AnalysisControls.tsx  # Tüm kontrolleri birleştiren wrapper
        │   │
        │   ├── results/
        │   │   ├── TransferTable.tsx     # Ana sonuç tablosu (TanStack Table)
        │   │   ├── TransferSummary.tsx   # Analiz özeti kartı
        │   │   ├── SimulationPanel.tsx   # Transfer impact preview
        │   │   └── ExportButton.tsx      # Excel indirme butonu
        │   │
        │   └── stores/
        │       ├── StoreCard.tsx         # Tek mağaza metrik kartı
        │       └── PrioritySourceBadge.tsx # Merkez/Online badge
        │
        ├── pages/
        │   ├── DashboardPage.tsx        # Upload + genel bakış
        │   ├── AnalyzePage.tsx          # Analiz parametreleri + sonuçlar
        │   └── SettingsPage.tsx         # Strateji özelleştirme (gelecek)
        │
        └── types/
            └── index.ts                 # Frontend-specific types + shared re-exports
```

---

## 3. Shared Types (`shared/src/types.ts`)

```typescript
// ==================== STRATEGY ====================

export type RetailFlowStrategy = "sakin" | "kontrollu" | "agresif";
export type TransferType = "global" | "targeted" | "size_completion";

export interface StrategyConfig {
  name: RetailFlowStrategy;
  label: string;
  description: string;
  // v1 params (app.py uyumlu)
  minStrDiff: number;         // 0.15 / 0.10 / 0.08
  minInventory: number;       // 3 / 2 / 1
  maxTransfer: number | null; // 5 / 10 / null (sınırsız)
  // v2 params (yeni)
  targetCoverDays: number;    // 14 / 10 / 7
  minCoverDays: number;       // 7 / 5 / 3
  maxTransferPct: number;     // 0.25 / 0.40 / 0.60
}

// ==================== DATA RECORDS ====================

export interface InventoryRecord {
  warehouseName: string;
  productCode: string;
  productName: string;
  color: string;
  size: string;
  salesQty: number;
  inventory: number;
  // Opsiyonel alanlar
  returnQty?: number;
  gender?: string;
  productionYear?: number | null;
  lastSaleDate?: string | null;
  firstStockEntryDate?: string | null;
  firstSaleDate?: string | null;
}

export interface ProductVariantKey {
  productName: string;
  color: string;
  size: string;
}

// ==================== STORE METRICS ====================

export interface StoreMetrics {
  name: string;
  totalSales: number;
  totalInventory: number;
  strRate: number;              // 0-1 arası
  strPercent: number;           // 0-100 arası (display)
  productCount: number;
  excessInventory: number;
  coverDays: number | null;
  isPrioritySource: boolean;
}

// ==================== TRANSFER RESULTS ====================

export interface TransferSuggestion {
  productKey: string;           // "URUN ADI RENK BEDEN"
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
  senderStr: number;            // 0-100
  receiverStr: number;          // 0-100
  strDiff: number;              // 0-100
  appliedFilter: string;        // "Teorik" | "Max %40" | "Min X kalsın" | ...
  strategy: RetailFlowStrategy;
  transferType: TransferType;
  isPrioritySource: boolean;
  coverDaysAfter?: number | null;
  // Global analiz için ekstra
  stockStatus?: "KRITIK" | "DUSUK" | "NORMAL" | "YUKSEK";
  storeCount?: number;
}

export interface RejectedTransfer {
  productKey: string;
  productName: string;
  color: string;
  size: string;
  storeCount: number;
  averageStr: number;
  strDiff: number;
  reason: string;
}

// ==================== ANALYSIS RESULT ====================

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

export interface TransferSimulation {
  totalTransfers: number;
  totalItemsMoved: number;
  affectedStores: number;
  averageStrImprovement: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  priorityTransfers: number;
}

export interface PerformanceMetrics {
  processingTimeMs: number;
  totalProducts: number;
  totalStores: number;
  totalRows: number;
}

// ==================== UPLOAD ====================

export interface UploadResult {
  success: boolean;
  fileName: string;
  rowCount: number;
  storeCount: number;
  stores: string[];
  columns: string[];
}

// ==================== API REQUEST/RESPONSE ====================

export interface AnalyzeRequest {
  strategy: RetailFlowStrategy;
  transferType: TransferType;
  targetStore?: string;
  excludedStores?: string[];
  prioritySources?: string[];
  // v2 opsiyonel parametre override
  analysisDays?: number;       // Satış hızı hesaplama periyodu
}

export interface ExportRequest {
  strategy: RetailFlowStrategy;
  transferType: TransferType;
  targetStore?: string;
  excludedStores?: string[];
  prioritySources?: string[];
}
```

---

## 4. Strategy Sabitleri (`shared/src/constants.ts`)

```typescript
import type { StrategyConfig, RetailFlowStrategy } from "./types";

export const STRATEGY_CONFIGS: Record<RetailFlowStrategy, StrategyConfig> = {
  sakin: {
    name: "sakin",
    label: "Sakin",
    description: "Güvenli ve kontrollü transfer yaklaşımı",
    minStrDiff: 0.15,
    minInventory: 3,
    maxTransfer: 5,
    targetCoverDays: 14,
    minCoverDays: 7,
    maxTransferPct: 0.25,
  },
  kontrollu: {
    name: "kontrollu",
    label: "Kontrollü",
    description: "Dengeli risk ve performans",
    minStrDiff: 0.10,
    minInventory: 2,
    maxTransfer: 10,
    targetCoverDays: 10,
    minCoverDays: 5,
    maxTransferPct: 0.40,
  },
  agresif: {
    name: "agresif",
    label: "Agresif",
    description: "Maksimum performans odaklı",
    minStrDiff: 0.08,
    minInventory: 1,
    maxTransfer: null,
    targetCoverDays: 7,
    minCoverDays: 3,
    maxTransferPct: 0.60,
  },
};

export const DEFAULT_PRIORITY_SOURCES = new Set(["Merkez Depo", "Online"]);
export const DEFAULT_STRATEGY: RetailFlowStrategy = "sakin";
export const MAX_FILE_SIZE_MB = 100;
export const MAX_ROW_COUNT = 1_000_000;
```

---

## 5. Backend Detaylı Tasarım

### 5.1 Entry Point (`backend/src/index.ts`)

```
Express app:
  - CORS: tüm originler (dev), CORS_ORIGIN env (prod)
  - JSON limit: 50mb
  - File upload: multer disk storage, max 100MB
  - Timeout: 120 saniye (büyük dataset analizi için)

Routes:
  GET  /api/health          → health.ts
  POST /api/upload           → upload.ts     (multer middleware)
  GET  /api/stores           → stores.ts
  GET  /api/strategies       → strategies.ts
  POST /api/analyze          → analyze.ts
  POST /api/export/excel     → export.ts
  POST /api/simulate         → simulate.ts
  DELETE /api/data           → data.ts       (clear all)
```

### 5.2 Session Store (`backend/src/store/sessionStore.ts`)

MVP'de `app.py`'deki global singleton pattern'ı koruyoruz ama interface arkasına saklıyoruz:

```typescript
interface SessionData {
  data: InventoryRecord[] | null;
  stores: string[];
  currentAnalysis: AnalysisResult | null;
  storeMetrics: StoreMetrics[];
  uploadInfo: UploadResult | null;
}

// Singleton instance
// SaaS geçişte bu interface Supabase-backed implementasyona swap edilir
```

### 5.3 Excel Parser (`backend/src/services/excelParser.ts`)

`app.py`'den port edilecek + StockPilot parser'ından encoding detection:

```
parseExcelBuffer(buffer, fileName) → { records: InventoryRecord[], stores: string[], columns: string[] }

İşlem sırası:
1. Format detect (csv/xlsx/xls)
2. Encoding detect (UTF-8, Windows-1254)
3. Kolon mapping (Türkçe → ASCII):
   - "Depo Adı" → warehouseName
   - "Ürün Kodu" → productCode
   - "Ürün Adı" → productName
   - "Renk Açıklaması" → color
   - "Beden" → size
   - "Satış" → salesQty
   - "Envanter" → inventory
4. Veri temizleme (numeric coerce, NaN→0, negative→0)
5. Gerekli sütun kontrolü
6. Product key oluşturma (vectorized string concat)
```

### 5.4 STR Calculator (`backend/src/services/strCalculator.ts`)

```
computeStr(sales, inventory) → number
  = sales / (sales + inventory), 0 if both 0

computeCoverDays(inventory, salesVelocity) → number | null
  = inventory / salesVelocity, null if velocity 0

computeSalesVelocity(totalSales, analysisDays) → number
  = totalSales / analysisDays

computeStrBasedTransfer(sender, receiver, config) → { quantity, details }
  STR fark kontrolü → maxTransferPct cap → min_inventory → max_transfer
  "ZORUNLU MIN 1 KALDIRILDI" — formül 0 derse 0 döner

checkTransferConditions(sender, receiver, config) → { eligible, reason }
  min envanter + min STR fark kontrolü
```

### 5.5 Transfer Engine (`backend/src/services/transferEngine.ts`)

`app.py`'deki 3 analiz modunun TypeScript portu. **Map-based grouping** kullanır:

#### Global Analiz (`runGlobalAnalysis`)
```
1. Records'ları Map<productKey, StoreData[]> olarak grupla
2. Her ürün grubu için:
   a. Mağaza bazlı STR hesapla
   b. En yüksek STR'li mağaza = alıcı
   c. Gönderici seçimi:
      - Önce priority sources (Merkez/Online) — en yüksek envanterli
      - Sonra diğer mağazalar — en düşük STR'li
   d. Transfer koşullarını kontrol et
   e. Transfer miktarı hesapla
   f. Sonucu transfers[] veya rejectedTransfers[]'a ekle
3. Transfers'ı sırala: öncelikli kaynaklar önce, sonra STR farkı
```

#### Targeted Analiz (`runTargetedAnalysis`)
```
1. Hedef mağazadaki tüm ürünleri listele
2. Her ürün için:
   a. Priority sources'tan arama (envanter ≥ 2)
   b. Bulunamazsa diğer mağazalardan en iyi donör
   c. Transfer hesapla
3. STR farkına göre sırala
```

#### Size Completion (`runSizeCompletionAnalysis`)
```
1. Hedef mağazada envanter=0 olan ürünleri bul
2. Her eksik ürün için:
   a. Aynı product key'e sahip diğer mağazalarda envanter ara
   b. Priority sources öncelikli
   c. Transfer = 1 adet (beden tamamlama)
3. Sonuçları sırala
```

### 5.6 Store Metrics (`backend/src/services/storeMetrics.ts`)

```
computeStoreMetrics(records, prioritySources) → StoreMetrics[]

Map-based grouping:
  Map<storeName, { totalSales, totalInventory, productCount }>

Her mağaza için:
  - strRate = totalSales / (totalSales + totalInventory)
  - excessInventory = totalInventory - totalSales
  - coverDays = computeCoverDays(...)
  - isPrioritySource = prioritySources.has(name)
```

### 5.7 Excel Exporter (`backend/src/services/excelExporter.ts`)

`exceljs` kullanarak `app.py`'deki formatlı export'un portu:

```
buildExcelReport(result: AnalysisResult) → Buffer

Sheet 1: "Transfer Önerileri" (veya analiz tipine göre isim)
  - Header: koyu mavi arka plan, beyaz bold font, 14pt
  - Data: 11pt, ince border
  - Auto-width sütunlar
  - Sütunlar: Ürün Kodu, Ürün Adı, Renk, Beden, Gönderen, Alan,
              Transfer Miktarı, STR Farkı, Gönderen STR, Alan STR

Sheet 2: "Analiz Özeti"
  - Analiz tipi, strateji, hedef mağaza, tarih, excluded mağazalar

Sheet 3: "Mağaza Metrikleri"
  - Mağaza bazlı: satış, envanter, STR%, cover days

Sheet 4: "Performans" (opsiyonel)
  - İşlem süresi, bellek kullanımı, cache stats
```

### 5.8 Route → Usecase → Service Akışı

```
POST /api/upload
  → multer (file)
  → processUpload usecase
    → excelParser.parseExcelBuffer()
    → storeMetrics.computeStoreMetrics()
    → sessionStore.save()
  → Response: UploadResult

POST /api/analyze
  → validate AnalyzeRequest body
  → runAnalysis usecase
    → sessionStore.getData()
    → transferEngine.runGlobalAnalysis() / runTargetedAnalysis() / runSizeCompletionAnalysis()
    → simulateTransfers.simulateTransferImpact()
    → sessionStore.saveAnalysis()
  → Response: AnalysisResult (transferler ilk 50, toplam sayı ayrı)

POST /api/export/excel
  → validate ExportRequest body
  → exportAnalysis usecase
    → sessionStore.getAnalysis() (veya yeniden analiz çalıştır)
    → excelExporter.buildExcelReport()
  → Response: Binary XLSX (Content-Disposition: attachment)

GET /api/stores
  → sessionStore.getStoreMetrics()
  → Response: StoreMetrics[]

GET /api/strategies
  → STRATEGY_CONFIGS constant
  → Response: StrategyConfig[]

POST /api/simulate
  → sessionStore.getAnalysis()
  → simulateTransfers.simulateTransferImpact()
  → Response: TransferSimulation

DELETE /api/data
  → sessionStore.clear()
  → Response: { success: true }
```

---

## 6. Frontend Detaylı Tasarım

### 6.1 Sayfa Akışı

```
DashboardPage (Ana sayfa)
├── UploadZone — Drag & drop Excel yükleme
├── OverviewCards — Toplam satır, mağaza, ürün sayısı
├── StoreMetricsTable — Mağaza bazlı STR, envanter, satış
└── StrChart — Recharts bar chart (mağaza STR dağılımı)

AnalyzePage (Analiz & Sonuçlar)
├── AnalysisControls
│   ├── StrategySelector — 3 kart (sakin/kontrollu/agresif)
│   ├── TransferTypeSelector — 3 toggle (global/targeted/size_completion)
│   ├── StoreSelector — Hedef mağaza dropdown + excluded stores pills
│   └── [Analiz Başlat] butonu
│
├── TransferSummary — Toplam transfer, risk, STR iyileştirme
├── SimulationPanel — Transfer impact preview
├── TransferTable — TanStack Table ile sonuçlar (sortable, filterable)
└── ExportButton — Excel indirme

SettingsPage (Gelecek - v2)
└── Strateji parametreleri özelleştirme
```

### 6.2 Component Detayları

#### UploadZone
- Drag & drop alanı + dosya seçim butonu
- Desteklenen formatlar: .xlsx, .xls, .csv
- Upload progress bar (0-100%)
- Dosya bilgisi gösterimi (ad, satır sayısı, mağaza sayısı)
- "Dosyayı Kaldır" butonu

#### StrategySelector
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   🟢 Sakin   │ │ 🟡 Kontrollü │ │  🔴 Agresif  │
│             │ │             │ │             │
│ Min STR: 15%│ │ Min STR: 10%│ │ Min STR: 8% │
│ Min Stok: 3 │ │ Min Stok: 2 │ │ Min Stok: 1 │
│ Max Tr: 5   │ │ Max Tr: 10  │ │ Max Tr: ∞   │
│ Cover: 14gün│ │ Cover: 10gün│ │ Cover: 7gün │
└─────────────┘ └─────────────┘ └─────────────┘
```

#### TransferTable (TanStack Table)
Sütunlar:
| Sütun | Açıklama |
|-------|----------|
| Ürün Kodu | Product code |
| Ürün Adı | Product name |
| Renk | Color |
| Beden | Size |
| Gönderen Mağaza | Sender store |
| G. Satış | Sender sales |
| G. Envanter | Sender inventory |
| G. STR % | Sender STR |
| Alan Mağaza | Receiver store |
| A. Satış | Receiver sales |
| A. Envanter | Receiver inventory |
| A. STR % | Receiver STR |
| STR Farkı % | STR difference |
| Transfer Miktarı | Transfer quantity |
| Öncelikli | Priority source badge |

Özellikler:
- Column sorting (tıkla → asc/desc)
- Search/filter
- Virtual scroll (büyük dataset)
- Row count gösterimi

#### StoreMetricsTable
| Mağaza | Satış | Envanter | STR % | Ürün Sayısı | Cover Days | Tip |
|--------|-------|----------|-------|-------------|------------|-----|
| Merkez | 5,230 | 12,450   | 29.6% | 1,234       | 45         | 🏭  |
| İstanbul| 3,120 | 4,560   | 40.6% | 890         | 22         | 🏪  |

---

## 7. Kurulum Adımları

### 7.1 Proje İskeleti Oluşturma

```bash
# 1. Root proje
mkdir retailflow && cd retailflow
npm init -y
# package.json'a workspaces ekle: ["shared", "backend", "frontend"]

# 2. Shared package
mkdir -p shared/src
cd shared && npm init -y

# 3. Backend package
mkdir -p backend/src/{routes,usecases,services,store,utils}
mkdir -p backend/tests
cd backend && npm init -y

# 4. Frontend package (Vite + React + TS)
npm create vite@latest frontend -- --template react-ts
cd frontend
# Tailwind, shadcn/ui, vb. kurulumu
```

### 7.2 Backend Dependencies

```bash
cd backend
npm install express cors multer dotenv xlsx exceljs
npm install -D typescript @types/express @types/cors @types/multer tsx vitest
```

### 7.3 Frontend Dependencies

```bash
cd frontend
npm install axios @tanstack/react-query @tanstack/react-table recharts lucide-react
npm install -D tailwindcss postcss autoprefixer @types/node

# shadcn/ui kurulumu
npx shadcn@latest init
npx shadcn@latest add button card badge select tabs input label separator
npx shadcn@latest add dropdown-menu sheet dialog progress tooltip
```

### 7.4 TypeScript Config

```jsonc
// tsconfig.base.json (root)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### 7.5 Dev Scripts

```jsonc
// backend/package.json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}

// frontend/package.json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

### 7.6 Vite Proxy Config

```typescript
// frontend/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
```

---

## 8. Render Deploy Yapılandırması

### 8.1 render.yaml

```yaml
services:
  - type: web
    name: retailflow-api
    runtime: node
    buildCommand: cd backend && npm ci && npm run build
    startCommand: cd backend && npm start
    envVars:
      - key: PORT
        value: 8787
      - key: CORS_ORIGIN
        sync: false
      - key: NODE_ENV
        value: production

  - type: static
    name: retailflow-frontend
    buildCommand: cd frontend && npm ci && npm run build
    staticPublishPath: frontend/dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_API_BASE_URL
        sync: false
```

### 8.2 Environment Variables

```bash
# .env.example
PORT=8787
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development

# Gelecek (SaaS aşaması):
# SUPABASE_URL=
# SUPABASE_SERVICE_KEY=
# JWT_SECRET=
```

---

## 9. SaaS Geçiş Hazırlığı

Mevcut yapı şu adımlarla SaaS'a dönüşür:

### 9.1 Auth Ekleme (1 gün)
1. `npm install @supabase/supabase-js jsonwebtoken`
2. `backend/src/middleware/auth.ts` — JWT doğrulama middleware
3. Route'lara `authMiddleware` ekle
4. Frontend'e login/register sayfaları

### 9.2 Supabase Entegrasyonu (2-3 gün)
1. `sessionStore.ts`'yi Supabase-backed implementasyona swap et
2. Upload edilen dosyaları Supabase Storage'a kaydet
3. Analiz sonuçlarını `analysis_sessions` + `analysis_results` tablolarına yaz
4. RLS policy'leri tanımla

### 9.3 Multi-Tenant (1 gün)
1. `backend/src/middleware/tenant.ts` — company_id çözümleme
2. Tüm DB sorgularına tenant filter ekle
3. RLS policy'ler zaten izolasyon sağlar

### 9.4 VPS Geçişi (1 gün)
1. Hetzner CX22 kur (€8.5/ay)
2. Docker Compose ile deploy
3. Nginx reverse proxy + Certbot SSL
4. GitHub Actions CI/CD

---

## 10. Implementation Sırası

### Adım 1: Proje İskeleti (İlk)
- [ ] Root workspace, shared, backend, frontend klasörleri
- [ ] package.json'lar ve dependency kurulumu
- [ ] TypeScript config'leri
- [ ] .env.example, .gitignore
- [ ] Vite proxy config

### Adım 2: Shared Types & Constants
- [ ] `shared/src/types.ts` — tüm interface'ler
- [ ] `shared/src/constants.ts` — strategy configs
- [ ] `shared/src/normalization.ts` — parse helpers

### Adım 3: Backend Core Services
- [ ] `excelParser.ts` — CSV/XLSX okuma + kolon mapping
- [ ] `strCalculator.ts` — STR, cover days hesaplama
- [ ] `storeMetrics.ts` — mağaza metrikleri
- [ ] `transferEngine.ts` — 3 analiz modu
- [ ] `excelExporter.ts` — formatlı XLSX export
- [ ] `sessionStore.ts` — in-memory data store

### Adım 4: Backend Routes & Usecases
- [ ] Usecase'ler (processUpload, runAnalysis, exportAnalysis, simulateTransfers)
- [ ] Route handler'lar (health, upload, stores, strategies, analyze, export, simulate, data)
- [ ] Express app entry point
- [ ] Hata yönetimi

### Adım 5: Backend Tests
- [ ] `strCalculator.test.ts` — STR hesaplama testleri
- [ ] `transferEngine.test.ts` — transfer algoritma testleri
- [ ] `excelParser.test.ts` — kolon mapping testleri

### Adım 6: Frontend Temel Yapı
- [ ] Vite + React + Tailwind + shadcn/ui kurulumu
- [ ] AppShell layout (sidebar + content)
- [ ] API client (axios + React Query)
- [ ] Routing (dashboard, analyze)

### Adım 7: Frontend Upload & Dashboard
- [ ] UploadZone component
- [ ] OverviewCards (KPI)
- [ ] StoreMetricsTable
- [ ] StrChart (Recharts)

### Adım 8: Frontend Analiz & Sonuçlar
- [ ] StrategySelector
- [ ] TransferTypeSelector
- [ ] StoreSelector (hedef + excluded)
- [ ] TransferTable (TanStack Table)
- [ ] TransferSummary
- [ ] SimulationPanel
- [ ] ExportButton

### Adım 9: Render Deploy
- [ ] render.yaml
- [ ] Build & deploy test
- [ ] CORS ayarları

---

## 11. Doğrulama Kontrol Listesi

1. **Backend health:** `curl localhost:8787/api/health` → `{ ok: true, ... }`
2. **Upload:** Excel dosya yükleme → mağaza listesi + satır sayısı dönmeli
3. **Stores:** `GET /api/stores` → mağaza metrikleri (STR, cover days)
4. **Strategies:** `GET /api/strategies` → 3 strateji config
5. **Global analiz:** POST /api/analyze (strategy=sakin, type=global) → transfer önerileri
6. **Targeted analiz:** POST /api/analyze (strategy=kontrollu, type=targeted, target=X) → hedef mağaza transferleri
7. **Size completion:** POST /api/analyze (type=size_completion, target=X) → beden tamamlama
8. **Excel export:** POST /api/export/excel → XLSX dosya (3 sheet, formatlı)
9. **Simulation:** POST /api/simulate → risk seviyesi, STR iyileştirme
10. **Frontend:** Upload → Dashboard → Analiz → Sonuçlar → Export — tam akış
11. **Render deploy:** Her iki servis ayakta, CORS çalışıyor

---

## 12. Kritik app.py → TypeScript Port Notları

| app.py Özelliği | TypeScript Karşılığı | Notlar |
|-----------------|---------------------|--------|
| Global singleton (`sistem = MagazaTransferSistemi()`) | `sessionStore.ts` singleton | Interface arkasında, swap edilebilir |
| Pickle persistence | In-memory (MVP), Supabase (SaaS) | Restart'ta kayıp — kabul edilebilir MVP |
| `lru_cache` STR hesaplama | Map-based memoize veya inline | TS'de küçük fonksiyon, cache gereksiz |
| `optimize_dataframe` (category dtype) | Gereksiz — TS'de native objeler yeterli | Pandas-specific optimizasyon |
| `create_product_key_vectorized` | `Array.map()` ile string concat | Zaten hızlı |
| `for urun in tum_urunler: df[df[...]]` | `Map.get(key)` — O(1) lookup | **10-20x hız kazancı** |
| `openpyxl` styling | `exceljs` styling | Aynı API benzeri |
| `/proc/meminfo` okuma | `process.memoryUsage()` | Node.js native |
| `WAREHOUSE_SET` sabit | `prioritySources` parametresi | Kullanıcı ayarlayabilir |
| Response'da `transferler[:50]` limit | Aynı — sayfalama ile | Frontend'de virtual scroll |
