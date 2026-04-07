import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AnalyzeRequest } from '@retailflow/shared';

import { useUpload } from './hooks/useUpload';
import { useAnalysis, useSimulate } from './hooks/useAnalysis';
import { useExport, useReset } from './hooks/useExport';
import { useHealth, useStores, useStrategies } from './hooks/useStores';

import { Panel } from './components/ui/Panel';
import { Notifications, createNotif, type NotifItem } from './components/ui/Notifications';
import { StatusBadge } from './components/layout/StatusBadge';
import { OverviewCards } from './components/dashboard/OverviewCards';
import { UploadZone } from './components/upload/UploadZone';
import { StoreLeaderboard } from './components/dashboard/StoreLeaderboard';
import { StrChart } from './components/dashboard/StrChart';
import { StoreMetricsTable } from './components/dashboard/StoreMetricsTable';
import { StrategySelector, StrategyDetails } from './components/analysis/StrategySelector';
import { TransferTypeSelector } from './components/analysis/TransferTypeSelector';
import { StoreSelector } from './components/analysis/StoreSelector';
import { SummaryPanel } from './components/results/SummaryPanel';
import { SimulationPanel } from './components/results/SimulationPanel';
import { TransferTable } from './components/results/TransferTable';

import { normalizeError, buildClientFileName, downloadBlob } from './lib/utils';
import type { AnalyzeResponse } from './lib/api';

type AnalysisView = AnalyzeResponse['results'];

export default function App() {
  const queryClient = useQueryClient();

  const [strategy, setStrategy] = useState<AnalyzeRequest['strategy']>('sakin');
  const [transferType, setTransferType] = useState<AnalyzeRequest['transferType']>('global');
  const [targetStore, setTargetStore] = useState('');
  const [excludedStores, setExcludedStores] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisView | null>(null);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);

  const healthQuery = useHealth();
  const strategiesQuery = useStrategies();
  const storesQuery = useStores();

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
      },
      onError: (e) => notify('error', normalizeError(e)),
    });
  }

  return (
    <main className="rf-shell">
      <Notifications items={notifs} onDismiss={dismissNotif} />

      <section className="rf-hero">
        <div>
          <p className="rf-eyebrow">RetailFlow</p>
          <h1>Stok transfer operasyonunu tek ekranda yönet</h1>
          <p className="rf-lede">
            Excel yükle, mağaza STR dağılımını incele, uygun stratejiyi seç ve global, hedefli veya beden tamamlama analizini tek akışta çalıştır.
          </p>
        </div>
        <div className="rf-hero-meta">
          <StatusBadge state={healthState} />
        </div>
      </section>

      <OverviewCards uploadInfo={uploadMutation.data ?? null} health={health} stores={stores} />

      <section className="rf-main-grid">
        <div className="rf-column rf-column-wide">
          <Panel title="1. Veri yükleme" subtitle="CSV veya Excel dosyasını bırak ya da seç.">
            <UploadZone
              isUploading={uploadMutation.isPending}
              uploadInfo={uploadMutation.data ?? null}
              onFileSelect={handleUpload}
            />
          </Panel>

          <Panel title="2. Operasyon panosu" subtitle="Yüklenen verinin genel resmini ve mağaza dağılımını incele.">
            <div className="rf-panel-stack">
              <StoreLeaderboard stores={topStores.slice(0, 5)} />
              <StrChart stores={stores} />
              <StoreMetricsTable stores={stores} isLoading={storesQuery.isLoading} />
            </div>
          </Panel>
        </div>

        <div className="rf-column rf-column-side">
          <Panel title="3. Analiz kontrolleri" subtitle="Stratejiyi, analiz modunu ve hedef mağazayı seç.">
            <div className="rf-panel-stack">
              <StrategySelector strategies={strategies} selected={strategy} onChange={setStrategy} />
              <TransferTypeSelector selected={transferType} onChange={setTransferType} />
              <StoreSelector
                transferType={transferType}
                targetStore={targetStore}
                excludedStores={excludedStores}
                stores={stores}
                onTargetChange={setTargetStore}
                onExcludedChange={setExcludedStores}
              />
              <div className="rf-action-row">
                <button type="button" className="rf-primary-button" disabled={analysisControlsDisabled} onClick={handleAnalyze}>
                  {analyzeMutation.isPending ? 'Analiz çalışıyor...' : 'Analizi Başlat'}
                </button>
                <button type="button" className="rf-secondary-button" disabled={(health?.dataLoaded ?? false) === false || resetMutation.isPending} onClick={handleReset}>
                  {resetMutation.isPending ? 'Temizleniyor...' : 'Veriyi Temizle'}
                </button>
              </div>
              {currentStrategyConfig ? <StrategyDetails config={currentStrategyConfig} /> : null}
            </div>
          </Panel>

          <Panel title="4. Sonuçlar" subtitle="Transfer özeti, risk ve export akışı.">
            <div className="rf-panel-stack">
              <SummaryPanel analysis={analysis} />
              <SimulationPanel analysis={analysis} isRefreshing={simulateMutation.isPending} onRefresh={handleSimulate} />
              <div className="rf-action-row">
                <button type="button" className="rf-primary-button" disabled={analysis == null || exportMutation.isPending} onClick={handleExport}>
                  {exportMutation.isPending ? 'Rapor hazırlanıyor...' : 'Excel İndir'}
                </button>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <Panel
        title="Transfer önerileri"
        subtitle={analysis ? 'Toplam: ' + analysis.totalTransferCount + ' · ' + analysis.transfers.length + ' satır gösteriliyor' : 'Analiz sonuçları burada listelenecek.'}
      >
        <TransferTable rows={analysis?.transfers ?? []} />
      </Panel>
    </main>
  );
}
