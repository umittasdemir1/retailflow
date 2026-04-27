import { useState, useMemo, useRef } from 'react';
import { useSeries, useAllocations, useAllocationMutations, useApplyRules, type StoreAllocation } from '../../hooks/useAllocation';
import { useStores, useProducts } from '../../hooks/useStores';
import { ChevronRight, ChevronDown, ToggleLeft, ToggleRight, ChevronsRight, Store, Wand2 } from 'lucide-react';

interface RowData {
  storeName: string;
  productName: string;
  color: string;
  allocation: StoreAllocation | null;
}

function getState(row: RowData) {
  return {
    enabled:     row.allocation?.enabled     ?? true,
    seriesId:    row.allocation?.seriesId    ?? '',
    seriesCount: row.allocation?.seriesCount ?? 1,
  };
}

function ColorRow({ row, series, onSave }: {
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
    <div className="alc-color-row">
      <span className="alc-color-name">{row.color}</span>

      <select
        className="alc-inline-select"
        value={state.seriesId}
        onChange={(e) => save({ seriesId: e.target.value })}
      >
        <option value="">—</option>
        {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <input
        type="number"
        min={1}
        step={1}
        defaultValue={state.seriesCount}
        key={row.allocation?.id ?? `${row.productName}${row.color}`}
        onChange={(e) => {
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => save({ seriesCount: Math.max(1, Number(e.target.value)) }), 600);
        }}
        className="alc-num-input"
      />

      <button
        type="button"
        className={`alc-toggle${state.enabled ? ' is-on' : ''}`}
        onClick={() => save({ enabled: !state.enabled })}
        title={state.enabled ? 'Devre dışı bırak' : 'Etkinleştir'}
      >
        {state.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
      </button>
    </div>
  );
}

function ProductGroup({ productName, colorRows, series, expanded, onToggle, onSave }: {
  productName: string;
  colorRows: RowData[];
  series: { id: string; name: string }[];
  expanded: boolean;
  onToggle: () => void;
  onSave: (row: RowData, patch: Partial<Omit<StoreAllocation, 'id' | 'createdAt'>>) => void;
}) {
  const [bulkSid, setBulkSid] = useState('');
  const [bulkCnt, setBulkCnt] = useState(1);
  const activeCount = colorRows.filter((r) => getState(r).enabled).length;

  function applyBulk() {
    if (!bulkSid) return;
    colorRows.forEach((r) => onSave(r, { ...getState(r), seriesId: bulkSid, seriesCount: bulkCnt }));
    setBulkSid('');
    setBulkCnt(1);
  }

  return (
    <div className="alc-group">
      {/* Product header */}
      <div className="alc-group-header">
        <button type="button" className="alc-group-toggle" onClick={onToggle}>
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <span className="alc-group-name">{productName}</span>
          <span className="alc-group-meta">{colorRows.length} renk · {activeCount} aktif</span>
        </button>

        <div className="alc-bulk-area" onClick={(e) => e.stopPropagation()}>
          <select
            className="alc-inline-select"
            value={bulkSid}
            onChange={(e) => setBulkSid(e.target.value)}
          >
            <option value="">Tümüne seri uygula…</option>
            {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input
            type="number"
            min={1}
            step={1}
            value={bulkCnt}
            onChange={(e) => setBulkCnt(Math.max(1, Number(e.target.value)))}
            className="alc-num-input"
          />
          <button
            type="button"
            className="rf-icon-btn"
            disabled={!bulkSid}
            onClick={applyBulk}
            title="Tümüne uygula"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>

      {/* Color rows */}
      {expanded && (
        <div className="alc-color-list">
          <div className="alc-color-list-header">
            <span>Renk</span>
            <span>Seri</span>
            <span className="alc-col-center">Adet</span>
            <span className="alc-col-center">Aktif</span>
          </div>
          {colorRows.map((row) => (
            <ColorRow
              key={row.color}
              row={row}
              series={series}
              onSave={onSave}
            />
          ))}
        </div>
      )}
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const storeNames = useMemo(() => stores.map((s) => s.name).sort(), [stores]);
  const products   = productsData?.products ?? [];

  const allocMap = useMemo(() => {
    const map = new Map<string, StoreAllocation>();
    for (const a of allocations) map.set(`${a.storeName}|||${a.productName}|||${a.color}`, a);
    return map;
  }, [allocations]);

  const grouped = useMemo(() => {
    if (!storeFilter) return [];
    const pq = productFilter.toLowerCase();
    const map = new Map<string, RowData[]>();
    for (const p of products) {
      if (pq && !p.productName.toLowerCase().includes(pq)) continue;
      const colorRows: RowData[] = p.colors.map((c) => ({
        storeName: storeFilter, productName: p.productName, color: c,
        allocation: allocMap.get(`${storeFilter}|||${p.productName}|||${c}`) ?? null,
      }));
      if (onlyActive && !colorRows.some((r) => getState(r).enabled)) continue;
      map.set(p.productName, colorRows);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [storeFilter, productFilter, onlyActive, products, allocMap]);

  function toggleGroup(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function saveRow(row: RowData, patch: Partial<Omit<StoreAllocation, 'id' | 'createdAt'>>) {
    if (row.allocation) {
      update.mutate({ id: row.allocation.id, data: patch });
    } else {
      add.mutate({ storeName: row.storeName, productName: row.productName, color: row.color, seriesId: '', seriesCount: 1, enabled: true, ...patch });
    }
  }

  const totalActive = grouped.reduce((n, [, rows]) => n + rows.filter((r) => getState(r).enabled).length, 0);
  const totalRows   = grouped.reduce((n, [, rows]) => n + rows.length, 0);

  return (
    <div className="rf-page">
      <div className="rf-page-header">
        <div>
          <p className="rf-page-eyebrow">Tahsisat Sistemi</p>
          <h1 className="rf-page-title">Mağaza Tahsisatları</h1>
          <p className="rf-page-subtitle">
            {storeFilter
              ? `${grouped.length} model · ${totalRows} renk · ${totalActive} aktif`
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
      ) : grouped.length === 0 ? (
        <div className="prd-empty" style={{ marginTop: 48 }}><p>Sonuç yok.</p></div>
      ) : (
        <div className="alc-group-list">
          {grouped.map(([productName, colorRows]) => (
            <ProductGroup
              key={productName}
              productName={productName}
              colorRows={colorRows}
              series={series}
              expanded={expanded.has(productName)}
              onToggle={() => toggleGroup(productName)}
              onSave={saveRow}
            />
          ))}
        </div>
      )}
    </div>
  );
}
