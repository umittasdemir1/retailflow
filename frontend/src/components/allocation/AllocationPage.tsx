import { useState, useMemo, useCallback } from 'react';
import { useSeries, useAllocations, useAllocationMutations, type StoreAllocation } from '../../hooks/useAllocation';
import { useStores, useProducts } from '../../hooks/useStores';
import { ToggleLeft, ToggleRight } from 'lucide-react';

interface TableRow {
  storeName: string;
  productName: string;
  color: string;
  allocation: StoreAllocation | null;
}

function useDebounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function AllocationPage() {
  const { data: allocations = [], isLoading: allocLoading } = useAllocations();
  const { data: series = [] } = useSeries();
  const { data: stores = [] } = useStores();
  const { data: productsData } = useProducts();
  const { add, update } = useAllocationMutations();

  const [storeFilter, setStoreFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);

  const storeNames = useMemo(() => stores.map((s) => s.name).sort(), [stores]);
  const products = productsData?.products ?? [];

  // All product × color combinations
  const productColors = useMemo(() => {
    const rows: { productName: string; color: string }[] = [];
    for (const p of products) {
      for (const c of p.colors) {
        rows.push({ productName: p.productName, color: c });
      }
    }
    return rows;
  }, [products]);

  // Allocation lookup map: storeName|||productName|||color → StoreAllocation
  const allocMap = useMemo(() => {
    const map = new Map<string, StoreAllocation>();
    for (const a of allocations) {
      map.set(`${a.storeName}|||${a.productName}|||${a.color}`, a);
    }
    return map;
  }, [allocations]);

  // Full matrix filtered by store + product search + onlyActive
  const rows = useMemo((): TableRow[] => {
    if (!storeFilter) return [];
    const pq = productFilter.toLowerCase();
    return productColors
      .filter((pc) => !pq || pc.productName.toLowerCase().includes(pq) || pc.color.toLowerCase().includes(pq))
      .map((pc) => ({
        storeName: storeFilter,
        productName: pc.productName,
        color: pc.color,
        allocation: allocMap.get(`${storeFilter}|||${pc.productName}|||${pc.color}`) ?? null,
      }))
      .filter((r) => !onlyActive || r.allocation?.enabled === true);
  }, [storeFilter, productFilter, onlyActive, productColors, allocMap]);

  function getAllocationState(row: TableRow) {
    return {
      enabled: row.allocation?.enabled ?? false,
      seriesId: row.allocation?.seriesId ?? '',
      seriesCount: row.allocation?.seriesCount ?? 1,
    };
  }

  function saveRow(row: TableRow, patch: Partial<Omit<StoreAllocation, 'id' | 'createdAt'>>) {
    if (row.allocation) {
      update.mutate({ id: row.allocation.id, data: patch });
    } else {
      add.mutate({
        storeName: row.storeName,
        productName: row.productName,
        color: row.color,
        seriesId: patch.seriesId ?? '',
        seriesCount: patch.seriesCount ?? 1,
        enabled: patch.enabled ?? false,
        ...patch,
      });
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSave = useCallback(
    useDebounce((row: TableRow, patch: Partial<Omit<StoreAllocation, 'id' | 'createdAt'>>) => {
      saveRow(row, patch);
    }, 600),
    [allocations],
  );

  const activeCount = rows.filter((r) => r.allocation?.enabled).length;

  return (
    <div className="rf-page">
      <div className="rf-page-header">
        <div>
          <p className="rf-page-eyebrow">Tahsisat Sistemi</p>
          <h1 className="rf-page-title">Mağaza Tahsisatları</h1>
          <p className="rf-page-subtitle">
            {storeFilter
              ? `${rows.length} kombinasyon · ${activeCount} aktif`
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
          placeholder="Ürün veya renk ara..."
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem', color: 'var(--ink-soft)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
          />
          Sadece aktif
        </label>
      </div>

      {!storeFilter && (
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Tablo görüntülemek için yukarıdan mağaza seç.</p>
      )}

      {storeFilter && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--line-strong)', textAlign: 'left' }}>
                <th style={thStyle}>Ürün</th>
                <th style={thStyle}>Renk</th>
                <th style={{ ...thStyle, width: 160 }}>Seri</th>
                <th style={{ ...thStyle, width: 80, textAlign: 'center' }}>Adet</th>
                <th style={{ ...thStyle, width: 70, textAlign: 'center' }}>Aktif</th>
              </tr>
            </thead>
            <tbody>
              {allocLoading && (
                <tr><td colSpan={5} style={{ padding: '16px', color: 'var(--ink-muted)' }}>Yükleniyor...</td></tr>
              )}
              {!allocLoading && rows.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '16px', color: 'var(--ink-muted)' }}>Sonuç yok.</td></tr>
              )}
              {rows.map((row) => {
                const state = getAllocationState(row);
                const rowKey = `${row.storeName}|||${row.productName}|||${row.color}`;
                return (
                  <tr
                    key={rowKey}
                    style={{
                      borderBottom: '1px solid var(--line-strong)',
                      background: state.enabled ? 'transparent' : 'var(--surface)',
                      opacity: state.enabled ? 1 : 0.6,
                    }}
                  >
                    <td style={tdStyle}>{row.productName}</td>
                    <td style={{ ...tdStyle, color: 'var(--ink-soft)' }}>{row.color}</td>

                    {/* Series selector */}
                    <td style={tdStyle}>
                      <select
                        className="rf-select"
                        style={{ fontSize: '0.8rem', minHeight: 32, padding: '0 8px' }}
                        value={state.seriesId}
                        onChange={(e) => saveRow(row, { ...state, seriesId: e.target.value })}
                      >
                        <option value="">—</option>
                        {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>

                    {/* Series count */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        defaultValue={state.seriesCount}
                        key={`${rowKey}-${state.seriesCount}`}
                        onChange={(e) => debouncedSave(row, { ...state, seriesCount: Math.max(1, Number(e.target.value)) })}
                        style={{ width: 56, textAlign: 'center', padding: '3px 4px', borderRadius: 5, border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: '0.83rem' }}
                      />
                    </td>

                    {/* Toggle */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => saveRow(row, { ...state, enabled: !state.enabled })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: state.enabled ? 'var(--accent)' : 'var(--ink-muted)', display: 'inline-flex' }}
                        title={state.enabled ? 'Devre dışı bırak' : 'Etkinleştir'}
                      >
                        {state.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontWeight: 600,
  color: 'var(--ink-soft)',
  fontSize: '0.76rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '7px 12px',
  color: 'var(--ink)',
  verticalAlign: 'middle',
};
