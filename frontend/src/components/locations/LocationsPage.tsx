import { useState, useMemo } from 'react';
import { Search, Star, MapPin } from 'lucide-react';
import type { StoreMetrics } from '@retailflow/shared';

/* ── STR Gauge (semicircle) ─────────────────────────────────────── */
function StrGauge({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, percent));
  const R = 26; const cx = 32; const cy = 32;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const needleAngle = -180 + (p / 100) * 180;
  const fillEnd = { x: cx + R * Math.cos(toRad(needleAngle)), y: cy + R * Math.sin(toRad(needleAngle)) };
  const largeArc = p > 50 ? 1 : 0;
  const fillPath = p > 0 ? `M ${cx - R} ${cy} A ${R} ${R} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}` : '';
  const needleTip = { x: cx + (R - 5) * Math.cos(toRad(needleAngle)), y: cy + (R - 5) * Math.sin(toRad(needleAngle)) };
  const color = p >= 70 ? '#059669' : p >= 50 ? '#1d4ed8' : p >= 30 ? '#d97706' : '#dc2626';
  const label = p >= 70 ? 'Mükemmel' : p >= 50 ? 'İyi' : p >= 30 ? 'Normal' : 'Düşük';
  return (
    <div className="loc-gauge-wrap">
      <svg width="64" height="38" viewBox="0 0 64 38" fill="none">
        <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} stroke="#e3e7ef" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        {fillPath && <path d={fillPath} stroke={color} strokeWidth="4.5" fill="none" strokeLinecap="round" />}
        <circle cx={needleTip.x} cy={needleTip.y} r="3" fill={color} />
        <circle cx={cx} cy={cy} r="2.5" fill="#8d9aab" />
      </svg>
      <div className="loc-gauge-info">
        <span style={{ color, fontWeight: 600, fontSize: '0.78rem' }}>{label}</span>
        <span className="loc-gauge-pct">%{p}</span>
      </div>
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
        <span style={{ color: 'var(--green)' }}>{sales.toLocaleString('tr-TR')} sat.</span>
        <span style={{ color: 'var(--ink-muted)' }}>{inventory.toLocaleString('tr-TR')} stok</span>
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
      {Math.round(days)} gün
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
type SortKey = 'name' | 'str' | 'sales' | 'inventory' | 'cover' | 'products';
type SortDir = 'asc' | 'desc';

interface Props {
  stores: StoreMetrics[];
  isLoading: boolean;
}

