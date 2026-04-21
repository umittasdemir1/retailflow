import { useState, useMemo } from 'react';
import { useSeries, useSeriesMutations, type Series } from '../../hooks/useAllocation';
import { useProducts } from '../../hooks/useStores';
import { Plus, Trash2, Pencil, Check, X, Layers } from 'lucide-react';

/* ── Sizes Editor ─────────────────────────────────────────────────── */
function SizesEditor({ value, onChange }: { value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  const rows = Object.entries(value);
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
      {rows.map(([size, ratio]) => (
        <div key={size} className="alc-sizes-row">
          <span className="alc-size-badge">{size}</span>
          <input
            type="number" min={1} step={1} value={ratio}
            onChange={(e) => onChange({ ...value, [size]: Math.max(1, Number(e.target.value)) })}
            className="alc-num-input"
          />
          <button type="button" className="rf-icon-btn rf-icon-btn--danger" onClick={() => removeSize(size)}><Trash2 size={13} /></button>
        </div>
      ))}
      <div className="alc-sizes-add">
        <input
          type="text" value={newSize} placeholder="Beden (S, M, 36…)"
          onChange={(e) => setNewSize(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addRow()}
          className="alc-add-size-input"
        />
        <input
          type="number" min={1} step={1} value={newRatio}
          onChange={(e) => setNewRatio(Math.max(1, Number(e.target.value)))}
          onKeyDown={(e) => e.key === 'Enter' && addRow()}
          className="alc-num-input"
        />
        <button type="button" className="rf-icon-btn" onClick={addRow} title="Ekle"><Plus size={14} /></button>
      </div>
    </div>
  );
}

/* ── Series Form ──────────────────────────────────────────────────── */
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
        <div className="rf-mode-row" style={{ marginBottom: 8 }}>
          <button type="button" className={`rf-mode-button${nameMode === 'custom' ? ' is-active' : ''}`} onClick={() => { setNameMode('custom'); setName(''); }}>Özel</button>
          <button type="button" className={`rf-mode-button${nameMode === 'category' ? ' is-active' : ''}`} onClick={() => { setNameMode('category'); setName(''); }} disabled={categories.length === 0}>Kategoriden</button>
        </div>
        {nameMode === 'custom'
          ? <input type="text" className="rf-text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Standart, Küçük Beden…" />
          : <select className="rf-select" value={name} onChange={(e) => setName(e.target.value)}><option value="">Kategori seç...</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        }
      </div>
      <div className="alc-form-field">
        <label className="alc-label">Beden Oranları</label>
        <p className="alc-hint">Beden adını yaz, oran gir, Enter veya + ile ekle.</p>
        <SizesEditor value={sizes} onChange={setSizes} />
      </div>
      <div className="alc-form-actions">
        <button type="button" className="rf-primary-button" onClick={handleSave}><Check size={14} style={{ marginRight: 5 }} />Kaydet</button>
        <button type="button" className="rf-secondary-button" onClick={onCancel}><X size={14} style={{ marginRight: 5 }} />İptal</button>
      </div>
    </div>
  );
}

/* ── Size Chips ───────────────────────────────────────────────────── */
function SizeChips({ sizes }: { sizes: Record<string, number> }) {
  return (
    <div className="alc-chips">
      {Object.entries(sizes).map(([s, r]) => (
        <span key={s} className="alc-chip">{s}<em>{r}</em></span>
      ))}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */
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
        {(showForm || editingId) && (
          <div className="prd-table-card" style={{ padding: 22 }}>
            <div className="alc-form-title">
              <Layers size={16} />
              <span>{editingId ? 'Seri Düzenle' : 'Yeni Seri'}</span>
            </div>
            {showForm && (
              <SeriesForm
                categories={categories}
                onSave={(name, sizes) => add.mutate({ name, sizes }, { onSuccess: () => setShowForm(false) })}
                onCancel={() => setShowForm(false)}
              />
            )}
            {editingId && (
              <SeriesForm
                initial={series.find((s) => s.id === editingId)}
                categories={categories}
                onSave={(name, sizes) => update.mutate({ id: editingId, data: { name, sizes } }, { onSuccess: () => setEditingId(null) })}
                onCancel={() => setEditingId(null)}
              />
            )}
          </div>
        )}

        <div className="prd-table-card">
          <div className="prd-table-toolbar">
            <span className="prd-table-count">{series.length} seri tanımlı</span>
          </div>
          <div className="rf-table-wrap" style={{ borderRadius: 0, border: 'none' }}>
            <table className="rf-table">
              <thead>
                <tr>
                  <th>Seri Adı</th>
                  <th>Bedenler</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={3} className="prd-loading-cell">Yükleniyor…</td></tr>}
                {!isLoading && series.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: 0 }}>
                    <div className="prd-empty"><Layers size={36} strokeWidth={1.2} /><p>Henüz seri tanımlanmamış.</p></div>
                  </td></tr>
                )}
                {series.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td><SizeChips sizes={s.sizes} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button type="button" className="rf-icon-btn" onClick={() => { setEditingId(s.id); setShowForm(false); }}><Pencil size={14} /></button>
                        <button type="button" className="rf-icon-btn rf-icon-btn--danger" onClick={() => remove.mutate(s.id)}><Trash2 size={14} /></button>
                      </div>
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
