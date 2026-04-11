import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Package, ChartSpline, ShoppingCart, Box, ListFilter, DollarSign, Tag } from 'lucide-react';
import type { ProductSummary, ProductsResponse } from '../../lib/api';

/* ── Product Thumbnail ──────────────────────────────────────────── */
function ProductThumb({ url, name }: { url: string | null; name: string }) {
  const [errored, setErrored] = useState(false);
  const initial = name.charAt(0).toUpperCase();

  if (url && !errored) {
    return (
      <img
        src={url}
        alt={name}
        className="prd-thumb"
        onError={() => setErrored(true)}
      />
    );
  }
  return (
    <div className="prd-thumb prd-thumb-placeholder">
      <span>{initial}</span>
    </div>
  );
}

/* ── STR Gauge ──────────────────────────────────────────────────── */
function StrGauge({ percent }: { percent: number }) {
  const p   = Math.max(0, Math.min(100, percent));
  const color      = '#16a34a';
  const emptyColor = '#e8f5e9';
  const label      = p >= 70 ? 'Excellent' : p >= 50 ? 'Good'  : p >= 30 ? 'Normal'  : 'Low';

  const TOTAL  = 25;
  const filled = Math.round((p / 100) * TOTAL);
  const R  = 38;     // arc radius (center of pill)
  const CX = 50; const CY = 50;
  const PW = 2.5;    // tangential (thin)
  const PH = 16;     // radial (tall tick)
  const RX = 1.8;

  const pills = Array.from({ length: TOTAL }, (_, i) => {
    const deg = 180 - (i / (TOTAL - 1)) * 180;
    const rad = (deg * Math.PI) / 180;
    return {
      x:   CX + R * Math.cos(rad),
      y:   CY - R * Math.sin(rad),
      rot: 90 - deg,   // long axis (PH) radyal yönde
      on:  i < filled,
    };
  });

  return (
    <div className="prd-gauge-wrap">
      <svg width="100" height="56" viewBox="0 0 100 56" fill="none">
        {pills.map((pill, i) => (
          <rect
            key={i}
            x={pill.x - PW / 2}
            y={pill.y - PH / 2}
            width={PW}
            height={PH}
            rx={RX}
            fill={pill.on ? color : emptyColor}
            transform={`rotate(${pill.rot}, ${pill.x}, ${pill.y})`}
          />
        ))}
      </svg>
    </div>
  );
}

