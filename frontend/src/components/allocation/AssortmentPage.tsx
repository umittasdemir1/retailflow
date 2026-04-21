import { useState } from 'react';
import { Panel } from '../ui/Panel';
import { useSeries, useAssortmentRules, useAssortmentMutations, type AssortmentRule } from '../../hooks/useAllocation';
import { Plus, Trash2, Package, Tag } from 'lucide-react';

function RuleRow({ rule, seriesName, onDelete }: { rule: AssortmentRule; seriesName: string; onDelete: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line-strong)' }}>
      <span style={{ color: rule.type === 'product' ? 'var(--accent)' : 'var(--ink-soft)', flexShrink: 0 }}>
        {rule.type === 'product' ? <Package size={16} /> : <Tag size={16} />}
      </span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--ink)' }}>{rule.targetName}</p>
        <p style={{ fontSize: '0.74rem', color: 'var(--ink-soft)', marginTop: 1 }}>
          {rule.type === 'product' ? 'Ürün' : 'Kategori'} → <strong>{seriesName}</strong>
        </p>
      </div>
      <button type="button" className="rf-icon-btn rf-icon-btn--danger" title="Sil" onClick={onDelete}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export function AssortmentPage() {
  const { data: rules = [], isLoading: rulesLoading } = useAssortmentRules();
  const { data: series = [] } = useSeries();
  const { add, remove } = useAssortmentMutations();

  const [type, setType] = useState<'product' | 'category'>('product');
  const [targetName, setTargetName] = useState('');
  const [seriesId, setSeriesId] = useState('');

  function handleAdd() {
    if (!targetName.trim() || !seriesId) return;
    add.mutate(
      { type, targetName: targetName.trim(), seriesId },
      { onSuccess: () => setTargetName('') },
    );
  }

  function getSeriesName(id: string) {
    return series.find((s) => s.id === id)?.name ?? id;
  }

  const productRules = rules.filter((r) => r.type === 'product');
  const categoryRules = rules.filter((r) => r.type === 'category');

  return (
    <div className="rf-page">
      <div className="rf-page-header">
        <div>
          <p className="rf-page-eyebrow">Tahsisat Sistemi</p>
          <h1 className="rf-page-title">Asorti Kuralları</h1>
          <p className="rf-page-subtitle">Ürün veya kategorilere hangi serinin uygulanacağını tanımla.</p>
        </div>
      </div>

      <div className="rf-page-analysis-grid">
        <Panel title="Yeni Kural" subtitle="Ürün adı veya kategori bazlı kural ekle.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="rf-mode-row">
              <button
                type="button"
                className={`rf-mode-button${type === 'product' ? ' is-active' : ''}`}
                onClick={() => setType('product')}
              >
                <Package size={14} style={{ marginRight: 6 }} />Ürün
              </button>
              <button
                type="button"
                className={`rf-mode-button${type === 'category' ? ' is-active' : ''}`}
                onClick={() => setType('category')}
              >
                <Tag size={14} style={{ marginRight: 6 }} />Kategori
              </button>
            </div>

            <label className="rf-field">
              <span>{type === 'product' ? 'Ürün Adı' : 'Kategori Adı'}</span>
              <input
                type="text"
                className="rf-text-input"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder={type === 'product' ? 'Örn: NOLAN JACKET' : 'Örn: KABAN'}
              />
            </label>

            <label className="rf-field">
              <span>Seri</span>
              <select
                className="rf-select"
                value={seriesId}
                onChange={(e) => setSeriesId(e.target.value)}
              >
                <option value="">Seri seç...</option>
                {series.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="rf-primary-button"
              disabled={!targetName.trim() || !seriesId || add.isPending}
              onClick={handleAdd}
            >
              <Plus size={15} style={{ marginRight: 6 }} />Kural Ekle
            </button>
          </div>
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title="Ürün Kuralları" subtitle={`${productRules.length} kural — ürün seviyesi önceliklidir`}>
            {rulesLoading && <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>Yükleniyor...</p>}
            {!rulesLoading && productRules.length === 0 && (
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Ürün kuralı yok.</p>
            )}
            {productRules.map((r) => (
              <RuleRow key={r.id} rule={r} seriesName={getSeriesName(r.seriesId)} onDelete={() => remove.mutate(r.id)} />
            ))}
          </Panel>

          <Panel title="Kategori Kuralları" subtitle={`${categoryRules.length} kural`}>
            {!rulesLoading && categoryRules.length === 0 && (
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Kategori kuralı yok.</p>
            )}
            {categoryRules.map((r) => (
              <RuleRow key={r.id} rule={r} seriesName={getSeriesName(r.seriesId)} onDelete={() => remove.mutate(r.id)} />
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}
