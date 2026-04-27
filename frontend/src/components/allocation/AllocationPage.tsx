import { useState, useMemo, useRef } from 'react';
import { useSeries, useAllocations, useAllocationMutations, useApplyRules, type StoreAllocation } from '../../hooks/useAllocation';
import { useStores, useProducts } from '../../hooks/useStores';
import { ToggleLeft, ToggleRight, Store, Wand2 } from 'lucide-react';

interface RowData {
  storeName: string;
  productName: string;
  colors: string[];
  category: string | null;
  allocation: StoreAllocation | null;
}

function getState(row: RowData) {
  return {
    enabled:     row.allocation?.enabled     ?? true,
    seriesId:    row.allocation?.seriesId    ?? '',
    seriesCount: row.allocation?.seriesCount ?? 1,
  };
}

function ProductRow({ row, series, onSave }: {
  row: RowData;
  series: { id: string; name: string }[];
  onSave: (row: RowData, patch: Partial<Omit<StoreAllocation, 'id' | 'createdAt'>>) => void;
}) {
  const state = getState(row);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  function save(patch: Partial<Omit<StoreAllocation, 'id' | 'createdAt'>>) {
    onSave(row, { ...state, ...patch });
  }

  return (
    <div className={`alc-product-row${state.seriesId ? ' has-series' : ''}`}>
      <div className="alc-product-info">
        <span className="alc-product-name">{row.productName}</span>
        {row.category && <span className="alc-product-cat">{row.category}</span>}
        <div className="alc-color-chips">
          {row.colors.map((c) => <span key={c} className="alc-color-chip">{c}</span>)}
        </div>
      </div>

      <select
        className="alc-inline-select"
        value={state.seriesId}
        onChange={(e) => save({ seriesId: e.target.value })}
      >
        <option value="">— Seri seç —</option>
        {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <input
        type="number"
        min={1}
        step={1}
        defaultValue={state.seriesCount}
        key={row.allocation?.id ?? row.productName}
        onChange={(e) => {
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => save({ seriesCount: Math.max(1, Number(e.target.value)) }), 600);
        }}
        className="alc-num-input"
      />

      <div className="alc-col-center">
        <button
          type="button"
          className={`alc-toggle${state.enabled ? ' is-on' : ''}`}
          onClick={() => save({ enabled: !state.enabled })}
          title={state.enabled ? 'Devre dışı bırak' : 'Etkinleştir'}
        >
          {state.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
        </button>
      </div>
    </div>
  );
}

export function AllocationPage() {
  const { data: allocations = [], isLoading: allocLoading } = useAllocations();
  const { data: series = [] } = useSeries();
  const { data: stores = [] } = useStores();
  const { data: productsData } = useProducts();
  const { add, update } = useAllocationMutations();
  const applyRules = useApplyRules();

  const [storeFilter, setStoreFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);

  const storeNames = useMemo(() => stores.map((s) => s.name).sort(), [stores]);
  const products   = productsData?.products ?? [];

  const allocMap = useMemo(() => {
    const map = new Map<string, StoreAllocation>();
    for (const a of allocations) map.set(`${a.storeName}|||${a.productName}`, a);
    return map;
  }, [allocations]);

  const rows = useMemo<RowData[]>(() => {
    if (!storeFilter) return [];
    const pq = productFilter.toLowerCase();
    return products
      .filter((p) => !pq || p.productName.toLowerCase().includes(pq))
      .map((p) => ({
        storeName:   storeFilter,
        productName: p.productName,
        colors:      p.colors,
        category:    p.category,
        allocation:  allocMap.get(`${storeFilter}|||${p.productName}`) ?? null,
      }))
      .filter((r) => !onlyActive || getState(r).enabled)
      .sort((a, b) => a.productName.localeCompare(b.productName));
  }, [storeFilter, productFilter, onlyActive, products, allocMap]);

  function saveRow(row: RowData, patch: Partial<Omit<StoreAllocation, 'id' | 'createdAt'>>) {
    if (row.allocation) {
      update.mutate({ id: row.allocation.id, data: patch });
    } else {
      add.mutate({ storeName: row.storeName, productName: row.productName, seriesId: '', seriesCount: 1, enabled: true, ...patch });
    }
  }

  const totalWithSeries = rows.filter((r) => getState(r).seriesId).length;

  return (
    <div className="rf-page">
      <div className="rf-page-header">
        <div>
          <p className="rf-page-eyebrow">Tahsisat Sistemi</p>
          <h1 className="rf-page-title">Mağaza Tahsisatları</h1>
          <p className="rf-page-subtitle">
            {storeFilter
              ? `${rows.length} model · ${totalWithSeries} serili`
              : 'Mağaza seçerek başla.'}
          </p>
        </div>
        <button
          type="button"
          className="rf-secondary-button"
          disabled={applyRules.isPending}
          onClick={() => applyRules.mutate(undefined, {
            onSuccess: (r) => alert(`Tamamlandı: ${r.applied} tahsisat güncellendi, ${r.skipped} atlandı.`),
          })}
          title="Asorti kurallarına göre seri ata (serisi boş olanlara)"
        >
          <Wand2 size={15} style={{ marginRight: 6 }} />
          {applyRules.isPending ? 'Uygulanıyor…' : 'Kuralları Uygula'}
        </button>
      </div>

      <div className="alc-toolbar">
        <select className="rf-select" style={{ flex: '0 0 220px' }} value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
          <option value="">Mağaza seç…</option>
          {storeNames.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          type="text"
          className="rf-text-input"
          style={{ flex: 1 }}
          placeholder="Model ara…"
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
        />
        <label className="alc-checkbox-label">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
          Sadece aktif
        </label>
      </div>

      {!storeFilter ? (
        <div className="prd-empty" style={{ marginTop: 48 }}>
          <Store size={40} strokeWidth={1.2} />
          <p>Mağaza seçerek tahsisat tablosunu görüntüle.</p>
        </div>
      ) : allocLoading ? (
        <p className="alc-loading">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <div className="prd-empty" style={{ marginTop: 48 }}><p>Sonuç yok.</p></div>
      ) : (
        <div className="alc-list">
          <div className="alc-list-header">
            <span>Model / Renkler</span>
            <span>Seri</span>
            <span className="alc-col-center">Adet</span>
            <span className="alc-col-center">Aktif</span>
          </div>
          {rows.map((row) => (
            <ProductRow
              key={row.productName}
              row={row}
              series={series}
              onSave={saveRow}
            />
          ))}
        </div>
      )}
    </div>
  );
}
