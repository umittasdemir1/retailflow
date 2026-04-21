import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, MapPin, ChartSpline, ShoppingCart, Box, Clock, Star, ListFilter } from 'lucide-react';
import type { StoreMetrics } from '@retailflow/shared';

/* ── STR Gauge (pill) ───────────────────────────────────────────── */
function StrGauge({ percent }: { percent: number }) {
  const p         = Math.max(0, Math.min(100, percent));
  const color     = '#16a34a';
  const emptyColor = '#e8f5e9';
  const TOTAL  = 25;
  const filled = Math.round((p / 100) * TOTAL);
  const R = 38; const CX = 50; const CY = 50;
  const PW = 2.5; const PH = 16; const RX = 1.8;
  const pills = Array.from({ length: TOTAL }, (_, i) => {
    const deg = 180 - (i / (TOTAL - 1)) * 180;
    const rad = (deg * Math.PI) / 180;
    return { x: CX + R * Math.cos(rad), y: CY - R * Math.sin(rad), rot: 90 - deg, on: i < filled };
  });
  return (
    <div className="prd-gauge-wrap">
      <svg width="100" height="56" viewBox="0 0 100 56" fill="none">
        {pills.map((pill, i) => (
          <rect
            key={i}
            x={pill.x - PW / 2} y={pill.y - PH / 2}
            width={PW} height={PH} rx={RX}
            fill={pill.on ? color : emptyColor}
            transform={`rotate(${pill.rot}, ${pill.x}, ${pill.y})`}
          />
        ))}
      </svg>
    </div>
  );
}

/* ── Inventory Bar ──────────────────────────────────────────────── */
function InventoryBar({ sales, inventory }: { sales: number; inventory: number }) {
  const total = sales + inventory;
  if (total === 0) return <span style={{ color: 'var(--ink-muted)', fontSize: '0.78rem' }}>—</span>;
  const salePct = Math.round((sales / total) * 100);
  return (
    <div className="loc-inv-bar-wrap">
      <div className="loc-inv-bar">
        <div className="loc-inv-bar-fill" style={{ width: `${salePct}%` }} />
      </div>
      <div className="loc-inv-bar-labels">
        <span style={{ color: 'var(--green)' }}>{sales.toLocaleString('tr-TR')} sold</span>
        <span style={{ color: 'var(--ink-muted)' }}>{inventory.toLocaleString('tr-TR')} stock</span>
      </div>
    </div>
  );
}

/* ── Cover Days Badge ───────────────────────────────────────────── */
function CoverBadge({ days }: { days: number | null }) {
  if (days == null) return <span className="loc-cover-na">—</span>;
  const color = days <= 7 ? '#dc2626' : days <= 30 ? '#d97706' : '#059669';
  const bg    = days <= 7 ? '#fef2f2' : days <= 30 ? '#fffbeb' : '#ecfdf5';
  return (
    <span className="loc-cover-badge" style={{ color, background: bg }}>
      {Math.round(days)} days
    </span>
  );
}

/* ── Stat Card ──────────────────────────────────────────────────── */
function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="prd-stat-card">
      <span className="prd-stat-label">{label}</span>
      <strong className="prd-stat-value" style={accent ? { color: accent } : undefined}>{value}</strong>
      {sub && <small className="prd-stat-sub">{sub}</small>}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────── */
type SortKey = 'name' | 'str' | 'sales' | 'inventory' | 'cover';
type SortDir = 'asc' | 'desc';

interface Props {
  stores: StoreMetrics[];
  isLoading: boolean;
}

const PAGE_SIZE = 10;

