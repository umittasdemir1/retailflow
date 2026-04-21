import { useEffect, useMemo, useState } from 'react';
import type { AnalyzeRequest, StrategyConfig } from '@retailflow/shared';

import { useUpload } from './hooks/useUpload';
import { useAnalysis, useSimulate } from './hooks/useAnalysis';
import { useExport, useReset } from './hooks/useExport';
import { useHealth, useProducts, useStores, useStrategies } from './hooks/useStores';

import { AppShell, type ActivePage } from './components/layout/AppShell';
import { Panel } from './components/ui/Panel';
import { Notifications, createNotif, type NotifItem } from './components/ui/Notifications';
import { OverviewCards } from './components/dashboard/OverviewCards';
import { UploadZone } from './components/upload/UploadZone';
import { StoreLeaderboard } from './components/dashboard/StoreLeaderboard';
import { StrChart } from './components/dashboard/StrChart';
import { StoreMetricsTable } from './components/dashboard/StoreMetricsTable';
import { StrategySelector } from './components/analysis/StrategySelector';
import { TransferTypeSelector } from './components/analysis/TransferTypeSelector';
import { StoreSelector } from './components/analysis/StoreSelector';
import { CategoryFilter } from './components/analysis/CategoryFilter';
import { ProductsPage } from './components/products/ProductsPage';
import { LocationsPage } from './components/locations/LocationsPage';
import { VisionPage } from './components/vision/VisionPage';
import { GuidePage } from './components/guide/GuidePage';
import { SeriesPage } from './components/allocation/SeriesPage';
import { AssortmentPage } from './components/allocation/AssortmentPage';
import { AllocationPage } from './components/allocation/AllocationPage';
import { SummaryPanel } from './components/results/SummaryPanel';
import { SimulationPanel } from './components/results/SimulationPanel';
import { TransferTable } from './components/results/TransferTable';

import { normalizeError, buildClientFileName, downloadBlob } from './lib/utils';
import type { AnalyzeResponse } from './lib/api';