export function LocationsPage({ stores, isLoading }: Props) {
  const [search, setSearch]   = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('str');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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
      if (sortKey === 'products')  diff = a.productCount - b.productCount;
      return sortDir === 'desc' ? -diff : diff;
    });
  }, [stores, search, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  const SortInd = ({ k }: { k: SortKey }) =>
    sortKey === k ? <span className="prd-sort-indicator">{sortDir === 'desc' ? '↓' : '↑'}</span> : null;

  // Stats
  const totalSales     = stores.reduce((s, x) => s + x.totalSales, 0);
  const totalInventory = stores.reduce((s, x) => s + x.totalInventory, 0);
  const avgStr         = stores.length ? Math.round(stores.reduce((s, x) => s + x.strPercent, 0) / stores.length) : 0;
  const bestStore      = stores.length ? [...stores].sort((a, b) => b.strPercent - a.strPercent)[0] : null;
  const avgCover       = (() => {
    const valid = stores.filter((s) => s.coverDays != null);
    return valid.length ? Math.round(valid.reduce((s, x) => s + (x.coverDays ?? 0), 0) / valid.length) : null;
  })();

  const strColor = avgStr >= 70 ? '#059669' : avgStr >= 50 ? '#1d4ed8' : avgStr >= 30 ? '#d97706' : '#dc2626';

  return (
    <div className="rf-page">
      {/* Header */}
      <div className="rf-page-header">
        <div>
          <p className="rf-page-eyebrow">Mağaza Ağı</p>
          <h1 className="rf-page-title">Lokasyonlar</h1>
          <p className="rf-page-subtitle">
            {stores.length > 0 ? `${stores.length} lokasyonun satış ve stok performansı` : 'Lokasyon performans tablosu'}
          </p>
        </div>
        <div className="prd-search-wrap">
          <Search size={15} className="prd-search-icon" />
          <input
            className="prd-search-input"
            type="text"
            placeholder="Lokasyon ara..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
          />
        </div>
      </div>

      {/* Stat Bar */}
      <div className="prd-stat-bar">
        <StatCard label="Toplam Lokasyon" value={stores.length} sub="aktif mağaza" />
        <StatCard
          label="En İyi Performans"
          value={bestStore?.name ?? '—'}
          sub={bestStore ? `STR %${bestStore.strPercent}` : undefined}
          accent="#1d4ed8"
        />
        <StatCard
          label="Ortalama STR"
          value={`%${avgStr}`}
          sub={avgStr >= 70 ? 'Mükemmel' : avgStr >= 50 ? 'İyi' : avgStr >= 30 ? 'Normal' : 'Düşük'}
          accent={strColor}
        />
        <StatCard label="Toplam Satış" value={totalSales.toLocaleString('tr-TR')} sub="adet" />
        <StatCard
          label="Ort. Cover Days"
          value={avgCover != null ? `${avgCover} gün` : '—'}
          sub="stok kapama süresi"
        />
      </div>

      {/* Table */}
      <div className="prd-table-card">
        <div className="prd-table-toolbar">
          <span className="prd-table-count">
            {filtered.length} lokasyon{search ? ` · "${search}" için` : ''}
          </span>
        </div>

        <div className="rf-table-wrap">
          <table className="rf-table loc-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th className="prd-th-sortable" onClick={() => handleSort('name')}>
                  Lokasyon <SortInd k="name" />
                </th>
                <th className="prd-th-sortable" onClick={() => handleSort('str')}>
                  STR Performans <SortInd k="str" />
                </th>
                <th className="prd-th-sortable" onClick={() => handleSort('sales')}>
                  Satış / Stok Dağılımı <SortInd k="sales" />
                </th>
                <th className="prd-th-sortable" onClick={() => handleSort('inventory')}>
                  Stok <SortInd k="inventory" />
                </th>
                <th className="prd-th-sortable" onClick={() => handleSort('products')}>
                  Ürün <SortInd k="products" />
                </th>
                <th className="prd-th-sortable" onClick={() => handleSort('cover')}>
                  Cover Days <SortInd k="cover" />
                </th>
                <th>Tür</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="prd-loading-cell">Yükleniyor...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 0 }}>
                    <div className="prd-empty">
                      <MapPin size={36} strokeWidth={1.2} />
                      <p>{stores.length === 0 ? 'Henüz veri yüklenmedi.' : 'Arama ile eşleşen lokasyon bulunamadı.'}</p>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((store, i) => (
                <tr key={store.name}>
                  <td><span className="prd-row-num">{i + 1}</span></td>
                  <td>
                    <div className="loc-name-cell">
                      <strong>{store.name}</strong>
                      {store.isPrioritySource && (
                        <span className="loc-priority-dot" title="Öncelikli kaynak">
                          <Star size={11} fill="currentColor" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td><StrGauge percent={store.strPercent} /></td>
                  <td><InventoryBar sales={store.totalSales} inventory={store.totalInventory} /></td>
                  <td>
                    <strong>{store.totalInventory.toLocaleString('tr-TR')}</strong>
                    <small>
                      {store.excessInventory > 0
                        ? `${store.excessInventory.toLocaleString('tr-TR')} fazla`
                        : 'dengeli'}
                    </small>
                  </td>
                  <td>
                    <strong>{store.productCount.toLocaleString('tr-TR')}</strong>
                    <small>SKU</small>
                  </td>
                  <td><CoverBadge days={store.coverDays} /></td>
                  <td>
                    <span className={`prd-badge ${store.isPrioritySource ? 'prd-badge-blue' : 'prd-badge-green'}`}>
                      {store.isPrioritySource ? 'Merkez/Online' : 'Mağaza'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
