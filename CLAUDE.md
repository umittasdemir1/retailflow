# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is RetailFlow

RetailFlow is a retail textile inventory transfer optimization system. It analyzes store-level sell-through rates (STR) and suggests stock transfers between stores. The original prototype was a 1644-line Flask app (`app.py`) now being rewritten as a production-grade TypeScript monorepo.

## Repository Structure

This is an **npm workspace monorepo** with three packages:

- `shared/` — TypeScript types, constants, and normalization utilities shared between backend and frontend. Must be built before either workspace.
- `backend/` — Express 5 API server (Node.js, TypeScript, ESM)
- `frontend/` — React 19 SPA (Vite, TypeScript, Tailwind CSS 4, shadcn/ui)

## Commands

**Install dependencies (root):**
```bash
npm install
```

**Run backend in dev mode (hot-reload via tsx watch):**
```bash
npm run dev:backend
```

**Run frontend dev server:**
```bash
npm run dev:frontend
```

**Build everything (shared → backend → frontend):**
```bash
npm run build
```

**Run backend tests:**
```bash
npm test
# or from backend workspace:
npm run test --workspace backend
# watch mode:
npm run test:watch --workspace backend
```

**Run a single test file:**
```bash
cd backend && ../node_modules/.bin/vitest run tests/strCalculator.test.ts
```

**Build shared package only (required before backend/frontend builds):**
```bash
npm run build --workspace @retailflow/shared
```

## Architecture

### Data Flow

1. User uploads an Excel/CSV file → `POST /api/upload` → `processUpload` usecase → `excelParser` service parses and normalizes rows into `InventoryRecord[]`, `storeMetrics` are computed via `strCalculator` + `storeMetrics` services, all stored in **in-memory `sessionStore`** (single-server, no persistence).
2. User configures analysis parameters → `POST /api/analyze` → `runAnalysis` usecase → `transferEngine` dispatches to `runGlobalAnalysis`, `runTargetedAnalysis`, or `runSizeCompletionAnalysis` based on `TransferType`.
3. Results can be exported → `POST /api/export/excel` → `exportAnalysis` usecase → `excelExporter` (exceljs) generates a styled Excel file.
4. `POST /api/simulate` runs a what-if simulation on the current analysis without persisting.

### Key Concepts

- **STR (Sell-Through Rate):** `salesQty / (salesQty + inventory)`. The core metric driving transfer decisions.
- **Cover Days:** How many days of sales inventory covers. Used alongside STR in strategy thresholds.
- **Strategies:** Three configs (`sakin` / `kontrollu` / `agresif`) defined in `shared/src/constants.ts` — each controls `minStrDiff`, `minInventory`, `maxTransfer`, `targetCoverDays`, etc.
- **Transfer Types:** `global` (all stores), `targeted` (specific receiver store), `size_completion` (fill missing sizes at a target store).
- **Priority Sources:** Stores (e.g. "MERKEZ", "ONLINE") treated preferentially as transfer sources.
- **sessionStore:** A module-level singleton in `backend/src/store/sessionStore.ts`. Holds parsed data and current analysis in RAM. Designed with a clean interface for future Supabase migration.

### Shared Package

`@retailflow/shared` exports types (`types.ts`), strategy configs (`constants.ts`), and normalization helpers (`normalization.ts`). Both backend and frontend import from this package. **Always build shared first** — backend and frontend depend on its compiled output at `shared/dist/`.

### Backend Route → Usecase → Service Pattern

Routes in `backend/src/routes/` handle HTTP concerns (validation, request parsing) and delegate to usecases in `backend/src/usecases/`. Usecases orchestrate services. Services (`excelParser`, `strCalculator`, `transferEngine`, `storeMetrics`, `excelExporter`) contain the business logic and are pure/testable.

### Frontend State

- React Query manages server state (upload, analyze, export mutations; stores/strategies queries).
- Custom hooks in `frontend/src/hooks/` wrap React Query calls.
- No global client state store — all meaningful state lives on the server (sessionStore) or in React Query cache.

## Environment

Copy `.env.example` to `.env`. Key backend variables:

- `PORT` — default 8787
- `CORS_ORIGIN` — allowed frontend origin (`*` in dev)
- `UPLOAD_DIR` — temp directory for multer file uploads

Frontend uses `VITE_API_BASE_URL` to point at the backend.

## Deployment

Configured for **Render** via `render.yaml`:
- Backend: Node web service, `npm run build` in `backend/`, starts with `node dist/src/index.js`
- Frontend: Static site, Vite build output at `frontend/dist`

## TypeScript Config

All workspaces extend `tsconfig.base.json` (target ES2022, ESNext modules, strict mode, bundler resolution). Backend and shared use `moduleResolution: bundler`; frontend uses Vite for bundling.