export function LocationsPage({ stores, isLoading }: Props) {
  const [search, setSearch]     = useState('');
  const [sortKey, setSortKey]   = useState<SortKey>('str');
  const [sortDir, setSortDir]   = useState<SortDir>('desc');
  const [page, setPage]         = useState(1);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'name',      label: 'Location Name' },
    { key: 'str',       label: 'Performance' },
    { key: 'sales',     label: 'Sales' },
    { key: 'inventory', label: 'Stock' },
    { key: 'cover',     label: 'Cover Days' },
  ];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = q ? stores.filter((s) => s.name.toLowerCase().includes(q)) : stores;
    return [...list].sort((a, b) => {
      let diff = 0;
      if (sortKey === 'name')      diff = a.name.localeCompare(b.name, 'tr');
      if (sortKey === 'str')       diff = a.strPercent - b.strPercent;
      if (sortKey === 'sales')     diff = a.totalSales - b.totalSales;
      if (sortKey === 'inventory') diff = a.totalInventory - b.totalInventory;
      if (sortKey === 'cover')     diff = (a.coverDays ?? 0) - (b.coverDays ?? 0);
      return sortDir === 'desc' ? -diff : diff;
    });
  }, [stores, search, sortKey, sortDir]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows        = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  }

  const totalSales = stores.reduce((s, x) => s + x.totalSales, 0);
  const avgStr     = stores.length ? Math.round(stores.reduce((s, x) => s + x.strPercent, 0) / stores.length) : 0;
  const bestStore  = stores.length ? [...stores].sort((a, b) => b.strPercent - a.strPercent)[0] : null;
  const avgCover   = (() => {
    const valid = stores.filter((s) => s.coverDays != null);
    return valid.length ? Math.round(valid.reduce((s, x) => s + (x.coverDays ?? 0), 0) / valid.length) : null;
  })();
  const strColor = avgStr >= 70 ? '#059669' : avgStr >= 50 ? '#1d4ed8' : avgStr >= 30 ? '#d97706' : '#dc2626';

  return (
    <div className="rf-page">

      {/* Header */}
      <div className="rf-page-header">
        <div>
          <p className="rf-page-eyebrow">Store Network</p>
          <h1 className="rf-page-title">Locations</h1>
        </div>
        <div className="prd-header-actions">
          <div className="prd-search-wrap">
            <Search size={15} className="prd-search-icon" />
            <input
              className="prd-search-input"
              type="text"
              placeholder="Search location..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="prd-sort-wrap" ref={sortRef}>
            <button className="prd-sort-btn" onClick={() => setSortOpen((o) => !o)}>
              <ListFilter size={15} strokeWidth={1.8} />
              <span>Sort By</span>
            </button>
            {sortOpen && (
              <div className="prd-sort-dropdown">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.key}
                    className={`prd-sort-option${sortKey === opt.key ? ' is-active' : ''}`}
                    onClick={() => { handleSort(opt.key); setSortOpen(false); }}
                  >
                    {opt.label}
                    {sortKey === opt.key && <span className="prd-sort-dir">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stat Bar */}
      <div className="prd-stat-bar">
        <StatCard label="Total Locations"   value={stores.length} sub="active stores" />
        <StatCard label="Top Performance"   value={bestStore?.name ?? '—'} sub={bestStore ? `STR %${bestStore.strPercent}` : undefined} accent="#1d4ed8" />
        <StatCard label="Avg. STR"          value={`%${avgStr}`} sub={avgStr >= 70 ? 'Excellent' : avgStr >= 50 ? 'Good' : avgStr >= 30 ? 'Normal' : 'Low'} accent={strColor} />
        <StatCard label="Total Sales"       value={totalSales.toLocaleString('tr-TR')} sub="items" />
        <StatCard label="Avg. Cover Days"   value={avgCover != null ? `${avgCover} days` : '—'} sub="inventory coverage" />
      </div>

      {/* Table */}
      <div className="prd-table-card">
        <div className="rf-table-wrap">
          <table className="rf-table loc-table">
            <tbody>
              {isLoading && (
                <tr><td colSpan={11} className="prd-loading-cell">Loading...</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: 0 }}>
                    <div className="prd-empty">
                      <MapPin size={40} strokeWidth={1.2} />
                      <p>{stores.length === 0 ? 'No data loaded yet.' : 'No locations match your search.'}</p>
                    </div>
                  </td>
                </tr>
              )}
              {rows.map((store) => (
                <LocationRow key={store.name} store={store} />
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="prd-pagination">
            <button type="button" className="prd-page-btn" disabled={currentPage === 1} onClick={() => setPage((p) => p - 1)}>
              ← Previous
            </button>
            <span className="prd-page-info">
              Page {currentPage} / {totalPages}
              <span style={{ color: 'var(--ink-muted)', marginLeft: 8 }}>({filtered.length.toLocaleString('tr-TR')} locations)</span>
            </span>
            <button type="button" className="prd-page-btn" disabled={currentPage === totalPages} onClick={() => setPage((p) => p + 1)}>
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Location Row ───────────────────────────────────────────────── */
function LocationRow({ store }: { store: StoreMetrics }) {
  const strLevel = store.strPercent >= 70 ? 'Excellent' : store.strPercent >= 50 ? 'Good' : store.strPercent >= 30 ? 'Normal' : 'Low';

  return (
    <tr>
      {/* Location */}
      <td>
        <strong className="loc-name-cell">
          {store.name.toUpperCase()}
          {store.isPrioritySource && (
            <span className="loc-priority-dot" title="Priority source" style={{ marginLeft: 6 }}>
              <Star size={11} fill="currentColor" />
            </span>
          )}
        </strong>
      </td>

      <td className="prd-col-sep"><span>|</span></td>

      {/* STR Performance */}
      <td className="prd-perf-td">
        <div className="prd-perf-cell">
          <div className="prd-perf-info">
            <strong className="prd-perf-title">
              Performance <span className="prd-perf-label">{strLevel}</span>
            </strong>
            <div className="prd-perf-stats">
              <ChartSpline size={18} strokeWidth={1.8} />
              <span>%{store.strPercent}</span>
              <span className="prd-perf-sep">|</span>
              <ShoppingCart size={18} strokeWidth={1.8} />
              <span>{store.totalSales.toLocaleString('tr-TR')}</span>
            </div>
          </div>
          <StrGauge percent={store.strPercent} />
        </div>
      </td>

      <td className="prd-col-sep"><span>|</span></td>

      {/* Sales / Stock */}
      <td className="prd-stock-cell">
        <div className="prd-stock-info">
          <strong className="prd-perf-title">Sales / Stock</strong>
          <InventoryBar sales={store.totalSales} inventory={store.totalInventory} />
        </div>
      </td>

      <td className="prd-col-sep"><span>|</span></td>

      {/* Inventory */}
      <td>
        <div className="prd-stock-info">
          <strong className="prd-perf-title">Stock</strong>
          <div className="prd-perf-stats">
            <Box size={18} strokeWidth={1.8} />
            <span>{store.totalInventory.toLocaleString('tr-TR')}</span>
          </div>
        </div>
      </td>

      <td className="prd-col-sep"><span>|</span></td>

      {/* Cover Days */}
      <td>
        <div className="prd-stock-info">
          <strong className="prd-perf-title">Cover Days</strong>
          <div className="prd-perf-stats">
            <Clock size={18} strokeWidth={1.8} />
            <CoverBadge days={store.coverDays} />
          </div>
        </div>
      </td>
    </tr>
  );
}
