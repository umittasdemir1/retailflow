import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AnalyzeRequest } from '@retailflow/shared';

import { useUpload } from './hooks/useUpload';
import { useAnalysis, useSimulate } from './hooks/useAnalysis';
import { useExport, useReset } from './hooks/useExport';
import { useHealth, useStores, useStrategies } from './hooks/useStores';

import { Panel } from './components/ui/Panel';
import { ToastBanner, type ToastState } from './components/ui/Toast';
import { StatusBadge } from './components/layout/StatusBadge';
import { OverviewCards } from './components/dashboard/OverviewCards';
import { UploadZone } from './components/upload/UploadZone';
import { HealthStrip } from './components/dashboard/HealthStrip';
import { StoreLeaderboard } from './components/dashboard/StoreLeaderboard';
import { StrChart } from './components/dashboard/StrChart';
import { StoreMetricsTable } from './components/dashboard/StoreMetricsTable';
import { StrategySelector, StrategyDetails } from './components/analysis/StrategySelector';
import { TransferTypeSelector } from './components/analysis/TransferTypeSelector';
import { StoreSelector } from './components/analysis/StoreSelector';
import { SummaryPanel } from './components/results/SummaryPanel';
import { SimulationPanel } from './components/results/SimulationPanel';
import { TransferTable } from './components/results/TransferTable';
import { RejectedTable } from './components/results/RejectedTable';

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
  const [toast, setToast] = useState<ToastState>(null);

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

  function handleUpload(file: File) {
    uploadMutation.mutate(file, {
      onSuccess: (data) => {
        setAnalysis(null);
        setToast({ tone: 'success', text: data.fileName + ' yuklendi. ' + data.rowCount + ' satir isleme alindi.' });
      },
      onError: (e) => setToast({ tone: 'error', text: normalizeError(e) }),
    });
  }

  function handleAnalyze() {
    analyzeMutation.mutate(activePayload, {
      onSuccess: (data) => {
        setAnalysis(data.results);
        setToast({ tone: 'success', text: data.results.totalTransferCount + ' transfer onerisi hazirlandi.' });
      },
      onError: (e) => setToast({ tone: 'error', text: normalizeError(e) }),
    });
  }

  function handleSimulate() {
    simulateMutation.mutate(undefined, {
      onSuccess: (data) => {
        setAnalysis((current) => current ? { ...current, simulation: data.impact } : current);
        setToast({ tone: 'info', text: 'Simulasyon guncellendi.' });
      },
      onError: (e) => setToast({ tone: 'error', text: normalizeError(e) }),
    });
  }

  function handleExport() {
    exportMutation.mutate(activePayload, {
      onSuccess: (blob) => {
        downloadBlob(blob, buildClientFileName(transferType, targetStore, strategy));
        setToast({ tone: 'success', text: 'Excel raporu indirildi.' });
      },
      onError: (e) => setToast({ tone: 'error', text: normalizeError(e) }),
    });
  }

  function handleReset() {
    resetMutation.mutate(undefined, {
      onSuccess: () => {
        setAnalysis(null);
        setTargetStore('');
        setExcludedStores([]);
        setToast({ tone: 'info', text: 'Tum veriler temizlendi.' });
      },
      onError: (e) => setToast({ tone: 'error', text: normalizeError(e) }),
    });
  }

  return (
    <main className="rf-shell">
      <section className="rf-hero">
        <div>
          <p className="rf-eyebrow">RetailFlow</p>
          <h1>Stok transfer operasyonunu tek ekranda yonet</h1>
          <p className="rf-lede">
            Excel yukle, magaza STR dagilimini incele, uygun stratejiyi sec ve global, hedefli veya beden tamamlama analizini tek akista calistir.
          </p>
        </div>
        <div className="rf-hero-meta">
          <StatusBadge health={health} />
          <div className="rf-chip-row">
            <span className="rf-chip">Monorepo aktif</span>
            <span className="rf-chip">Node 22</span>
            <span className="rf-chip">Render + Netlify</span>
          </div>
        </div>
      </section>

      {toast ? <ToastBanner toast={toast} onClose={() => setToast(null)} /> : null}

      <OverviewCards uploadInfo={uploadMutation.data ?? null} health={health} stores={stores} />

      <section className="rf-main-grid">
        <div className="rf-column rf-column-wide">
          <Panel title="1. Veri yukleme" subtitle="CSV veya Excel dosyasini birak ya da sec.">
            <UploadZone
              isUploading={uploadMutation.isPending}
              uploadInfo={uploadMutation.data ?? null}
              onFileSelect={handleUpload}
            />
          </Panel>

          <Panel title="2. Operasyon panosu" subtitle="Yuklenen verinin genel resmini ve magaza dagilimini incele.">
            <div className="rf-panel-stack">
              <HealthStrip health={health} />
              <StoreLeaderboard stores={topStores.slice(0, 5)} />
              <StrChart stores={stores} />
              <StoreMetricsTable stores={stores} isLoading={storesQuery.isLoading} />
            </div>
          </Panel>
        </div>

        <div className="rf-column rf-column-side">
          <Panel title="3. Analiz kontrolleri" subtitle="Stratejiyi, analiz modunu ve hedef magazayi sec.">
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
                  {analyzeMutation.isPending ? 'Analiz calisiyor...' : 'Analizi Baslat'}
                </button>
                <button type="button" className="rf-secondary-button" disabled={(health?.dataLoaded ?? false) === false || resetMutation.isPending} onClick={handleReset}>
                  {resetMutation.isPending ? 'Temizleniyor...' : 'Veriyi Temizle'}
                </button>
              </div>
              {currentStrategyConfig ? <StrategyDetails config={currentStrategyConfig} /> : null}
            </div>
          </Panel>

          <Panel title="4. Sonuclar" subtitle="Transfer ozeti, risk ve export akisi.">
            <div className="rf-panel-stack">
              <SummaryPanel analysis={analysis} />
              <SimulationPanel analysis={analysis} isRefreshing={simulateMutation.isPending} onRefresh={handleSimulate} />
              <div className="rf-action-row">
                <button type="button" className="rf-primary-button" disabled={analysis == null || exportMutation.isPending} onClick={handleExport}>
                  {exportMutation.isPending ? 'Rapor hazirlaniyor...' : 'Excel Indir'}
                </button>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <section className="rf-results-grid">
        <Panel
          title="Transfer onerileri"
          subtitle={analysis ? 'Toplam: ' + analysis.totalTransferCount + ' · ' + analysis.transfers.length + ' satir gosteriliyor' : 'Analiz sonuclari burada listelenecek.'}
        >
          <TransferTable rows={analysis?.transfers ?? []} />
        </Panel>
        <Panel
          title="Red edilenler"
          subtitle={analysis ? analysis.rejectedTransfers.length + ' red kaydi' : 'Kosullari saglamayan urunler analiz sonrasinda burada gorunur.'}
        >
          <RejectedTable rows={analysis?.rejectedTransfers ?? []} />
        </Panel>
      </section>
    </main>
  );
}
