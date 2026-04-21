import { useState, useMemo } from 'react';
import { Panel } from '../ui/Panel';
import { useSeries, useAllocations, useAllocationMutations, type StoreAllocation } from '../../hooks/useAllocation';
import { useStores, useProducts } from '../../hooks/useStores';
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

function AllocationRow({
  alloc,
  seriesName,
  onToggle,
  onDelete,
  onSeriesCountChange,
}: {
  alloc: StoreAllocation;
  seriesName: string;
  onToggle: () => void;
  onDelete: () => void;
  onSeriesCountChange: (count: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line-strong)', fontSize: '0.84rem' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {alloc.productName}
        </p>
        <p style={{ color: 'var(--ink-soft)', marginTop: 1, fontSize: '0.76rem' }}>
          {alloc.color}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{seriesName}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>×</span>
        <input
          type="number"
          min={1}
          step={1}
          value={alloc.seriesCount}
          onChange={(e) => onSeriesCountChange(Number(e.target.value))}
          style={{ width: 46, textAlign: 'center', padding: '3px 5px', borderRadius: 5, border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: '0.83rem' }}
        />
      </div>
      <button type="button" onClick={onToggle} title={alloc.enabled ? 'Devre dışı bırak' : 'Etkinleştir'} style={{ color: alloc.enabled ? 'var(--accent)' : 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
        {alloc.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
      </button>
      <button type="button" className="rf-icon-btn rf-icon-btn--danger" title="Sil" onClick={onDelete}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function AllocationPage() {
  const { data: allocations = [], isLoading } = useAllocations();
  const { data: series = [] } = useSeries();
  const { data: stores = [] } = useStores();
  const { data: productsData } = useProducts();
  const { add, update, remove } = useAllocationMutations();

  const [storeName, setStoreName] = useState('');
  const [productName, setProductName] = useState('');
  const [color, setColor] = useState('');
  const [seriesId, setSeriesId] = useState('');
  const [seriesCount, setSeriesCount] = useState(1);
  const [filter, setFilter] = useState('');

  const storeNames = useMemo(() => stores.map((s) => s.name).sort(), [stores]);

  const products = productsData?.products ?? [];

  const productNames = useMemo(
    () => [...new Set(products.map((p) => p.productName))].sort(),
    [products],
  );

  const colorsForProduct = useMemo(() => {
    if (!productName) return [];
    return [...new Set(products.filter((p) => p.productName === productName).map((p) => p.colors).flat())].sort();
  }, [products, productName]);

  function handleProductChange(name: string) {
    setProductName(name);
    setColor('');
  }

  function handleAdd() {
    if (!storeName || !productName || !color || !seriesId) return;
    add.mutate(
      { storeName, productName, color, seriesId, seriesCount, enabled: true },
      {
        onSuccess: () => {
          setProductName('');
          setColor('');
          setSeriesCount(1);
        },
      },
    );
  }

  function getSeriesName(id: string) {
    return series.find((s) => s.id === id)?.name ?? '—';
  }

  const filtered = useMemo(() => {
    if (!filter.trim()) return allocations;
    const q = filter.toLowerCase();
    return allocations.filter(
      (a) =>
        a.storeName.toLowerCase().includes(q) ||
        a.productName.toLowerCase().includes(q) ||
        a.color.toLowerCase().includes(q),
    );
  }, [allocations, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, StoreAllocation[]>();
    for (const a of filtered) {
      const list = map.get(a.storeName) ?? [];
      list.push(a);
      map.set(a.storeName, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const noData = storeNames.length === 0 || productNames.length === 0;

  return (
    <div className="rf-page">
      <div className="rf-page-header">
        <div>
          <p className="rf-page-eyebrow">Tahsisat Sistemi</p>
          <h1 className="rf-page-title">Mağaza Tahsisatları</h1>
          <p className="rf-page-subtitle">Her mağaza × ürün × renk için hedef stok miktarı.</p>
        </div>
      </div>

      <div className="rf-page-analysis-grid">
        <Panel title="Yeni Tahsisat" subtitle={noData ? 'Önce veri yükle.' : 'Mağaza, ürün, renk ve seri seç.'}>
          {noData ? (
            <p style={{ fontSize: '0.84rem', color: 'var(--ink-muted)' }}>
              Mağaza ve ürün listesi için önce bir Excel/CSV dosyası yükle.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="rf-field">
                <span>Mağaza</span>
                <select className="rf-select" value={storeName} onChange={(e) => setStoreName(e.target.value)}>
                  <option value="">Mağaza seç...</option>
                  {storeNames.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>

              <label className="rf-field">
                <span>Ürün</span>
                <select className="rf-select" value={productName} onChange={(e) => handleProductChange(e.target.value)}>
                  <option value="">Ürün seç...</option>
                  {productNames.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>

              <label className="rf-field">
                <span>Renk</span>
                <select className="rf-select" value={color} onChange={(e) => setColor(e.target.value)} disabled={!productName}>
                  <option value="">Renk seç...</option>
                  {colorsForProduct.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>

              <label className="rf-field">
                <span>Seri</span>
                <select className="rf-select" value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
                  <option value="">Seri seç...</option>
                  {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>

              <label className="rf-field">
                <span>Seri Adedi</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="rf-text-input"
                  value={seriesCount}
                  onChange={(e) => setSeriesCount(Math.max(1, Number(e.target.value)))}
                />
              </label>

              <button
                type="button"
                className="rf-primary-button"
                disabled={!storeName || !productName || !color || !seriesId || add.isPending}
                onClick={handleAdd}
              >
                <Plus size={15} style={{ marginRight: 6 }} />Ekle
              </button>
            </div>
          )}
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              className="rf-text-input"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Mağaza, ürün veya renk filtrele..."
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
              {allocations.length} kayıt
            </span>
          </div>

          {isLoading && <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>Yükleniyor...</p>}
          {!isLoading && allocations.length === 0 && (
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Henüz tahsisat tanımlanmamış.</p>
          )}

          {grouped.map(([store, items]) => (
            <Panel key={store} title={store} subtitle={`${items.length} kayıt`}>
              {items.map((a) => (
                <AllocationRow
                  key={a.id}
                  alloc={a}
                  seriesName={getSeriesName(a.seriesId)}
                  onToggle={() => update.mutate({ id: a.id, data: { enabled: !a.enabled } })}
                  onDelete={() => remove.mutate(a.id)}
                  onSeriesCountChange={(count) => update.mutate({ id: a.id, data: { seriesCount: count } })}
                />
              ))}
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
}
