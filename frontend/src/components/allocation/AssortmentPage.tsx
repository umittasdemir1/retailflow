import { useState, useMemo } from 'react';
import { useSeries, useAssortmentRules, useAssortmentMutations, type AssortmentRule } from '../../hooks/useAllocation';
import { useProducts } from '../../hooks/useStores';
import { Plus, Trash2, Package, Tag, List } from 'lucide-react';

const TYPE_LABEL = { product: 'Ürün', category: 'Kategori' };

export function AssortmentPage() {
  const { data: rules = [], isLoading } = useAssortmentRules();
  const { data: series = [] } = useSeries();
  const { data: productsData } = useProducts();
  const { add, remove } = useAssortmentMutations();

  const [type, setType] = useState<'product' | 'category'>('product');
  const [targetName, setTargetName] = useState('');
  const [seriesId, setSeriesId] = useState('');

  const products = productsData?.products ?? [];
  const productNames = useMemo(() => [...new Set(products.map((p) => p.productName))].sort(), [products]);
  const categories   = useMemo(() => [...new Set(products.map((p) => p.category).filter((c): c is string => c !== null))].sort(), [products]);
  const options = type === 'product' ? productNames : categories;

  function handleAdd() {
    if (!targetName.trim() || !seriesId) return;
    add.mutate({ type, targetName: targetName.trim(), seriesId }, { onSuccess: () => setTargetName('') });
  }

  function getSeriesName(id: string) { return series.find((s) => s.id === id)?.name ?? '—'; }

  function TypeBadge({ t }: { t: AssortmentRule['type'] }) {
    return (
      <span className={`alc-type-badge alc-type-badge--${t}`}>
        {t === 'product' ? <Package size={11} /> : <Tag size={11} />}
        {TYPE_LABEL[t]}
      </span>
    );
  }

  return (
    <div className="rf-page">
      <div className="rf-page-header">
        <div>
          <p className="rf-page-eyebrow">Tahsisat Sistemi</p>
          <h1 className="rf-page-title">Asorti Kuralları</h1>
          <p className="rf-page-subtitle">Ürün veya kategorilere seri ata. Ürün kuralı kategori kuralına göre önceliklidir.</p>
        </div>
      </div>

      <div className="alc-page-layout">
        {/* ── Form ── */}
        <div className="prd-table-card" style={{ padding: 22 }}>
          <div className="alc-form-title"><List size={16} /><span>Yeni Kural</span></div>
          <div className="alc-form">
            <div className="alc-form-field">
              <label className="alc-label">Tür</label>
              <div className="rf-mode-row">
                <button type="button" className={`rf-mode-button${type === 'product' ? ' is-active' : ''}`} onClick={() => { setType('product'); setTargetName(''); }}>
                  <Package size={13} style={{ marginRight: 5 }} />Ürün
                </button>
                <button type="button" className={`rf-mode-button${type === 'category' ? ' is-active' : ''}`} onClick={() => { setType('category'); setTargetName(''); }}>
                  <Tag size={13} style={{ marginRight: 5 }} />Kategori
                </button>
              </div>
            </div>

            <div className="alc-form-field">
              <label className="alc-label">{type === 'product' ? 'Ürün' : 'Kategori'}</label>
              {options.length > 0
                ? <select className="rf-select" value={targetName} onChange={(e) => setTargetName(e.target.value)}>
                    <option value="">{type === 'product' ? 'Ürün seç…' : 'Kategori seç…'}</option>
                    {options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                : <input type="text" className="rf-text-input" value={targetName} onChange={(e) => setTargetName(e.target.value)} placeholder={type === 'product' ? 'Ürün adı' : 'Kategori adı'} />
              }
            </div>

            <div className="alc-form-field">
              <label className="alc-label">Seri</label>
              <select className="rf-select" value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
                <option value="">Seri seç…</option>
                {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <button type="button" className="rf-primary-button" disabled={!targetName.trim() || !seriesId || add.isPending} onClick={handleAdd}>
              <Plus size={14} style={{ marginRight: 6 }} />Kural Ekle
            </button>
          </div>
        </div>

        {/* ── Rules Table ── */}
        <div className="prd-table-card">
          <div className="prd-table-toolbar">
            <span className="prd-table-count">{rules.length} kural</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="alc-type-badge alc-type-badge--product"><Package size={11} />Ürün öncelikli</span>
            </div>
          </div>
          <div className="rf-table-wrap" style={{ borderRadius: 0, border: 'none' }}>
            <table className="rf-table">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Tür</th>
                  <th>Hedef</th>
                  <th>Seri</th>
                  <th style={{ width: 56 }} />
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={4} className="prd-loading-cell">Yükleniyor…</td></tr>}
                {!isLoading && rules.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 0 }}>
                    <div className="prd-empty"><List size={36} strokeWidth={1.2} /><p>Henüz kural tanımlanmamış.</p></div>
                  </td></tr>
                )}
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td><TypeBadge t={r.type} /></td>
                    <td><strong>{r.targetName}</strong></td>
                    <td><span className="alc-series-pill">{getSeriesName(r.seriesId)}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="rf-icon-btn rf-icon-btn--danger" onClick={() => remove.mutate(r.id)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