/* ── Visibility Toggle ──────────────────────────────────────────── */
function VisibilityToggle({ active }: { active: boolean }) {
  return (
    <div className={`prd-toggle${active ? ' is-on' : ''}`}>
      <div className="prd-toggle-thumb" />
    </div>
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
type SortKey = 'name' | 'str' | 'inventory' | 'sales';
type SortDir = 'asc' | 'desc';

interface Props {
  data: ProductsResponse | undefined;
  isLoading: boolean;
}

const PAGE_SIZE = 10;

export function ProductsPage({ data, isLoading }: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('sales');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
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
    { key: 'name',      label: 'Product Name' },
    { key: 'sales',     label: 'Sales' },
    { key: 'str',       label: 'Performance' },
    { key: 'inventory', label: 'Stock' },
  ];

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    let list = q
      ? data.products.filter(p =>
          p.productName.toLowerCase().includes(q) ||
          p.colors.some(c => c.toLowerCase().includes(q))
        )
      : data.products;

    return [...list].sort((a, b) => {
      let diff = 0;
      if (sortKey === 'name')      diff = a.productName.localeCompare(b.productName, 'tr');
      if (sortKey === 'str')       diff = a.strPercent - b.strPercent;
      if (sortKey === 'inventory') diff = a.totalInventory - b.totalInventory;
      if (sortKey === 'sales')     diff = a.totalSales - b.totalSales;
      return sortDir === 'desc' ? -diff : diff;
    });
  }, [data, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  }

  const SortInd = ({ k }: { k: SortKey }) =>
    sortKey === k ? <span className="prd-sort-indicator">{sortDir === 'desc' ? '↓' : '↑'}</span> : null;

  const stats = data?.stats;
  const strLabel = (stats?.avgStrPercent ?? 0) >= 70 ? 'Excellent' : (stats?.avgStrPercent ?? 0) >= 50 ? 'Good' : (stats?.avgStrPercent ?? 0) >= 30 ? 'Normal' : 'Low';
  const strColor = (stats?.avgStrPercent ?? 0) >= 70 ? '#059669' : (stats?.avgStrPercent ?? 0) >= 50 ? '#1d4ed8' : (stats?.avgStrPercent ?? 0) >= 30 ? '#d97706' : '#dc2626';

  return (
    <div className="rf-page">

      {/* Header */}
      <div className="rf-page-header">
        <div>
          <p className="rf-page-eyebrow">Ürün Kataloğu</p>
          <h1 className="rf-page-title">All Product List</h1>
        </div>
        <div className="prd-header-actions">
          <div className="prd-search-wrap">
            <Search size={15} className="prd-search-icon" />
            <input
              className="prd-search-input"
              type="text"
              placeholder="Search Product"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="prd-sort-wrap" ref={sortRef}>
            <button className="prd-sort-btn" onClick={() => setSortOpen(o => !o)}>
              <ListFilter size={15} strokeWidth={1.8} />
              <span>Sort By</span>
            </button>
            {sortOpen && (
              <div className="prd-sort-dropdown">
                {sortOptions.map(opt => (
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

      {/* Product Statistic */}
      <div className="prd-stat-bar">
        <StatCard label="Active Product"    value={(stats?.totalProducts ?? 0).toLocaleString('tr-TR')} sub="unique codes" />
        <StatCard label="Winning Product"   value={stats?.bestSeller?.productName ?? '—'} sub={stats?.bestSeller ? stats.bestSeller.totalSales.toLocaleString('tr-TR') + ' sales' : undefined} accent="#1d4ed8" />
        <StatCard label="Average Performance" value={strLabel} sub={`STR: %${stats?.avgStrPercent ?? 0}`} accent={strColor} />
        <StatCard label="Product Sold"      value={(stats?.totalSold ?? 0).toLocaleString('tr-TR')} sub="items" />
        <StatCard label="Product Returned"  value={(stats?.totalReturned ?? 0).toLocaleString('tr-TR')} sub="items" />
      </div>

      {/* Table */}
      <div className="prd-table-card">
        <div className="rf-table-wrap">
          <table className="rf-table prd-table">
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="prd-loading-cell">Yükleniyor...</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <div className="prd-empty">
                      <Package size={40} strokeWidth={1.2} />
                      <p>{data?.products.length ? 'No products match your search.' : 'No data loaded yet.'}</p>
                    </div>
                  </td>
                </tr>
              )}
              {rows.map((product) => (
                <ProductRow key={product.productCode} product={product} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="prd-pagination">
            <button type="button" className="prd-page-btn" disabled={currentPage === 1} onClick={() => setPage(p => p - 1)}>
              ← Previous
            </button>
            <span className="prd-page-info">
              Page {currentPage} / {totalPages}
              <span style={{ color: 'var(--ink-muted)', marginLeft: 8 }}>({filtered.length.toLocaleString('tr-TR')} products)</span>
            </span>
            <button type="button" className="prd-page-btn" disabled={currentPage === totalPages} onClick={() => setPage(p => p + 1)}>
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Product Row ────────────────────────────────────────────────── */
function ProductRow({ product }: { product: ProductSummary }) {
  const isVisible = product.stockStatus !== 'KRITIK';

  return (
    <tr>
      {/* Product cell */}
      <td>
        <div className="prd-product-cell">
          <ProductThumb url={product.imageUrl} name={product.productName} />
          <div className="prd-product-info">
            <strong>{product.productName}</strong>
            {product.colors.length > 0 && (
              <span className="prd-product-colors">Opsiyon: <span className="prd-product-colors-num">{product.colors.length}</span></span>
            )}
          </div>
        </div>
      </td>

      <td className="prd-col-sep"><span>|</span></td>

      {/* Performance */}
      <td className="prd-perf-td">
        <div className="prd-perf-cell">
          <div className="prd-perf-info">
            <strong className="prd-perf-title">
              Performance <span className="prd-perf-label">{product.strPercent >= 70 ? 'Excellent' : product.strPercent >= 50 ? 'Good' : product.strPercent >= 30 ? 'Normal' : 'Low'}</span>
            </strong>
            <div className="prd-perf-stats">
              <ChartSpline size={18} strokeWidth={1.8} />
              <span>%{product.strPercent}</span>
              <span className="prd-perf-sep">|</span>
              <ShoppingCart size={18} strokeWidth={1.8} />
              <span>{product.totalSales.toLocaleString('tr-TR')}</span>
            </div>
          </div>
          <StrGauge percent={product.strPercent} />
        </div>
      </td>

      <td className="prd-col-sep"><span>|</span></td>

      {/* Stock */}
      <td className="prd-stock-cell">
        <div className="prd-stock-info">
          <strong className="prd-perf-title">Stock</strong>
          <div className="prd-perf-stats">
            <Box size={18} strokeWidth={1.8} />
            <span>{product.totalInventory.toLocaleString('tr-TR')}</span>
          </div>
        </div>
      </td>

      <td className="prd-col-sep"><span>|</span></td>

      {/* Product Price */}
      <td>
        <div className="prd-stock-info">
          <strong className="prd-perf-title">Product Price</strong>
          <div className="prd-perf-stats">
            <DollarSign size={18} strokeWidth={1.8} />
            <span>{product.price != null ? product.price.toLocaleString('tr-TR') : '—'}</span>
          </div>
        </div>
      </td>

      <td className="prd-col-sep"><span>|</span></td>

      {/* Category */}
      <td>
        <div className="prd-stock-info">
          <strong className="prd-perf-title">Category</strong>
          <div className="prd-perf-stats">
            <Tag size={16} strokeWidth={1.8} />
            <span style={{ fontSize: '0.75rem' }}>{product.category ?? '—'}</span>
          </div>
        </div>
      </td>
    </tr>
  );
}
