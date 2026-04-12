import { useEffect, useState } from 'react';
import type { AnalyzeRequest } from '@retailflow/shared';

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
import { StrategySelector, StrategyDetails } from './components/analysis/StrategySelector';
import { TransferTypeSelector } from './components/analysis/TransferTypeSelector';
import { StoreSelector } from './components/analysis/StoreSelector';
import { ProductsPage } from './components/products/ProductsPage';
import { LocationsPage } from './components/locations/LocationsPage';
import { VisionPage } from './components/vision/VisionPage';
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
  const currentStrategyConfig = strategies.find((s) => s.name === strategy) ?? null;
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

  const activePayload: AnalyzeRequest = {
    strategy,
    transferType,
    targetStore: transferType === 'global' ? undefined : targetStore,
    excludedStores,
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
        notify('success', data.fileName + ' yüklendi — ' + data.rowCount.toLocaleString('tr-TR') + ' satır');
      },
      onError: (e) => notify('error', normalizeError(e)),
    });
  }

  function handleAnalyze() {
    analyzeMutation.mutate(activePayload, {
      onSuccess: (data) => {
        setAnalysis(data.results);
        notify('success', data.results.totalTransferCount + ' transfer önerisi hazırlandı');
        setActivePage('results');
      },
      onError: (e) => notify('error', normalizeError(e)),
    });
  }

  function handleSimulate() {
    simulateMutation.mutate(undefined, {
      onSuccess: (data) => {
        setAnalysis((current) => current ? { ...current, simulation: data.impact } : current);
        notify('info', 'Simülasyon güncellendi');
      },
      onError: (e) => notify('error', normalizeError(e)),
    });
  }

  function handleExport() {
    exportMutation.mutate(activePayload, {
      onSuccess: (blob) => {
        downloadBlob(blob, buildClientFileName(transferType, targetStore, strategy));
        notify('success', 'Excel raporu indirildi');
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
        notify('info', 'Tüm veriler temizlendi');
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
                <h1 className="rf-page-title">Genel Bakış</h1>
                <p className="rf-page-subtitle">Mağaza STR dağılımı ve stok durumu.</p>
              </div>
            </div>
            <OverviewCards uploadInfo={uploadMutation.data ?? null} health={health} stores={stores} />
            <div className="rf-page-grid">
              <Panel title="Mağaza Skoru" subtitle="STR'ye göre sıralı top 5 mağaza.">
                <StoreLeaderboard stores={topStores.slice(0, 5)} />
              </Panel>
              <Panel title="STR Dağılımı" subtitle="Tüm mağazaların sell-through dağılımı.">
                <StrChart stores={stores} />
              </Panel>
            </div>
            <Panel title="Metrik Tablosu" subtitle="Tüm mağazaların detaylı metrik görünümü.">
              <StoreMetricsTable stores={stores} isLoading={storesQuery.isLoading} />
            </Panel>
          </div>
        )}

        {/* ─── UPLOAD ─── */}
        {activePage === 'upload' && (
          <div className="rf-page">
            <div className="rf-page-header">
              <div>
                <p className="rf-page-eyebrow">Veri Yönetimi</p>
                <h1 className="rf-page-title">Veri Yükle</h1>
                <p className="rf-page-subtitle">CSV veya Excel dosyasını yükle.</p>
              </div>
            </div>
            <div className="rf-page-single">
              <Panel title="Dosya Yükle" subtitle="CSV veya Excel dosyasını bırak ya da seç.">
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
                  {resetMutation.isPending ? 'Temizleniyor...' : 'Tüm Veriyi Temizle'}
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
                <p className="rf-page-eyebrow">Optimizasyon</p>
                <h1 className="rf-page-title">Analiz Kontrolleri</h1>
                <p className="rf-page-subtitle">Stratejiyi, modu ve hedef mağazayı seç, ardından analizi başlat.</p>
              </div>
            </div>
            <div className="rf-page-analysis-grid">
              <div className="rf-panel-stack">
                <Panel title="Strateji" subtitle="Transfer agresifliğini belirle.">
                  <StrategySelector strategies={strategies} selected={strategy} onChange={setStrategy} />
                </Panel>
                {currentStrategyConfig && (
                  <Panel title="Strateji Detayı" subtitle="Seçili stratejinin parametre eşikleri.">
                    <StrategyDetails config={currentStrategyConfig} />
                  </Panel>
                )}
              </div>
              <div className="rf-panel-stack">
                <Panel title="Transfer Tipi" subtitle="Global, hedefli veya beden tamamlama.">
                  <TransferTypeSelector selected={transferType} onChange={setTransferType} />
                </Panel>
                <Panel title="Mağaza Filtresi" subtitle="Hedef ve hariç tutulacak mağazaları seç.">
                  <StoreSelector
                    transferType={transferType}
                    targetStore={targetStore}
                    excludedStores={excludedStores}
                    stores={stores}
                    onTargetChange={setTargetStore}
                    onExcludedChange={setExcludedStores}
                  />
                </Panel>
                <div className="rf-action-row">
                  <button
                    type="button"
                    className="rf-primary-button"
                    disabled={analysisControlsDisabled}
                    onClick={handleAnalyze}
                  >
                    {analyzeMutation.isPending ? 'Analiz çalışıyor...' : 'Analizi Başlat'}
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
                <p className="rf-page-eyebrow">Transfer Analizi</p>
                <h1 className="rf-page-title">Sonuçlar</h1>
                <p className="rf-page-subtitle">
                  {analysis
                    ? analysis.totalTransferCount + ' transfer önerisi · ' + analysis.transfers.length + ' satır'
                    : 'Henüz analiz çalıştırılmadı.'}
                </p>
              </div>
              <div className="rf-action-row" style={{ alignSelf: 'flex-end' }}>
                <button
                  type="button"
                  className="rf-primary-button"
                  disabled={analysis == null || exportMutation.isPending}
                  onClick={handleExport}
                >
                  {exportMutation.isPending ? 'Rapor hazırlanıyor...' : 'Excel İndir'}
                </button>
              </div>
            </div>
            <div className="rf-page-grid">
              <Panel title="Transfer Özeti" subtitle="Risk dağılımı ve temel metrikler.">
                <SummaryPanel analysis={analysis} />
              </Panel>
              <Panel title="Simülasyon" subtitle="Transfer etkisini simüle et.">
                <SimulationPanel analysis={analysis} isRefreshing={simulateMutation.isPending} onRefresh={handleSimulate} />
              </Panel>
            </div>
            <Panel
              title="Transfer Önerileri"
              subtitle={analysis ? 'Tüm transfer satırları' : 'Analiz sonuçları burada listelenecek.'}
            >
              <TransferTable rows={analysis?.transfers ?? []} />
            </Panel>
          </div>
        )}

        {/* ─── VISION ─── */}
        {activePage === 'vision' && <VisionPage />}

      </AppShell>
    </>
  );
}
