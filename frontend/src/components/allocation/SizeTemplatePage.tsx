import { useState, useMemo } from 'react';
import { useSizeTemplates, useSeriesMutations, useAssortmentMutations, useSeries, type SizeTemplate } from '../../hooks/useAllocation';
import { Check, Loader2 } from 'lucide-react';

const PAGE_SIZE = 50;

interface RowQtys { [size: string]: number }

function TemplateRow({ tpl, onSave, saving }: {
  tpl: SizeTemplate;
  onSave: (tpl: SizeTemplate, qtys: RowQtys) => void;
  saving: boolean;
}) {
  const [qtys, setQtys] = useState<RowQtys>(() =>
    Object.fromEntries(tpl.sizes.map((s) => [s, 1]))
  );

  return (
    <div className="szt-row">
      <div className="szt-meta">
        {tpl.year && <span className="szt-year">{tpl.year}</span>}
        <span className="szt-product">{tpl.productName}</span>
        <span className="szt-color">{tpl.color}</span>
      </div>

      <div className="szt-sizes">
        {tpl.sizes.map((size) => (
          <div key={size} className="szt-size-cell">
            <label className="szt-size-label">{size}</label>
            <input
              type="number"
              min={1}
              step={1}
              value={qtys[size]}
              onChange={(e) => setQtys((prev) => ({ ...prev, [size]: Math.max(1, Number(e.target.value)) }))}
              className="alc-num-input szt-size-input"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        className="rf-primary-button szt-save-btn"
        onClick={() => onSave(tpl, qtys)}
        disabled={saving}
        title="Seri oluştur ve ürüne bağla"
      >
        {saving ? <Loader2 size={14} className="szt-spin" /> : <Check size={14} />}
        Seri Kaydet
      </button>
    </div>
  );
}

export function SizeTemplatePage() {
  const { data: templates = [], isLoading } = useSizeTemplates();
  const { data: series = [] } = useSeries();
  const { add: addSeries } = useSeriesMutations();
  const { add: addRule } = useAssortmentMutations();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.productName.toLowerCase().includes(q) ||
        t.color.toLowerCase().includes(q) ||
        String(t.year).includes(q)
    );
  }, [templates, search]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSearch(v: string) {
    setSearch(v);
    setPage(0);
  }

  async function handleSave(tpl: SizeTemplate, qtys: RowQtys) {
    const key = `${tpl.year}|||${tpl.productName}|||${tpl.color}`;
    setSavingKey(key);

    const sizes = Object.fromEntries(tpl.sizes.map((s) => [s, qtys[s] ?? 1]));
    const seriesName = tpl.year
      ? `${tpl.productName} ${tpl.year}`
      : tpl.productName;

    // Check if series with this name already exists
    const existing = series.find((s) => s.name === seriesName);

    try {
      let seriesId: string;
      if (existing) {
        seriesId = existing.id;
      } else {
        await new Promise<void>((resolve, reject) => {
          addSeries.mutate({ name: seriesName, sizes }, {
            onSuccess: (created) => {
              seriesId = created.id;
              resolve();
            },
            onError: reject,
          });
        });
      }
      addRule.mutate({ type: 'product', targetName: tpl.productName, seriesId: seriesId! });
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="rf-page">
      <div className="rf-page-header">
        <div>
          <p className="rf-page-eyebrow">Tahsisat Sistemi</p>
          <h1 className="rf-page-title">Beden Aralıkları</h1>
          <p className="rf-page-subtitle">
            {isLoading ? 'Yükleniyor…' : `${filtered.length} kayıt · ${pageCount} sayfa`}
          </p>
        </div>
      </div>

      <div className="szt-toolbar">
        <input
          type="text"
          className="rf-text-input"
          placeholder="Model, renk veya yıl ara…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ maxWidth: 360 }}
        />
      </div>

      {isLoading ? (
        <p className="alc-loading">Yükleniyor…</p>
      ) : paged.length === 0 ? (
        <div className="prd-empty" style={{ marginTop: 48 }}><p>Sonuç yok.</p></div>
      ) : (
        <>
          <div className="szt-list">
            {paged.map((tpl) => {
              const key = `${tpl.year}|||${tpl.productName}|||${tpl.color}`;
              return (
                <TemplateRow
                  key={key}
                  tpl={tpl}
                  onSave={handleSave}
                  saving={savingKey === key}
                />
              );
            })}
          </div>

          {pageCount > 1 && (
            <div className="szt-pagination">
              <button type="button" className="rf-secondary-button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Önceki</button>
              <span className="szt-page-info">{page + 1} / {pageCount}</span>
              <button type="button" className="rf-secondary-button" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Sonraki →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
