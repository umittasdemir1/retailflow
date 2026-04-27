import { useState, useMemo } from 'react';
import { useSeries, useSeriesMutations, type Series } from '../../hooks/useAllocation';
import { useProducts } from '../../hooks/useStores';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';

function SizesEditor({ value, onChange }: { value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  const [newSize, setNewSize] = useState('');
  const [newRatio, setNewRatio] = useState(1);

  function addRow() {
    const s = newSize.trim().toUpperCase();
    if (!s || s in value) return;
    onChange({ ...value, [s]: newRatio });
    setNewSize(''); setNewRatio(1);
  }

  function removeSize(size: string) {
    const next = { ...value }; delete next[size]; onChange(next);
  }

  return (
    <div className="alc-sizes-editor">
      <div className="alc-sizes-header">
        <span>Beden</span><span>Oran</span><span />
      </div>
      {Object.entries(value).map(([size, ratio]) => (
        <div key={size} className="alc-sizes-row">
          <span className="alc-size-label">{size}</span>
          <input type="number" min={1} step={1} value={ratio} className="alc-num-input"
            onChange={(e) => onChange({ ...value, [size]: Math.max(1, Number(e.target.value)) })} />
          <button type="button" className="rf-icon-btn rf-icon-btn--danger" onClick={() => removeSize(size)}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <div className="alc-sizes-add">
        <input type="text" value={newSize} placeholder="Beden (S, M, 36…)" className="alc-text-sm"
          onChange={(e) => setNewSize(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addRow()} />
        <input type="number" min={1} step={1} value={newRatio} className="alc-num-input"
          onChange={(e) => setNewRatio(Math.max(1, Number(e.target.value)))}
          onKeyDown={(e) => e.key === 'Enter' && addRow()} />
        <button type="button" className="rf-icon-btn" onClick={addRow} title="Ekle"><Plus size={14} /></button>
      </div>
    </div>
  );
}

function SeriesForm({ onSave, onCancel, initial, categories }: {
  onSave: (name: string, sizes: Record<string, number>) => void;
  onCancel: () => void;
  initial?: Series;
  categories: string[];
}) {
  const [nameMode, setNameMode] = useState<'custom' | 'category'>('custom');
  const [name, setName] = useState(initial?.name ?? '');
  const [sizes, setSizes] = useState<Record<string, number>>(initial?.sizes ?? {});

  function handleSave() {
    if (!name.trim() || Object.keys(sizes).length === 0) return;
    onSave(name.trim(), sizes);
  }

  return (
    <div className="alc-form">
      <div className="alc-form-field">
        <label className="alc-label">Seri Adı</label>
        <div className="rf-mode-row">
          <button type="button" className={`rf-mode-button${nameMode === 'custom' ? ' is-active' : ''}`}
            onClick={() => { setNameMode('custom'); setName(''); }}>Özel</button>
          <button type="button" className={`rf-mode-button${nameMode === 'category' ? ' is-active' : ''}`}
            onClick={() => { setNameMode('category'); setName(''); }} disabled={categories.length === 0}>Kategoriden</button>
        </div>
        {nameMode === 'custom'
          ? <input type="text" className="rf-text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Standart, Küçük Beden…" />
          : <select className="rf-select" value={name} onChange={(e) => setName(e.target.value)}>
              <option value="">Kategori seç…</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
        }
      </div>
      <div className="alc-form-field">
        <label className="alc-label">Beden Oranları</label>
        <p className="alc-hint">Beden adını yaz, oran gir, Enter veya + ile ekle.</p>
        <SizesEditor value={sizes} onChange={setSizes} />
      </div>
      <div className="alc-form-actions">
        <button type="button" className="rf-primary-button" onClick={handleSave}>
          <Check size={14} style={{ marginRight: 5 }} />Kaydet
        </button>
        <button type="button" className="rf-secondary-button" onClick={onCancel}>
          <X size={14} style={{ marginRight: 5 }} />İptal
        </button>
      </div>
    </div>
  );
}

export function SeriesPage() {
  const { data: series = [], isLoading } = useSeries();
  const { add, update, remove } = useSeriesMutations();
  const { data: productsData } = useProducts();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set((productsData?.products ?? []).map((p) => p.category).filter((c): c is string => c !== null))].sort(),
    [productsData],
  );

  return (
    <div className="rf-page">
      <div className="rf-page-header">
        <div>
          <p className="rf-page-eyebrow">Tahsisat Sistemi</p>
          <h1 className="rf-page-title">Seriler</h1>
          <p className="rf-page-subtitle">Beden dağılım şablonları. Seri adedi × oran = hedef stok.</p>
        </div>
        {!showForm && !editingId && (
          <button type="button" className="rf-primary-button" onClick={() => setShowForm(true)}>
            <Plus size={15} style={{ marginRight: 6 }} />Yeni Seri
          </button>
        )}
      </div>

      <div className="alc-page-layout">
        {/* Form panel */}
        {(showForm || editingId) && (
          <div className="rf-panel">
            <div className="rf-panel-header">
              <div>
                <h2>{editingId ? 'Seri Düzenle' : 'Yeni Seri'}</h2>
                <p>Beden adlarını ve oranlarını tanımla.</p>
              </div>
            </div>
            {showForm && (
              <SeriesForm categories={categories}
                onSave={(name, sizes) => add.mutate({ name, sizes }, { onSuccess: () => setShowForm(false) })}
                onCancel={() => setShowForm(false)} />
            )}
            {editingId && (
              <SeriesForm initial={series.find((s) => s.id === editingId)} categories={categories}
                onSave={(name, sizes) => update.mutate({ id: editingId, data: { name, sizes } }, { onSuccess: () => setEditingId(null) })}
                onCancel={() => setEditingId(null)} />
            )}
          </div>
        )}

        {/* List panel */}
        <div className="rf-panel">
          <div className="rf-panel-header">
            <div>
              <h2>Tanımlı Seriler</h2>
              <p>{series.length} seri</p>
            </div>
          </div>
          {isLoading && <p className="alc-loading">Yükleniyor…</p>}
          {!isLoading && series.length === 0 && (
            <p className="alc-empty-text">Henüz seri tanımlanmamış.</p>
          )}
          <div className="alc-series-list">
            {series.map((s) => (
              editingId === s.id ? null :
              <div key={s.id} className="alc-series-row">
                <div className="alc-series-info">
                  <span className="alc-series-name">{s.name}</span>
                  <div className="alc-chips">
                    {Object.entries(s.sizes).map(([sz, r]) => (
                      <span key={sz} className="alc-chip">{sz} <em>×{r}</em></span>
                    ))}
                  </div>
                </div>
                <div className="alc-series-actions">
                  <button type="button" className="rf-icon-btn" onClick={() => { setEditingId(s.id); setShowForm(false); }}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="rf-icon-btn rf-icon-btn--danger" onClick={() => remove.mutate(s.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
