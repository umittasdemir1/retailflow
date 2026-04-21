import { useState } from 'react';
import { Panel } from '../ui/Panel';
import { useSeries, useSeriesMutations, type Series } from '../../hooks/useAllocation';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';

interface SizeRow { size: string; ratio: number; }

function SizesEditor({ value, onChange }: { value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  const rows: SizeRow[] = Object.entries(value).map(([size, ratio]) => ({ size, ratio }));
  const [newSize, setNewSize] = useState('');
  const [newRatio, setNewRatio] = useState(1);

  function updateRatio(size: string, ratio: number) {
    onChange({ ...value, [size]: ratio });
  }

  function removeSize(size: string) {
    const next = { ...value };
    delete next[size];
    onChange(next);
  }

  function addRow() {
    const s = newSize.trim().toUpperCase();
    if (!s || s in value) return;
    onChange({ ...value, [s]: newRatio });
    setNewSize('');
    setNewRatio(1);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 32px', gap: 8, fontSize: '0.74rem', color: 'var(--ink-muted)', fontWeight: 600, paddingBottom: 4, borderBottom: '1px solid var(--line-strong)' }}>
        <span>Beden</span><span style={{ textAlign: 'center' }}>Oran</span><span />
      </div>

      {/* Existing rows */}
      {rows.map(({ size, ratio }) => (
        <div key={size} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 32px', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--ink)' }}>{size}</span>
          <input
            type="number"
            min={1}
            step={1}
            value={ratio}
            onChange={(e) => updateRatio(size, Math.max(1, Number(e.target.value)))}
            style={{ textAlign: 'center', padding: '4px 6px', borderRadius: 6, border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: '0.85rem', width: '100%' }}
          />
          <button type="button" className="rf-icon-btn rf-icon-btn--danger" onClick={() => removeSize(size)} title="Sil">
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      {/* Add new row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 32px', gap: 8, alignItems: 'center', marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--line-strong)' }}>
        <input
          type="text"
          value={newSize}
          onChange={(e) => setNewSize(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addRow()}
          placeholder="Beden (S, M, 36…)"
          style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: '0.84rem', width: '100%' }}
        />
        <input
          type="number"
          min={1}
          step={1}
          value={newRatio}
          onChange={(e) => setNewRatio(Math.max(1, Number(e.target.value)))}
          onKeyDown={(e) => e.key === 'Enter' && addRow()}
          style={{ textAlign: 'center', padding: '5px 6px', borderRadius: 6, border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: '0.85rem', width: '100%' }}
        />
        <button type="button" className="rf-icon-btn" onClick={addRow} title="Beden ekle">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function SeriesForm({ onSave, onCancel, initial }: {
  onSave: (name: string, sizes: Record<string, number>) => void;
  onCancel: () => void;
  initial?: Series;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [sizes, setSizes] = useState<Record<string, number>>(initial?.sizes ?? {});

  function handleSave() {
    if (!name.trim() || Object.keys(sizes).length === 0) return;
    onSave(name.trim(), sizes);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label className="rf-field">
        <span>Seri Adı</span>
        <input
          type="text"
          className="rf-text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Örn: Standart, Küçük Beden, Büyük Beden"
        />
      </label>
      <div>
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', marginBottom: 8 }}>Beden Oranları (0 = bu beden dahil değil)</p>
        <SizesEditor value={sizes} onChange={setSizes} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="rf-primary-button" style={{ fontSize: '0.82rem', padding: '6px 16px' }} onClick={handleSave}>
          <Check size={14} style={{ marginRight: 4 }} />Kaydet
        </button>
        <button type="button" className="rf-secondary-button" style={{ fontSize: '0.82rem', padding: '6px 14px' }} onClick={onCancel}>
          <X size={14} style={{ marginRight: 4 }} />İptal
        </button>
      </div>
    </div>
  );
}

function SeriesRow({ series, onDelete, onEdit }: { series: Series; onDelete: () => void; onEdit: () => void }) {
  const sizeStr = Object.entries(series.sizes)
    .map(([s, r]) => `${s}:${r}`)
    .join('  ');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line-strong)' }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)' }}>{series.name}</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', marginTop: 2, fontFamily: 'monospace' }}>{sizeStr}</p>
      </div>
      <button type="button" className="rf-icon-btn" title="Düzenle" onClick={onEdit}><Pencil size={15} /></button>
      <button type="button" className="rf-icon-btn rf-icon-btn--danger" title="Sil" onClick={onDelete}><Trash2 size={15} /></button>
    </div>
  );
}

export function SeriesPage() {
  const { data: series = [], isLoading } = useSeries();
  const { add, update, remove } = useSeriesMutations();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleAdd(name: string, sizes: Record<string, number>) {
    add.mutate({ name, sizes }, { onSuccess: () => setShowForm(false) });
  }

  function handleUpdate(name: string, sizes: Record<string, number>) {
    if (!editingId) return;
    update.mutate({ id: editingId, data: { name, sizes } }, { onSuccess: () => setEditingId(null) });
  }

  return (
    <div className="rf-page">
      <div className="rf-page-header">
        <div>
          <p className="rf-page-eyebrow">Tahsisat Sistemi</p>
          <h1 className="rf-page-title">Seriler</h1>
          <p className="rf-page-subtitle">Beden dağılım şablonları. Her seri bir "oran" tanımlar.</p>
        </div>
        {!showForm && (
          <button type="button" className="rf-primary-button" onClick={() => setShowForm(true)}>
            <Plus size={16} style={{ marginRight: 6 }} />Yeni Seri
          </button>
        )}
      </div>

      <div className="rf-page-single">
        {showForm && (
          <Panel title="Yeni Seri" subtitle="Beden oranlarını gir.">
            <SeriesForm onSave={handleAdd} onCancel={() => setShowForm(false)} />
          </Panel>
        )}

        <Panel title="Tanımlı Seriler" subtitle={`${series.length} seri`}>
          {isLoading && <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>Yükleniyor...</p>}
          {!isLoading && series.length === 0 && (
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>Henüz seri tanımlanmamış.</p>
          )}
          {series.map((s) =>
            editingId === s.id ? (
              <div key={s.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-strong)' }}>
                <SeriesForm initial={s} onSave={handleUpdate} onCancel={() => setEditingId(null)} />
              </div>
            ) : (
              <SeriesRow
                key={s.id}
                series={s}
                onEdit={() => setEditingId(s.id)}
                onDelete={() => remove.mutate(s.id)}
              />
            )
          )}
        </Panel>
      </div>
    </div>
  );
}