type AnalysisView = AnalyzeResponse['results'];

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [strategy, setStrategy] = useState<AnalyzeRequest['strategy']>('sakin');
  const [transferType, setTransferType] = useState<AnalyzeRequest['transferType']>('global');
  const [targetStore, setTargetStore] = useState('');
  const [excludedStores, setExcludedStores] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includedCategories, setIncludedCategories] = useState<string[]>([]);
  const [groupingMode, setGroupingMode] = useState<'name' | 'sku'>('name');
  const [customConfig, setCustomConfig] = useState<Partial<StrategyConfig>>({});
  const [analysis, setAnalysis] = useState<AnalysisView | null>(null);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);

  const healthQuery = useHealth();
  const strategiesQuery = useStrategies();
  const storesQuery = useStores();
  const productsQuery = useProducts();

  const uploadMutation = useUpload();
  const analyzeMutation = useAnalysis();
  const simulateMutation = useSimulate();
  const exportMutation = useExport();
  const resetMutation = useReset();

  const health = healthQuery.data;
  const strategies = strategiesQuery.data ?? [];
  const stores = storesQuery.data ?? [];
  const topStores = stores.slice().sort((a, b) => b.strPercent - a.strPercent);
  const analysisControlsDisabled = (health?.dataLoaded ?? false) === false || analyzeMutation.isPending;

  const healthState =
    healthQuery.isError
      ? 'offline'
      : healthQuery.isLoading || healthQuery.isFetching
        ? 'loading'
        : health?.status === 'healthy'
          ? 'healthy'
          : 'offline';

  useEffect(() => {
    if (strategies.length > 0 && !strategies.some((s) => s.name === strategy)) {
      setStrategy(strategies[0].name);
    }
  }, [strategies, strategy]);

  useEffect(() => {
    if (transferType !== 'global' && targetStore.length === 0 && stores.length > 0) {
      setTargetStore(stores[0].name);
    }
  }, [transferType, targetStore, stores]);

  useEffect(() => {
    setExcludedStores((current) => current.filter((s) => s !== targetStore));
  }, [targetStore]);

  const analysisDays = useMemo(() => {
    if (!startDate || !endDate) return undefined;
    const diff = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000);
    return diff > 0 ? diff : undefined;
  }, [startDate, endDate]);

  const categories = useMemo(() => {
    if (!productsQuery.data) return [];
    return [...new Set(productsQuery.data.products.map((p) => p.category).filter((c): c is string => c !== null))].sort();
  }, [productsQuery.data]);

  const activePayload: AnalyzeRequest = {
    strategy,
    transferType,
    targetStore: transferType === 'global' ? undefined : targetStore,
    excludedStores,
    analysisDays,
    includedCategories: includedCategories.length > 0 ? includedCategories : undefined,
    groupingMode: groupingMode !== 'name' ? groupingMode : undefined,
    customConfig: strategy === 'custom' ? customConfig : undefined,
  };

  function notify(type: NotifItem['type'], message: string) {
    setNotifs((prev) => [...prev, createNotif(type, message)]);
  }

  function dismissNotif(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  }

  function handleUpload(file: File) {
    uploadMutation.mutate(file, {
      onSuccess: (data) => {
        setAnalysis(null);
        notify('success', data.fileName + ' uploaded — ' + data.rowCount.toLocaleString('tr-TR') + ' rows');
      },
      onError: (e) => notify('error', normalizeError(e)),
    });
  }

  function handleAnalyze() {
    analyzeMutation.mutate(activePayload, {
      onSuccess: (data) => {
        setAnalysis(data.results);
        notify('success', data.results.totalTransferCount + ' transfer suggestions ready');
        setActivePage('results');
      },
      onError: (e) => notify('error', normalizeError(e)),
    });
  }

  function handleSimulate() {
    simulateMutation.mutate(undefined, {
      onSuccess: (data) => {
        setAnalysis((current) => current ? { ...current, simulation: data.impact } : current);
        notify('info', 'Simulation updated');
      },
      onError: (e) => notify('error', normalizeError(e)),
    });
  }

  function handleExport() {
    exportMutation.mutate(activePayload, {
      onSuccess: (blob) => {
        downloadBlob(blob, buildClientFileName(transferType, targetStore, strategy));
        notify('success', 'Excel report downloaded');
      },
      onError: (e) => notify('error', normalizeError(e)),
    });
  }

  function handleReset() {
    resetMutation.mutate(undefined, {
      onSuccess: () => {
        setAnalysis(null);
        setTargetStore('');
        setExcludedStores([]);
        notify('info', 'All data cleared');
        setActivePage('dashboard');
      },
      onError: (e) => notify('error', normalizeError(e)),
    });
  }

  return (
    <>
      <Notifications items={notifs} onDismiss={dismissNotif} />
      <AppShell activePage={activePage} onPageChange={setActivePage} healthState={healthState}>

        {/* ─── DASHBOARD ─── */}
        {activePage === 'dashboard' && (
          <div className="rf-page">
            <div className="rf-page-header">
              <div>
                <p className="rf-page-eyebrow">RetailFlow</p>
                <h1 className="rf-page-title">Overview</h1>
                <p className="rf-page-subtitle">Store STR distribution and inventory status.</p>
              </div>
            </div>
            <OverviewCards uploadInfo={uploadMutation.data ?? null} health={health} stores={stores} />
            <div className="rf-page-grid">
              <Panel title="Store Score" subtitle="Top 5 stores ranked by STR.">
                <StoreLeaderboard stores={topStores.slice(0, 5)} />
              </Panel>
              <Panel title="STR Distribution" subtitle="Sell-through distribution across all stores.">
                <StrChart stores={stores} />
              </Panel>
            </div>
            <Panel title="Metrics Table" subtitle="Detailed metrics view for all stores.">
              <StoreMetricsTable stores={stores} isLoading={storesQuery.isLoading} />
            </Panel>
          </div>
        )}

        {/* ─── UPLOAD ─── */}
        {activePage === 'upload' && (
          <div className="rf-page">
            <div className="rf-page-header">
              <div>
                <p className="rf-page-eyebrow">Data Management</p>
                <h1 className="rf-page-title">Upload Data</h1>
                <p className="rf-page-subtitle">Upload a CSV or Excel file.</p>
              </div>
            </div>
            <div className="rf-page-single">
              <Panel title="Upload File" subtitle="Drop or select a CSV or Excel file.">
                <UploadZone
                  isUploading={uploadMutation.isPending}
                  uploadInfo={uploadMutation.data ?? null}
                  onFileSelect={handleUpload}
                />
              </Panel>
              <div className="rf-action-row" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="rf-secondary-button"
                  disabled={(health?.dataLoaded ?? false) === false || resetMutation.isPending}
                  onClick={handleReset}
                >
                  {resetMutation.isPending ? 'Clearing...' : 'Clear All Data'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── PRODUCTS ─── */}
        {activePage === 'products' && (
          <ProductsPage data={productsQuery.data} isLoading={productsQuery.isLoading} />
        )}

        {/* ─── LOCATIONS ─── */}
        {activePage === 'locations' && (
          <LocationsPage stores={stores} isLoading={storesQuery.isLoading} />
        )}

        {/* ─── ANALYSIS ─── */}
        {activePage === 'analysis' && (
          <div className="rf-page">
            <div className="rf-page-header">
              <div>
                <p className="rf-page-eyebrow">Optimization</p>
                <h1 className="rf-page-title">Analysis Controls</h1>
                <p className="rf-page-subtitle">Select strategy, mode and target store, then run analysis.</p>
              </div>
            </div>
            <div className="rf-page-analysis-grid">
              <div className="rf-panel-stack">
                <Panel title="Strategy" subtitle="Click a column to select. Edit the Custom column to define your own.">
                  <StrategySelector
                    strategies={strategies}
                    selected={strategy}
                    onChange={setStrategy}
                    customConfig={customConfig}
                    onCustomConfigChange={setCustomConfig}
                  />
                </Panel>
              </div>
              <div className="rf-panel-stack">
                <Panel title="Date Range" subtitle={analysisDays != null ? `${analysisDays} analysis days` : 'Optional — defaults to 30 days if not set.'}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label className="rf-field">
                      <span>Start date</span>
                      <input type="date" className="rf-date-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </label>
                    <label className="rf-field">
                      <span>End date</span>
                      <input type="date" className="rf-date-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </label>
                  </div>
                  {analysisDays != null && (
                    <p style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                      Cover days will be calculated over <strong>{analysisDays}</strong> days.
                    </p>
                  )}
                </Panel>
                <Panel title="Product Grouping" subtitle={groupingMode === 'name' ? 'Multi-season products are merged.' : 'Each product code treated separately.'}>
                  <div className="rf-mode-row">
                    <button type="button" className={`rf-mode-button${groupingMode === 'name' ? ' is-active' : ''}`} onClick={() => setGroupingMode('name')}>
                      Product Name
                    </button>
                    <button type="button" className={`rf-mode-button${groupingMode === 'sku' ? ' is-active' : ''}`} onClick={() => setGroupingMode('sku')}>
                      SKU / Code
                    </button>
                  </div>
                  <p style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                    {groupingMode === 'name'
                      ? 'Groups by Name + Color + Size. NOLAN BLACK M across all seasons = 1 product.'
                      : 'Groups by exact product code. NL23-BLK-M and NL24-BLK-M = 2 separate products.'}
                  </p>
                </Panel>
                <Panel title="Transfer Type" subtitle="Global, targeted, or size completion.">
                  <TransferTypeSelector selected={transferType} onChange={setTransferType} />
                </Panel>
                <Panel title="Store Filter" subtitle="Select target and excluded stores.">
                  <StoreSelector
                    transferType={transferType}
                    targetStore={targetStore}
                    excludedStores={excludedStores}
                    stores={stores}
                    onTargetChange={setTargetStore}
                    onExcludedChange={setExcludedStores}
                  />
                </Panel>
                <Panel title="Category Filter" subtitle={includedCategories.length === 0 ? 'All categories included.' : `${includedCategories.length} of ${categories.length} selected.`}>
                  <CategoryFilter
                    categories={categories}
                    included={includedCategories}
                    onChange={setIncludedCategories}
                  />
                </Panel>
                <div className="rf-action-row">
                  <button
                    type="button"
                    className="rf-primary-button"
                    disabled={analysisControlsDisabled}
                    onClick={handleAnalyze}
                  >
                    {analyzeMutation.isPending ? 'Running analysis...' : 'Start Analysis'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── RESULTS ─── */}
        {activePage === 'results' && (
          <div className="rf-page">
            <div className="rf-page-header">
              <div>
                <p className="rf-page-eyebrow">Transfer Analysis</p>
                <h1 className="rf-page-title">Results</h1>
                <p className="rf-page-subtitle">
                  {analysis
                    ? analysis.totalTransferCount + ' transfer suggestions · ' + analysis.transfers.length + ' rows'
                    : 'No analysis run yet.'}
                </p>
              </div>
              <div className="rf-action-row" style={{ alignSelf: 'flex-end' }}>
                <button
                  type="button"
                  className="rf-primary-button"
                  disabled={analysis == null || exportMutation.isPending}
                  onClick={handleExport}
                >
                  {exportMutation.isPending ? 'Preparing report...' : 'Download Excel'}
                </button>
              </div>
            </div>
            <div className="rf-page-grid">
              <Panel title="Transfer Summary" subtitle="Risk breakdown and key metrics.">
                <SummaryPanel analysis={analysis} />
              </Panel>
              <Panel title="Simulation" subtitle="Simulate transfer impact.">
                <SimulationPanel analysis={analysis} isRefreshing={simulateMutation.isPending} onRefresh={handleSimulate} />
              </Panel>
            </div>
            <Panel
              title="Transfer Suggestions"
              subtitle={analysis ? 'All transfer rows' : 'Analysis results will be listed here.'}
            >
              <TransferTable rows={analysis?.transfers ?? []} />
            </Panel>
          </div>
        )}

        {/* ─── VISION ─── */}
        {activePage === 'vision' && <VisionPage />}

        {/* ─── GUIDE ─── */}
        {activePage === 'guide' && <GuidePage />}

        {/* ─── SERIES ─── */}
        {activePage === 'series' && <SeriesPage />}

        {/* ─── ASSORTMENT ─── */}
        {activePage === 'assortment' && <AssortmentPage />}

        {/* ─── ALLOCATIONS ─── */}
        {activePage === 'allocations' && <AllocationPage />}

      </AppShell>
    </>
  );
}
