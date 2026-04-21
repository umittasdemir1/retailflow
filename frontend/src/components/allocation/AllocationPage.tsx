import { useState, useMemo, useRef } from 'react';
import { useSeries, useAllocations, useAllocationMutations, type StoreAllocation } from '../../hooks/useAllocation';
import { useStores, useProducts } from '../../hooks/useStores';
import { ChevronRight, ChevronDown, ToggleLeft, ToggleRight, ChevronsRight } from 'lucide-react';

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

function BulkSeriesCell({ rows, series, onApplyAll }: {
  rows: RowData[];
  series: { id: string; name: string }[];
  onApplyAll: (seriesId: string, seriesCount: number) => void;
}) {
  const [sid, setSid] = useState('');
  const [cnt, setCnt] = useState(1);

  function apply() {
    if (!sid) return;
    onApplyAll(sid, cnt);
    setSid('');
    setCnt(1);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
      <select
        className="rf-select"
        style={{ fontSize: '0.8rem', minHeight: 30, padding: '0 8px', flex: 1 }}
        value={sid}
        onChange={(e) => setSid(e.target.value)}
      >
        <option value="">Tümüne seri uygula...</option>
        {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <input
        type="number"
        min={1}
        step={1}
        value={cnt}
        onChange={(e) => setCnt(Math.max(1, Number(e.target.value)))}
        style={{ width: 48, textAlign: 'center', padding: '3px 4px', borderRadius: 5, border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: '0.83rem' }}
      />
      <button
        type="button"
        className="rf-icon-btn"
        title={`${rows.length} renge uygula`}
        disabled={!sid}
        onClick={apply}
        style={{ flexShrink: 0 }}
      >
        <ChevronsRight size={14} />
      </button>
    </div>
  );
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

  function handleCountChange(val: number) {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save({ seriesCount: Math.max(1, val) }), 600);
  }

  return (
    <tr style={{ borderBottom: '1px solid var(--line-strong)', background: state.enabled ? 'transparent' : 'var(--surface)', opacity: state.enabled ? 1 : 0.55 }}>
      <td style={{ ...td, paddingLeft: 40, color: 'var(--ink-soft)' }}>{row.color}</td>

      <td style={td}>
        <select
          className="rf-select"
          style={{ fontSize: '0.8rem', minHeight: 30, padding: '0 8px' }}
          value={state.seriesId}
          onChange={(e) => save({ seriesId: e.target.value })}
        >
          <option value="">—</option>
          {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </td>

      <td style={{ ...td, textAlign: 'center' }}>
        <input
          type="number"
          min={1}
          step={1}
          defaultValue={state.seriesCount}
          key={row.allocation?.id ?? `${row.storeName}${row.productName}${row.color}`}
          onChange={(e) => handleCountChange(Number(e.target.value))}
          style={{ width: 56, textAlign: 'center', padding: '3px 4px', borderRadius: 5, border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--ink)', fontSize: '0.83rem' }}
        />
      </td>

      <td style={{ ...td, textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => save({ enabled: !state.enabled })}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: state.enabled ? 'var(--accent)' : 'var(--ink-muted)', display: 'inline-flex' }}
        >
          {state.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
        </button>
      </td>
    </tr>
  );
}

export function AllocationPage() {
  const { data: allocations = [], isLoading: allocLoading } = useAllocations();
  const { data: series = [] } = useSeries();
  const { data: stores = [] } = useStores();
  const { data: productsData } = useProducts();
  const { add, update } = useAllocationMutations();

  const [storeFilter, setStoreFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [onlyActive, setOnlyActive]   = useState(false);
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());

  const storeNames = useMemo(() => stores.map((s) => s.name).sort(), [stores]);
  const products   = productsData?.products ?? [];

  const allocMap = useMemo(() => {
    const map = new Map<string, StoreAllocation>();
    for (const a of allocations) map.set(`${a.storeName}|||${a.productName}|||${a.color}`, a);
    return map;
  }, [allocations]);

  // Group by product → colors
  const grouped = useMemo(() => {
    if (!storeFilter) return [];
    const pq = productFilter.toLowerCase();

    const map = new Map<string, RowData[]>();
    for (const p of products) {
      if (pq && !p.productName.toLowerCase().includes(pq)) continue;
      const colorRows: RowData[] = p.colors.map((c) => ({
        storeName:   storeFilter,
        productName: p.productName,
        color:       c,
        allocation:  allocMap.get(`${storeFilter}|||${p.productName}|||${c}`) ?? null,
      }));
      if (onlyActive && !colorRows.some((r) => getState(r).enabled)) continue;
      map.set(p.productName, colorRows);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [storeFilter, productFilter, onlyActive, products, allocMap]);

  function toggle(productName: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(productName) ? next.delete(productName) : next.add(productName);
      return next;
    });
  }

  function saveRow(row: RowData, patch: Partial<Omit<StoreAllocation, 'id' | 'createdAt'>>) {
    if (row.allocation) {
      update.mutate({ id: row.allocation.id, data: patch });
    } else {
      add.mutate({
        storeName:   row.storeName,
        productName: row.productName,
        color:       row.color,
        seriesId:    '',
        seriesCount: 1,
        enabled:     true,
        ...patch,
      });
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

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          className="rf-select"
          style={{ flex: '0 0 220px' }}
          value={storeFilter}
          onChange={(e) => setStoreFilter(e.target.value)}
        >
          <option value="">Mağaza seç...</option>
          {storeNames.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <input
          type="text"
          className="rf-text-input"
          style={{ flex: '1 1 200px' }}
          placeholder="Model ara..."
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem', color: 'var(--ink-soft)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
          Sadece aktif
        </label>
      </div>

      {!storeFilter && (
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Mağaza seç.</p>
      )}

      {storeFilter && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--line-strong)', textAlign: 'left' }}>
                <th style={th}>Model / Renk</th>
                <th style={{ ...th, width: 160 }}>Seri</th>
                <th style={{ ...th, width: 80, textAlign: 'center' }}>Adet</th>
                <th style={{ ...th, width: 70, textAlign: 'center' }}>Aktif</th>
              </tr>
            </thead>
            <tbody>
              {allocLoading && (
                <tr><td colSpan={4} style={{ padding: 16, color: 'var(--ink-muted)' }}>Yükleniyor...</td></tr>
              )}
              {!allocLoading && grouped.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 16, color: 'var(--ink-muted)' }}>Sonuç yok.</td></tr>
              )}

              {grouped.map(([productName, colorRows]) => {
                const isOpen = expanded.has(productName);
                const activeInProduct = colorRows.filter((r) => getState(r).enabled).length;
                return (
                  <>
                    {/* Product header row */}
                    <tr key={productName} style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line-strong)' }}>
                      {/* Name + toggle column */}
                      <td
                        style={{ ...td, fontWeight: 700, color: 'var(--ink)', cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => toggle(productName)}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {isOpen
                            ? <ChevronDown size={15} style={{ color: 'var(--ink-soft)', flexShrink: 0 }} />
                            : <ChevronRight size={15} style={{ color: 'var(--ink-soft)', flexShrink: 0 }} />}
                          {productName}
                          <span style={{ fontSize: '0.74rem', fontWeight: 400, color: 'var(--ink-muted)', marginLeft: 4 }}>
                            {colorRows.length} renk · {activeInProduct} aktif
                          </span>
                        </span>
                      </td>

                      {/* Bulk series selector */}
                      <td style={td}>
                        <BulkSeriesCell rows={colorRows} series={series} onApplyAll={(sid, cnt) => colorRows.forEach((r) => saveRow(r, { ...getState(r), seriesId: sid, seriesCount: cnt }))} />
                      </td>

                      <td colSpan={2} />
                    </tr>

                    {/* Color rows */}
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
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '8px 12px',
  fontWeight: 600,
  color: 'var(--ink-soft)',
  fontSize: '0.76rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '6px 12px',
  color: 'var(--ink)',
  verticalAlign: 'middle',
};
