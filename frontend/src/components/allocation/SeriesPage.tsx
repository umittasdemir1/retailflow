import { useState, useMemo } from 'react';
import { useSeries, useSeriesMutations, useAssortmentRules, useAssortmentMutations, type Series } from '../../hooks/useAllocation';
import { useProducts } from '../../hooks/useStores';
import { Pencil, Trash2, Check, X, Plus, ChevronDown, ChevronRight } from 'lucide-react';

// ── Inline ratio editor for a series ────────────────────────────────────────

function RatioEditor({ series, onSave, onCancel }: {
  series: Series;
  onSave: (sizes: Record<string, number>) => void;
  onCancel: () => void;
}) {
  const [sizes, setSizes] = useState<Record<string, number>>(series.sizes);

  return (
    <div className="alc-form" style={{ maxWidth: 400 }}>
      <div className="alc-sizes-editor">
        <div className="alc-sizes-header"><span>Beden</span><span>Adet</span><span /></div>
        {Object.entries(sizes).map(([size, qty]) => (
          <div key={size} className="alc-sizes-row">
            <span className="alc-size-label">{size}</span>
            <input
              type="number" min={1} step={1} value={qty}
              className="alc-num-input"
              onChange={(e) => setSizes((p) => ({ ...p, [size]: Math.max(1, Number(e.target.value)) }))}
            />
            <button type="button" className="rf-icon-btn rf-icon-btn--danger"
              onClick={() => setSizes((p) => { const n = { ...p }; delete n[size]; return n; })}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <div className="alc-form-actions">
        <button type="button" className="rf-primary-button" onClick={() => onSave(sizes)}>
          <Check size={13} style={{ marginRight: 4 }} />Kaydet
        </button>
        <button type="button" className="rf-secondary-button" onClick={onCancel}>
          <X size={13} style={{ marginRight: 4 }} />İptal
        </button>
      </div>
    </div>
  );
}

// ── Category rule form ───────────────────────────────────────────────────────

function CategoryRuleForm({ series, categories, onSave, onCancel }: {
  series: Series[];
  categories: string[];
  onSave: (category: string, seriesId: string) => void;
  onCancel: () => void;
}) {
  const [cat, setCat] = useState('');
  const [sid, setSid] = useState('');
  return (
    <div className="alc-form" style={{ maxWidth: 400 }}>
      <div className="alc-form-field">
        <label className="alc-label">Kategori</label>
        <select className="rf-select" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Seç…</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="alc-form-field">
        <label className="alc-label">Seri</label>
        <select className="rf-select" value={sid} onChange={(e) => setSid(e.target.value)}>
          <option value="">Seç…</option>
          {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="alc-form-actions">
        <button type="button" className="rf-primary-button" disabled={!cat || !sid} onClick={() => onSave(cat, sid)}>
          <Check size={13} style={{ marginRight: 4 }} />Kaydet
        </button>
        <button type="button" className="rf-secondary-button" onClick={onCancel}>
          <X size={13} style={{ marginRight: 4 }} />İptal
        </button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function SeriesPage() {
  const { data: series = [], isLoading } = useSeries();
  const { update, remove } = useSeriesMutations();
  const { data: rules = [] } = useAssortmentRules();
  const { add: addRule, remove: removeRule } = useAssortmentMutations();
  const { data: productsData } = useProducts();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCatForm, setShowCatForm] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const categories = useMemo(
    () => [...new Set((productsData?.products ?? []).map((p) => p.category).filter((c): c is string => c !== null))].sort(),
    [productsData],
  );

  const productRules  = rules.filter((r) => r.type === 'product');
  const categoryRules = rules.filter((r) => r.type === 'category');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return series;
    return series.filter((s) => s.name.toLowerCase().includes(q));
  }, [series, search]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="rf-page">
      <div className="rf-page-header">
        <div>
          <p className="rf-page-eyebrow">Tahsisat Sistemi</p>
          <h1 className="rf-page-title">Seriler</h1>
          <p className="rf-page-subtitle">
            {isLoading ? 'Yükleniyor…' : `${series.length} seri · ${categoryRules.length} kategori kuralı`}
          </p>
        </div>
      </div>

      <div className="alc-page-layout" style={{ gridTemplateColumns: '1fr 340px' }}>

        {/* ── Ürün serileri ── */}
        <div className="rf-panel">
          <div className="rf-panel-header">
            <div>
              <h2>Ürün Serileri</h2>
              <p>Envanter yüklendiğinde otomatik oluşur. Adetleri düzenleyebilirsin.</p>
            </div>
            <input
              type="text" className="rf-text-input" placeholder="Ara…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 200, minHeight: 32 }}
            />
          </div>

          {isLoading && <p className="alc-loading">Yükleniyor…</p>}

          <div className="alc-series-list">
            {filtered.map((s) => {
              const linkedRule = productRules.find((r) => {
                const linkedSeries = series.find((x) => x.id === r.seriesId);
                return linkedSeries?.id === s.id;
              });
              const expanded = expandedIds.has(s.id);

              return (
                <div key={s.id} className="alc-series-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" onClick={() => toggleExpand(s.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--ink-muted)' }}>
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <div className="alc-series-info" style={{ flex: 1 }}>
                      <span className="alc-series-name">{s.name}</span>
                      {linkedRule && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginLeft: 6 }}>
                          → {linkedRule.targetName}
                        </span>
                      )}
                      <div className="alc-chips">
                        {Object.entries(s.sizes).map(([sz, r]) => (
                          <span key={sz} className="alc-chip">{sz} <em>×{r}</em></span>
                        ))}
                      </div>
                    </div>
                    <div className="alc-series-actions">
                      <button type="button" className="rf-icon-btn"
                        onClick={() => { setEditingId(editingId === s.id ? null : s.id); }}>
                        <Pencil size={14} />
                      </button>
                      <button type="button" className="rf-icon-btn rf-icon-btn--danger"
                        onClick={() => remove.mutate(s.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {editingId === s.id && (
                    <div style={{ paddingLeft: 24, paddingTop: 8 }}>
                      <RatioEditor
                        series={s}
                        onSave={(sizes) => update.mutate({ id: s.id, data: { sizes } }, { onSuccess: () => setEditingId(null) })}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {!isLoading && filtered.length === 0 && (
              <p className="alc-empty-text">
                {series.length === 0
                  ? 'Envanter yüklendiğinde seriler otomatik oluşacak.'
                  : 'Arama sonucu yok.'}
              </p>
            )}
          </div>
        </div>

        {/* ── Kategori kuralları ── */}
        <div className="rf-panel">
          <div className="rf-panel-header">
            <div>
              <h2>Kategori Kuralları</h2>
              <p>Tüm kategorideki ürünlere uygulanır.</p>
            </div>
            {!showCatForm && (
              <button type="button" className="rf-primary-button" onClick={() => setShowCatForm(true)}>
                <Plus size={13} style={{ marginRight: 4 }} />Ekle
              </button>
            )}
          </div>

          {showCatForm && (
            <div style={{ padding: '0 0 16px' }}>
              <CategoryRuleForm
                series={series}
                categories={categories}
                onSave={(category, seriesId) => {
                  addRule.mutate({ type: 'category', targetName: category, seriesId }, { onSuccess: () => setShowCatForm(false) });
                }}
                onCancel={() => setShowCatForm(false)}
              />
            </div>
          )}

          <div className="alc-series-list">
            {categoryRules.length === 0 && !showCatForm && (
              <p className="alc-empty-text">Henüz kategori kuralı yok.</p>
            )}
            {categoryRules.map((rule) => {
              const s = series.find((x) => x.id === rule.seriesId);
              return (
                <div key={rule.id} className="alc-series-row">
                  <div className="alc-series-info">
                    <span className="alc-series-name">{rule.targetName}</span>
                    {s && (
                      <div className="alc-chips">
                        {Object.entries(s.sizes).map(([sz, r]) => (
                          <span key={sz} className="alc-chip">{sz} <em>×{r}</em></span>
                        ))}
                      </div>
                    )}
                    {!s && <span style={{ fontSize: '0.75rem', color: 'var(--red)' }}>Seri bulunamadı</span>}
                  </div>
                  <div className="alc-series-actions">
                    <button type="button" className="rf-icon-btn rf-icon-btn--danger"
                      onClick={() => removeRule.mutate(rule.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
