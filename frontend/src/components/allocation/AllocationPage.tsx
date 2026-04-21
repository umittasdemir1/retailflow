import { useState, useMemo, useRef } from 'react';
import { useSeries, useAllocations, useAllocationMutations, type StoreAllocation } from '../../hooks/useAllocation';
import { useStores, useProducts } from '../../hooks/useStores';
import { ChevronRight, ChevronDown, ToggleLeft, ToggleRight, ChevronsRight, Store } from 'lucide-react';

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

/* ── Bulk apply control on product header ─────────────────────────── */
function BulkCell({ rows, series, onApply }: {
  rows: RowData[];
  series: { id: string; name: string }[];
  onApply: (seriesId: string, count: number) => void;
}) {
  const [sid, setSid] = useState('');
  const [cnt, setCnt] = useState(1);

  return (
    <div className="alc-bulk-cell" onClick={(e) => e.stopPropagation()}>
      <select
        className="rf-select alc-bulk-select"
        value={sid}
        onChange={(e) => setSid(e.target.value)}
      >
        <option value="">Tümüne seri uygula…</option>
        {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input
        type="number" min={1} step={1} value={cnt}
        onChange={(e) => setCnt(Math.max(1, Number(e.target.value)))}
        className="alc-num-input"
        style={{ width: 52 }}
      />
      <button
        type="button"
        className="rf-icon-btn"
        title={`${rows.length} renge uygula`}
        disabled={!sid}
        onClick={() => { onApply(sid, cnt); setSid(''); setCnt(1); }}
      >
        <ChevronsRight size={14} />
      </button>
    </div>
  );
}

/* ── Color row ────────────────────────────────────────────────────── */
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
    <tr className="alc-color-row">
      <td className="alc-color-name">{row.color}</td>
      <td>
        <select
          className="rf-select alc-inline-select"
          value={state.seriesId}
          onChange={(e) => save({ seriesId: e.target.value })}
        >
          <option value="">—</option>
          {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </td>
      <td className="alc-cell-center">
        <input
          type="number" min={1} step={1}
          defaultValue={state.seriesCount}
          key={row.allocation?.id ?? `${row.productName}${row.color}`}
          onChange={(e) => {
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => save({ seriesCount: Math.max(1, Number(e.target.value)) }), 600);
          }}
          className="alc-num-input"
          style={{ width: 60 }}
        />
      </td>
      <td className="alc-cell-center">
        <button
          type="button"
          className={`alc-toggle${state.enabled ? ' is-on' : ''}`}
          onClick={() => save({ enabled: !state.enabled })}
        >
          {state.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
        </button>
      </td>
    </tr>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */
export function AllocationPage() {
  const { data: allocations = [], isLoading: allocLoading } = useAllocations();
  const { data: series = [] } = useSeries();
  const { data: stores = [] } = useStores();
  const { data: productsData } = useProducts();
  const { add, update } = useAllocationMutations();

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

  function toggle(name: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
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
      </div>

      {/* ── Toolbar ── */}
      <div className="alc-toolbar">
        <select className="rf-select alc-store-select" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
          <option value="">Mağaza seç…</option>
          {storeNames.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="prd-search-wrap" style={{ flex: 1 }}>
          <input
            className="prd-search-input"
            type="text"
            placeholder="Model ara…"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
          />
        </div>
        <label className="alc-checkbox-label">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
          Sadece aktif
        </label>
      </div>

      {!storeFilter
        ? (
          <div className="prd-empty" style={{ marginTop: 48 }}>
            <Store size={40} strokeWidth={1.2} />
            <p>Mağaza seçerek tahsisat tablosunu görüntüle.</p>
          </div>
        )
        : (
          <div className="prd-table-card">
            <div className="rf-table-wrap" style={{ borderRadius: 0, border: 'none' }}>
              <table className="rf-table alc-table">
                <thead>
                  <tr>
                    <th>Model / Renk</th>
                    <th style={{ width: 260 }}>Seri</th>
                    <th style={{ width: 80, textAlign: 'center' }}>Adet</th>
                    <th style={{ width: 72, textAlign: 'center' }}>Aktif</th>
                  </tr>
                </thead>
                <tbody>
                  {allocLoading && <tr><td colSpan={4} className="prd-loading-cell">Yükleniyor…</td></tr>}
                  {!allocLoading && grouped.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 0 }}>
                      <div className="prd-empty"><p>Sonuç yok.</p></div>
                    </td></tr>
                  )}
                  {grouped.map(([productName, colorRows]) => {
                    const isOpen = expanded.has(productName);
                    const activeCount = colorRows.filter((r) => getState(r).enabled).length;
                    return (
                      <>
                        <tr key={productName} className="alc-product-row">
                          <td className="alc-product-name" onClick={() => toggle(productName)}>
                            {isOpen ? <ChevronDown size={14} className="alc-chevron" /> : <ChevronRight size={14} className="alc-chevron" />}
                            <span>{productName}</span>
                            <span className="alc-product-meta">{colorRows.length} renk · {activeCount} aktif</span>
                          </td>
                          <td colSpan={2}>
                            <BulkCell
                              rows={colorRows}
                              series={series}
                              onApply={(sid, cnt) => colorRows.forEach((r) => saveRow(r, { ...getState(r), seriesId: sid, seriesCount: cnt }))}
                            />
                          </td>
                          <td />
                        </tr>
                        {isOpen && colorRows.map((row) => (
                          <ColorRow
                            key={`${row.productName}|||${row.color}`}
                            row={row}
                            series={series}
                            onSave={saveRow}
                          />
                        ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
    </div>
  );
}
