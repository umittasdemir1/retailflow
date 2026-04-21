import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ScanSearch, Trash2, Upload, ImageOff,
  Loader2, AlertCircle, Package, BookImage, X, Check,
  MapPin, Link, Search, SquarePen, Crosshair, Settings2,
  MousePointer2, Dot, BoxSelect,
} from 'lucide-react';
import type { VisionRecognizeResponse, RecognizedProduct } from '@retailflow/shared';
import {
  useCatalog, useAddCatalogProduct, useAddCatalogProductFromCdn,
  useUpdateCatalogProduct, useDeleteCatalogProduct, useRecognizeShelf,
  useCalibrations, useSaveCalibration, useDeleteCalibration,
} from '../../hooks/useVision';
import { catalogImageUrl, calibrationImageUrl, searchProducts, type ProductLookupEntry, type VisionProvider } from '../../lib/api';
import { Panel } from '../ui/Panel';

/* (canvas drawing handled inline in RecognitionTab) */

/* ═══════════════════════════════════════════════════════════════
   STR bar
═══════════════════════════════════════════════════════════════ */

function StrBar({ percent }: { percent: number }) {
  const color = percent >= 60 ? '#16a34a' : percent >= 35 ? '#d97706' : '#dc2626';
  return (
    <div className="vsn-str-bar-wrap">
      <div className="vsn-str-bar-bg">
        <div className="vsn-str-bar-fill" style={{ width: `${percent}%`, background: color }} />
      </div>
      <span className="vsn-str-label" style={{ color }}>%{percent}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CATALOG TAB
═══════════════════════════════════════════════════════════════ */

interface AddFormState {
  productCode: string;
  productName: string;
  color: string;
}
const EMPTY_FORM: AddFormState = { productCode: '', productName: '', color: '' };


function CatalogTab() {
  const catalogQuery   = useCatalog();
  const addMutation    = useAddCatalogProduct();
  const cdnMutation    = useAddCatalogProductFromCdn();
  const deleteMutation = useDeleteCatalogProduct();

  const [mode,         setMode]         = useState<'upload' | 'cdn'>('cdn');
  const [provider,     setProvider]     = useState<VisionProvider>('python');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewUrls,  setPreviewUrls]  = useState<string[]>([]);
  const [form,         setForm]         = useState<AddFormState>(EMPTY_FORM);
  const [dragging,     setDragging]     = useState(false);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editForm,     setEditForm]     = useState<AddFormState>(EMPTY_FORM);
  const updateMutation = useUpdateCatalogProduct();
  // CDN arama
  const [searchQ,      setSearchQ]      = useState('');
  const [results,      setResults]      = useState<ProductLookupEntry[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [addingId,     setAddingId]     = useState<string | null>(null);
  const [addedIds,     setAddedIds]     = useState<Set<string>>(new Set());
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(incoming: FileList | File[]) {
    const valid = Array.from(incoming).filter((f) => f.type.startsWith('image/')).slice(0, 10);
    if (valid.length === 0) return;
    setPendingFiles((prev) => {
      const merged = [...prev, ...valid].slice(0, 10);
      setPreviewUrls(merged.map((f) => URL.createObjectURL(f)));
      return merged;
    });
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setPreviewUrls(next.map((f) => URL.createObjectURL(f)));
      return next;
    });
  }

  function cancelAdd() {
    setPendingFiles([]); setPreviewUrls([]); setForm(EMPTY_FORM);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pendingFiles.length === 0) return;
    addMutation.mutate(
      { images: pendingFiles, meta: { ...form, provider } },
      { onSuccess: () => { setPendingFiles([]); setPreviewUrls([]); setForm(EMPTY_FORM); } },
    );
  }

  function handleSearchChange(val: string) {
    setSearchQ(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    // Son virgülden sonraki kısmı aktif sorgu olarak kullan
    const active = val.split(',').pop()?.trim() ?? '';
    if (!active) { setResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try { setResults(await searchProducts(active)); }
      finally { setSearching(false); }
    }, 250);
  }

  function handleAddFromSearch(entry: ProductLookupEntry) {
    const key = `${entry.productCode}-${entry.colorCode}`;
    setAddingId(key);
    cdnMutation.mutate(
      { productCode: entry.productCode, colorCode: entry.colorCode,
        productName: entry.productName, color: entry.color, provider },
      {
        onSuccess: () => { setAddedIds((s) => new Set(s).add(key)); },
        onSettled: () => setAddingId(null),
      }
    );
  }

  async function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Virgülle ayrılmış birden fazla sorgu varsa hepsini işle
    const queries = searchQ.split(',').map((q) => q.trim()).filter(Boolean);
    if (queries.length === 0) return;
    for (const q of queries) {
      const matches = await searchProducts(q);
      if (matches.length > 0) handleAddFromSearch(matches[0]);
    }
    setSearchQ('');
    setResults([]);
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    deleteMutation.mutate(id, { onSettled: () => setDeletingId(null) });
  }

  function startEdit(p: import('@retailflow/shared').CatalogProductPublic) {
    setEditingId(p.id);
    setEditForm({ productCode: p.productCode, productName: p.productName, color: p.color });
  }

  function cancelEdit() { setEditingId(null); setEditForm(EMPTY_FORM); }

  function saveEdit(id: string) {
    updateMutation.mutate(
      { id, meta: editForm },
      { onSuccess: () => { setEditingId(null); setEditForm(EMPTY_FORM); } },
    );
  }

  const catalog = catalogQuery.data ?? [];

  return (
    <div className="vsn-catalog-layout">

      {/* Add product */}
      <div className="vsn-catalog-left">
        <Panel title="Referans Ürün Ekle" subtitle={mode === 'cdn' ? 'Ürün kodu + renk kodu gir, CDN\'den otomatik çek.' : 'Görseli yükle, bilgileri doldur, kaydet.'}>

          {/* Provider seçimi (Vektör Üretimi) */}
          <div className="vsn-mode-tabs" style={{ marginBottom: 16 }}>
            <button type="button"
              className={`vsn-mode-tab${provider === 'python' ? ' vsn-mode-tab--active' : ''}`}
              onClick={() => setProvider('python')}>
              <Check size={12} style={{ opacity: provider === 'python' ? 1 : 0 }} /> Yerel Embedding
            </button>
            <button type="button"
              className={`vsn-mode-tab${provider === 'openai' ? ' vsn-mode-tab--active' : ''}`}
              onClick={() => setProvider('openai')}>
              <Check size={12} style={{ opacity: provider === 'openai' ? 1 : 0 }} /> OpenAI Vision Embed
            </button>
          </div>

          {/* Mod seçimi */}
          <div className="vsn-mode-tabs">
            <button type="button"
              className={`vsn-mode-tab${mode === 'cdn' ? ' vsn-mode-tab--active' : ''}`}
              onClick={() => setMode('cdn')}>
              <Link size={13} /> CDN'den Getir
            </button>
            <button type="button"
              className={`vsn-mode-tab${mode === 'upload' ? ' vsn-mode-tab--active' : ''}`}
              onClick={() => setMode('upload')}>
              <Upload size={13} /> Manuel Yükle
            </button>
          </div>

          {/* CDN arama modu */}
          {mode === 'cdn' && (
            <div className="vsn-cdn-search-wrap">
              <div className="vsn-cdn-search-box">
                <Search size={15} className="vsn-cdn-search-icon" />
                <input
                  className="vsn-cdn-search-input"
                  placeholder="BM26 BLUE DIVE, BM26 BLUEMINT ISLAND …"
                  value={searchQ}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  autoFocus
                />
                {searching && <Loader2 size={14} className="vsn-spin vsn-cdn-search-loader" />}
                {searchQ && !searching && (
                  <button type="button" className="vsn-cdn-search-clear" onClick={() => { setSearchQ(''); setResults([]); }}>
                    <X size={13} />
                  </button>
                )}
              </div>

              {results.length > 0 && (
                <div className="vsn-cdn-results">
                  {results.map((entry) => {
                    const key = `${entry.productCode}-${entry.colorCode}`;
                    const isAdding = addingId === key;
                    const isDone   = addedIds.has(key);
                    const alreadyInCatalog = (catalogQuery.data ?? []).some(
                      (p) => p.productCode === entry.productCode && p.color === entry.color
                    );
                    const done = isDone || alreadyInCatalog;
                    return (
                      <div key={key} className="vsn-cdn-result-row">
                        <div className="vsn-cdn-result-info">
                          <span className="vsn-cdn-result-code">{entry.productCode}</span>
                          <span className="vsn-cdn-result-name">{entry.productName}</span>
                          <span className="vsn-cdn-result-color">{entry.color}</span>
                          <span className="vsn-cdn-result-meta">#{entry.colorCode}</span>
                        </div>
                        <button
                          type="button"
                          className={`vsn-cdn-add-btn${done ? ' vsn-cdn-add-btn--done' : ''}`}
                          disabled={isAdding || done}
                          onClick={() => handleAddFromSearch(entry)}
                        >
                          {isAdding ? <Loader2 size={13} className="vsn-spin" />
                            : done ? <Check size={13} />
                            : <Link size={13} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {!searchQ && (
                <p className="vsn-cdn-hint">
                  Enter → ilk sonucu ekle &nbsp;·&nbsp; Virgülle ayır: <code>BM26 BLUE DIVE, BM26 BLUEMINT ISLAND</code>
                </p>
              )}
              {searchQ && !searching && results.length === 0 && (
                <p className="vsn-cdn-no-result">Sonuç bulunamadı — "{searchQ}"</p>
              )}
            </div>
          )}

          {/* Manuel yükleme modu */}
          {mode === 'upload' && (<>
          <div
            className={`vsn-upload vsn-upload--compact${dragging ? ' vsn-upload--drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <Upload size={22} strokeWidth={1.4} className="vsn-upload-icon" />
            <p className="vsn-upload-text">
              {pendingFiles.length === 0 ? 'Referans görsel ekle' : `${pendingFiles.length} görsel seçildi — daha ekle`}
            </p>
            <p className="vsn-upload-hint">Maks 10 görsel · JPEG, PNG, WebP</p>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              multiple style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
            />
          </div>

          {pendingFiles.length > 0 && (
            <form onSubmit={handleSubmit} className="vsn-add-form">
              <div className="vsn-multi-preview">
                {previewUrls.map((url, i) => (
                  <div key={i} className="vsn-multi-thumb-wrap">
                    <img src={url} alt={`görsel ${i + 1}`} className="vsn-multi-thumb" />
                    <button type="button" className="vsn-add-remove-img vsn-multi-remove"
                      onClick={() => removeFile(i)}><X size={11} /></button>
                    {i === 0 && <span className="vsn-multi-primary-badge">Ana</span>}
                  </div>
                ))}
              </div>
              <div className="vsn-field">
                <label className="vsn-label">Ürün Kodu *</label>
                <input className="vsn-input" placeholder="BM26003131MS" value={form.productCode}
                  onChange={(e) => setForm((f) => ({ ...f, productCode: e.target.value }))} required />
              </div>
              <div className="vsn-field">
                <label className="vsn-label">Ürün Adı *</label>
                <input className="vsn-input" placeholder="Erkek Şort" value={form.productName}
                  onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))} required />
              </div>
              <div className="vsn-field">
                <label className="vsn-label">Renk</label>
                <input className="vsn-input" placeholder="LACİVERT / BEJ" value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} />
              </div>
              {addMutation.isError && (
                <div className="vsn-error"><AlertCircle size={14} />
                  <span>{addMutation.error instanceof Error ? addMutation.error.message : 'Hata'}</span>
                </div>
              )}
              <div className="vsn-add-actions">
                <button type="button" className="rf-secondary-button" onClick={cancelAdd}>İptal</button>
                <button type="submit" className="rf-primary-button"
                  disabled={addMutation.isPending || !form.productCode || !form.productName}>
                  {addMutation.isPending
                    ? <><Loader2 size={14} className="vsn-spin" /> Kaydediliyor…</>
                    : <><Check size={14} /> Kataloga Ekle ({pendingFiles.length} görsel)</>}
                </button>
              </div>
            </form>
          )}
          </>)}
        </Panel>
      </div>

      {/* Catalog list */}
      <div className="vsn-catalog-right">
        <Panel title="Katalog"
          subtitle={catalog.length === 0 ? 'Henüz ürün yok' : `${catalog.length} referans ürün`}>
          {catalogQuery.isLoading && (
            <div className="vsn-empty"><Loader2 size={28} className="vsn-spin vsn-empty-icon" /></div>
          )}
          {!catalogQuery.isLoading && catalog.length === 0 && (
            <div className="vsn-empty">
              <BookImage size={36} strokeWidth={1.2} className="vsn-empty-icon" />
              <p>Sol taraftan ürün ekle.</p>
            </div>
          )}
          {catalog.length > 0 && (
            <div className="vsn-catalog-grid">
              {catalog.map((p) => (
                <div key={p.id} className={`vsn-catalog-card${editingId === p.id ? ' vsn-catalog-card--editing' : ''}`}>
                  {editingId === p.id ? (
                    <div className="vsn-catalog-edit-form">
                      <input className="vsn-input vsn-catalog-edit-input" placeholder="Ürün Kodu *"
                        value={editForm.productCode}
                        onChange={(e) => setEditForm((f) => ({ ...f, productCode: e.target.value }))} />
                      <input className="vsn-input vsn-catalog-edit-input" placeholder="Ürün Adı *"
                        value={editForm.productName}
                        onChange={(e) => setEditForm((f) => ({ ...f, productName: e.target.value }))} />
                      <input className="vsn-input vsn-catalog-edit-input" placeholder="Renk"
                        value={editForm.color}
                        onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))} />
                      <div className="vsn-catalog-edit-actions">
                        <button type="button" className="rf-secondary-button vsn-catalog-edit-btn" onClick={cancelEdit}>
                          <X size={13} /> İptal
                        </button>
                        <button type="button" className="rf-primary-button vsn-catalog-edit-btn"
                          disabled={updateMutation.isPending || !editForm.productCode || !editForm.productName}
                          onClick={() => saveEdit(p.id)}>
                          {updateMutation.isPending ? <Loader2 size={13} className="vsn-spin" /> : <Check size={13} />}
                          Kaydet
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <img src={catalogImageUrl(p.id)} alt={p.productName} className="vsn-catalog-thumb"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <div className="vsn-catalog-info">
                        <span className="vsn-catalog-code">{p.productCode}</span>
                        <span className="vsn-catalog-name">{p.productName}</span>
                        {p.color && <span className="vsn-catalog-meta">{p.color}</span>}
                        {p.description && <span className="vsn-catalog-desc">{p.description}</span>}
                      </div>
                      <div className="vsn-catalog-actions">
                        <button type="button" className="vsn-catalog-edit" onClick={() => startEdit(p)} title="Düzenle">
                          <SquarePen size={14} />
                        </button>
                        <button type="button" className="vsn-catalog-delete"
                          disabled={deletingId === p.id} onClick={() => handleDelete(p.id)} title="Sil">
                          {deletingId === p.id ? <Loader2 size={14} className="vsn-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRODUCT RESULT CARD
═══════════════════════════════════════════════════════════════ */

function ProductResultCard({
  product,
  active,
  onSelect,
}: {
  product: RecognizedProduct;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`vsn-result-card${product.found ? ' vsn-result-card--found' : ' vsn-result-card--notfound'}${active ? ' vsn-result-card--active' : ''}`}
      onClick={onSelect}
      role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      {/* Header */}
      <div className="vsn-result-header">
        <img src={catalogImageUrl(product.catalogProductId)} alt={product.productName}
          className="vsn-result-thumb"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <div className="vsn-result-meta">
          <span className="vsn-match-code">{product.productCode}</span>
          <span className="vsn-match-name">{product.productName}</span>
          {product.color && <span className="vsn-match-color">{product.color}</span>}
          {product.description && <span className="vsn-catalog-desc">{product.description}</span>}
        </div>
        <div className="vsn-result-status">
          {product.found ? (
            <>
              <span className="vsn-found-badge">
                <MapPin size={11} /> {product.foundAt.length} konum
              </span>
              <span className="vsn-found-score" style={{ color: product.bestConfidence >= 85 ? '#16a34a' : '#d97706' }}>
                %{product.bestConfidence}
              </span>
            </>
          ) : (
            <span className="vsn-notfound-badge">Bulunamadı</span>
          )}
        </div>
      </div>

      {/* Sales data */}
      {product.found && product.totalSales !== null && (
        <div className="vsn-result-sales">
          <span>{product.totalSales} satış</span>
          <span>·</span>
          <span>{product.totalInventory} stok</span>
          {product.storeCount !== null && <><span>·</span><span>{product.storeCount} mağaza</span></>}
          {product.strPercent !== null && (
            <>
              <span>·</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                <span style={{ fontSize: 11, color: 'var(--rf-muted)' }}>STR</span>
                <StrBar percent={product.strPercent} />
              </div>
            </>
          )}
        </div>
      )}

      {product.found && product.totalSales === null && (
        <p className="vsn-match-no-inventory">Envanter verisi yüklü değil</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RECOGNITION TAB
═══════════════════════════════════════════════════════════════ */

function RecognitionTab() {
  const catalogQuery      = useCatalog();
  const calibrationsQuery = useCalibrations();
  const recognizeMut      = useRecognizeShelf();

  const [previewSrc,      setPreviewSrc]      = useState<string | null>(null);
  const [result,          setResult]          = useState<VisionRecognizeResponse | null>(null);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [provider,        setProvider]        = useState<VisionProvider>('python');
  const [dragging,        setDragging]        = useState(false);
  const [calibrationId,   setCalibrationId]   = useState<string>('');
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<Set<string>>(new Set());
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [hoveredDot, setHoveredDot] = useState<{
    x: number;
    y: number;
    productName: string;
    color: string;
    salesQty: number | null;
  } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const calibrations = calibrationsQuery.data ?? [];

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (selectedCatalogIds.size === 0) {
      setSelectionError('Analiz için en az bir referans seçmelisin.');
      return;
    }
    setSelectionError(null);
    setResult(null); setActiveProductId(null); setImgDims(null); setHoveredDot(null); setTooltipPos(null);
    const url = URL.createObjectURL(file);
    setPreviewSrc(url);
    const img = new Image();
    img.onload = () => setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    recognizeMut.mutate({
      image: file,
      provider,
      calibrationId: calibrationId || undefined,
      catalogProductIds: [...selectedCatalogIds],
    }, {
      onSuccess: (data) => {
        setResult(data);
        const first = data.recognizedProducts.find((p) => p.found);
        setActiveProductId(first?.catalogProductId ?? null);
      },
    });
  }

  const catalog   = catalogQuery.data ?? [];
  const isPending = recognizeMut.isPending;
  const foundCount = result?.recognizedProducts.filter((p) => p.found).length ?? 0;
  const selectedCount = selectedCatalogIds.size;

  useEffect(() => {
    if (catalog.length === 0) {
      setSelectedCatalogIds(new Set());
      return;
    }

    setSelectedCatalogIds((prev) => {
      const validPrev = new Set([...prev].filter((id) => catalog.some((p) => p.id === id)));
      if (validPrev.size === 0) return new Set(catalog.map((p) => p.id));
      return validPrev;
    });
  }, [catalog]);

  useLayoutEffect(() => {
    if (!hoveredDot || !result || !canvasWrapRef.current || !tooltipRef.current) {
      setTooltipPos(null);
      return;
    }

    const wrap = canvasWrapRef.current;
    const tooltip = tooltipRef.current;
    const scaleX = wrap.clientWidth / result.imageWidth;
    const scaleY = wrap.clientHeight / result.imageHeight;
    const anchorX = hoveredDot.x * scaleX;
    const anchorY = hoveredDot.y * scaleY;
    const pad = 8;
    const offset = 14;

    let left = anchorX + offset;
    if (left + tooltip.offsetWidth > wrap.clientWidth - pad) {
      left = anchorX - tooltip.offsetWidth - offset;
    }
    left = Math.min(Math.max(left, pad), Math.max(pad, wrap.clientWidth - tooltip.offsetWidth - pad));

    let top = anchorY - tooltip.offsetHeight - offset;
    if (top < pad) {
      top = anchorY + offset;
    }
    top = Math.min(Math.max(top, pad), Math.max(pad, wrap.clientHeight - tooltip.offsetHeight - pad));

    setTooltipPos({ left, top });
  }, [hoveredDot, result]);

  function toggleCatalogSelection(id: string) {
    setSelectionError(null);
    setSelectedCatalogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllCatalog() {
    setSelectionError(null);
    setSelectedCatalogIds(new Set(catalog.map((p) => p.id)));
  }

  function clearCatalogSelection() {
    setSelectionError(null);
    setSelectedCatalogIds(new Set());
  }

  return (
    <div className="vsn-layout">

      {/* Left: photo + canvas */}
      <div className="vsn-left">
        <Panel title="Raf Fotoğrafı" subtitle="Toplu görseli yükle — katalogdaki ürünler aranır.">
          {calibrations.length > 0 && (
            <div className="vsn-cal-select-row" style={{ marginBottom: 12 }}>
              <Settings2 size={13} className="vsn-cal-select-icon" />
              <select
                className="vsn-cal-select"
                value={calibrationId}
                onChange={(e) => setCalibrationId(e.target.value)}
                disabled={isPending}
              >
                <option value="">Kalibrasyon yok (otomatik tespit)</option>
                {calibrations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.storeName} — {c.slots.length} slot
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="vsn-mode-tabs" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className={`vsn-mode-tab${provider === 'python' ? ' vsn-mode-tab--active' : ''}`}
              onClick={() => setProvider('python')}
              disabled={isPending}
            >
              Yerel AI
            </button>
            <button
              type="button"
              className={`vsn-mode-tab${provider === 'openai' ? ' vsn-mode-tab--active' : ''}`}
              onClick={() => setProvider('openai')}
              disabled={isPending}
            >
              OpenAI Vision
            </button>
          </div>
          {calibrationId && (
            <p className="vsn-cal-active-note">
              <Settings2 size={11} />
              {provider === 'openai'
                ? 'Kalibrasyonlu OpenAI — slotlar görsele çizilip tek sorguda gönderiliyor'
                : 'Kalibrasyonlu Yerel AI — YOLO atlanıyor, CLIP ile her slot eşleştiriliyor'}
            </p>
          )}

          <div className="vsn-ref-select-box">
            <div className="vsn-ref-select-head">
              <div>
                <strong>Referans Seçimi</strong>
                <span>{selectedCount} / {catalog.length} seçili</span>
              </div>
              <div className="vsn-ref-select-actions">
                <button type="button" className="vsn-ref-select-link" onClick={selectAllCatalog} disabled={catalog.length === 0 || selectedCount === catalog.length || isPending}>Tümünü seç</button>
                <button type="button" className="vsn-ref-select-link" onClick={clearCatalogSelection} disabled={selectedCount === 0 || isPending}>Tümünü kaldır</button>
              </div>
            </div>
            <div className="vsn-ref-select-list">
              {catalog.map((product) => {
                const checked = selectedCatalogIds.has(product.id);
                return (
                  <label key={product.id} className={`vsn-ref-select-item${checked ? ' vsn-ref-select-item--active' : ''}`}>
                    <input type="checkbox" checked={checked} disabled={isPending} onChange={() => toggleCatalogSelection(product.id)} />
                    <img src={catalogImageUrl(product.id)} alt={product.productName} className="vsn-ref-select-thumb" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span className="vsn-ref-select-meta">
                      <span className="vsn-ref-select-code">{product.productCode}</span>
                      <span className="vsn-ref-select-name">{product.productName}</span>
                      {product.color && <span className="vsn-ref-select-color">{product.color}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {selectionError && (
            <div className="vsn-error" style={{ marginBottom: 12 }}>
              <AlertCircle size={14} />
              <span>{selectionError}</span>
            </div>
          )}

          {!previewSrc ? (
            catalog.length === 0 ? (
              <div className="vsn-empty" style={{ minHeight: 160 }}>
                <AlertCircle size={26} strokeWidth={1.4} className="vsn-empty-icon" />
                <p>Önce Katalog sekmesinden referans ürün ekle.</p>
              </div>
            ) : (
              <div
                className={`vsn-upload${dragging ? ' vsn-upload--drag' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => fileInputRef.current?.click()}
                role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                <Upload size={30} strokeWidth={1.4} className="vsn-upload-icon" />
                <p className="vsn-upload-text">Raf fotoğrafını sürükle veya tıkla</p>
                <p className="vsn-upload-hint">{selectedCount} seçili referans · {provider === 'openai' ? 'OpenAI Vision' : 'Yerel AI'} · JPEG, PNG, WebP</p>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              </div>
            )
          ) : (
            <div className="vsn-canvas-wrap" ref={canvasWrapRef}>
              {/* <img> görseli doğal boyutunda render eder — height: auto garantili */}
              <img
                src={previewSrc!}
                className="vsn-shelf-img"
                alt=""
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
                }}
              />

              {/* SVG overlay: inset:0 → <img> ile birebir aynı alan.
                  viewBox = API koordinat uzayı → scale hesabı sıfır. */}
              {result && !isPending && imgDims && (() => {
                const overlayProducts = result.recognizedProducts.filter((p) => p.found);
                const dotsProduct = activeProductId
                  ? result.recognizedProducts.find((p) => p.catalogProductId === activeProductId)
                  : overlayProducts[0];
                if (overlayProducts.length === 0) return null;
                const r = Math.round(Math.min(result.imageWidth, result.imageHeight) * 0.03);
                return (
                  <>
                    <svg
                      className="vsn-dot-svg"
                      viewBox={`0 0 ${result.imageWidth} ${result.imageHeight}`}
                    >
                      {overlayProducts.flatMap((product) => product.foundAt.map((loc, i) => {
                        const cx = loc.dotPosition
                          ? loc.dotPosition.x
                          : loc.boundingBox.x + loc.boundingBox.width / 2;
                        const cy = loc.dotPosition
                          ? loc.dotPosition.y
                          : loc.boundingBox.y + loc.boundingBox.height / 2;
                        const isActive = dotsProduct?.catalogProductId === product.catalogProductId;
                        return (
                          <g key={product.catalogProductId + '-' + i}>
                            {isActive && <circle className="vsn-svg-ring" cx={cx} cy={cy} r={r} />}
                            {isActive && <circle className="vsn-svg-dot" cx={cx} cy={cy} r={r * 0.52} />}
                            <rect
                              className="vsn-svg-hit"
                              x={loc.boundingBox.x}
                              y={loc.boundingBox.y}
                              width={loc.boundingBox.width}
                              height={loc.boundingBox.height}
                              onMouseEnter={() => setHoveredDot({
                                x: cx,
                                y: cy,
                                productName: product.productName,
                                color: product.color,
                                salesQty: product.swimwearSalesQty,
                              })}
                              onMouseLeave={() => setHoveredDot((current) => (
                                current && current.x === cx && current.y === cy ? null : current
                              ))}
                            />
                          </g>
                        );
                      }))}
                    </svg>
                    {hoveredDot && (
                      <div
                        ref={tooltipRef}
                        className="vsn-dot-tooltip"
                        style={tooltipPos ? {
                          left: `${tooltipPos.left}px`,
                          top: `${tooltipPos.top}px`,
                        } : { visibility: 'hidden' }}
                      >
                        <strong>{hoveredDot.productName}</strong>
                        <span>{hoveredDot.color}</span>
                        <span>{hoveredDot.salesQty != null ? `Satış Adedi: ${hoveredDot.salesQty}` : "Satış verisi yok"}</span>
                      </div>
                    )}
                  </>
                );
              })()}

              {isPending && (
                <div className="vsn-canvas-overlay">
                  <Loader2 size={30} className="vsn-spin" />
                  <span>{provider === 'openai' ? 'OpenAI Vision analiz ediyor…' : 'Ürünler aranıyor…'}</span>
                </div>
              )}
            </div>
          )}

          {previewSrc && !isPending && (
            <button type="button" className="rf-secondary-button vsn-new-photo-btn"
              onClick={() => { setPreviewSrc(null); setResult(null); setActiveProductId(null); setImgDims(null); setHoveredDot(null); setTooltipPos(null); setSelectionError(null); }}>
              Yeni Fotoğraf Yükle
            </button>
          )}
        </Panel>

        {result && (
          <div className="vsn-stats-row">
            <div className="vsn-stat">
              <span className="vsn-stat-val">{result.scannedRegions}</span>
              <span className="vsn-stat-lbl">Taranan Bölge</span>
            </div>
            <div className="vsn-stat">
              <span className="vsn-stat-val" style={{ color: foundCount > 0 ? '#16a34a' : 'inherit' }}>
                {foundCount} / {result.recognizedProducts.length}
              </span>
              <span className="vsn-stat-lbl">Bulunan Ürün</span>
            </div>
            <div className="vsn-stat">
              <span className="vsn-stat-val">{result.processingTimeMs}ms</span>
              <span className="vsn-stat-lbl">Süre</span>
            </div>
          </div>
        )}
      </div>

      {/* Right: results — one card per catalog product */}
      <div className="vsn-right">
        <Panel
          title="Sonuçlar"
          subtitle={
            result
              ? `${result.recognizedProducts.length} seçili referans tarandı — ${foundCount} bulundu`
              : 'Fotoğraf yüklendikten sonra burada görünecek.'
          }
        >
          {!result && !isPending && (
            <div className="vsn-empty">
              <Package size={34} strokeWidth={1.2} className="vsn-empty-icon" />
              <p>Henüz analiz yok.</p>
            </div>
          )}
          {isPending && (
            <div className="vsn-empty">
              <Loader2 size={30} className="vsn-spin vsn-empty-icon" />
              <p>{provider === 'openai' ? 'OpenAI Vision analiz ediyor…' : 'Analiz ediliyor…'}</p>
            </div>
          )}
          {recognizeMut.isError && (
            <div className="vsn-error">
              <AlertCircle size={14} />
              <span>{recognizeMut.error instanceof Error ? recognizeMut.error.message : 'Hata'}</span>
            </div>
          )}
          {result && result.recognizedProducts.length === 0 && (
            <div className="vsn-empty">
              <ImageOff size={32} strokeWidth={1.2} className="vsn-empty-icon" />
              <p>Katalog boş.</p>
            </div>
          )}
          {result && result.recognizedProducts.length > 0 && (
            <div className="vsn-det-list">
              {/* Found first, not-found below */}
              {[...result.recognizedProducts]
                .sort((a, b) => (b.found ? 1 : 0) - (a.found ? 1 : 0) || b.bestConfidence - a.bestConfidence)
                .map((p) => (
                  <ProductResultCard
                    key={p.catalogProductId}
                    product={p}
                    active={activeProductId === p.catalogProductId}
                    onSelect={() => setActiveProductId(
                      activeProductId === p.catalogProductId ? null : p.catalogProductId,
                    )}
                  />
                ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CALIBRATION TAB
═══════════════════════════════════════════════════════════════ */

type CalWizardStep = 'store' | 'roi' | 'slots' | 'dots' | 'done';

interface DrawRect { x: number; y: number; width: number; height: number; }
interface DrawDot  { x: number; y: number; }

function CalibrationTab() {
  const calibrationsQuery = useCalibrations();
  const saveMut           = useSaveCalibration();
  const deleteMut         = useDeleteCalibration();

  // Wizard state
  const [step,        setStep]        = useState<CalWizardStep>('store');
  const [storeName,   setStoreName]   = useState('');
  const [photoFile,   setPhotoFile]   = useState<File | null>(null);
  const [photoSrc,    setPhotoSrc]    = useState<string | null>(null);
  const [imgDims,     setImgDims]     = useState<{ w: number; h: number } | null>(null);
  const [roi,         setRoi]         = useState<DrawRect | null>(null);
  const [slots,       setSlots]       = useState<DrawRect[]>([]);
  const [dots,        setDots]        = useState<DrawDot[]>([]);

  // Canvas drawing state
  const [drawing,     setDrawing]     = useState(false);
  const [dragStart,   setDragStart]   = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<DrawRect | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  const canvasRef  = useRef<HTMLDivElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const calibrations = calibrationsQuery.data ?? [];

  function handlePhotoFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoSrc(url);
    const img = new Image();
    img.onload = () => setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }

  // Canvas'taki koordinatı → orijinal görsel koordinatına çevir
  function toImageCoords(e: React.MouseEvent<HTMLDivElement>): { x: number; y: number } | null {
    const div = canvasRef.current;
    if (!div || !imgDims) return null;
    const rect = div.getBoundingClientRect();
    const scaleX = imgDims.w / rect.width;
    const scaleY = imgDims.h / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top)  * scaleY),
    };
  }

  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (step === 'dots') {
      const pos = toImageCoords(e);
      if (!pos) return;
      setDots((prev) => [...prev, pos]);
      return;
    }
    if (step !== 'roi' && step !== 'slots') return;
    const pos = toImageCoords(e);
    if (!pos) return;
    setDrawing(true);
    setDragStart(pos);
    setCurrentRect(null);
  }

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!drawing || !dragStart) return;
    const pos = toImageCoords(e);
    if (!pos || !imgDims) return;
    const x = Math.min(dragStart.x, pos.x);
    const y = Math.min(dragStart.y, pos.y);
    const w = Math.abs(pos.x - dragStart.x);
    const h = Math.abs(pos.y - dragStart.y);
    setCurrentRect({ x, y, width: w, height: h });
  }

  function onMouseUp(e: React.MouseEvent<HTMLDivElement>) {
    if (!drawing || !dragStart) return;
    setDrawing(false);
    const pos = toImageCoords(e);
    if (!pos || !imgDims) return;
    const x = Math.min(dragStart.x, pos.x);
    const y = Math.min(dragStart.y, pos.y);
    const w = Math.abs(pos.x - dragStart.x);
    const h = Math.abs(pos.y - dragStart.y);
    if (w < 10 || h < 10) { setCurrentRect(null); setDragStart(null); return; }
    const rect = { x, y, width: w, height: h };
    if (step === 'roi') {
      setRoi(rect);
    } else if (step === 'slots') {
      setSlots((prev) => [...prev, rect]);
    }
    setCurrentRect(null);
    setDragStart(null);
  }

  function resetWizard() {
    setStep('store'); setStoreName(''); setPhotoFile(null); setPhotoSrc(null);
    setImgDims(null); setRoi(null); setSlots([]); setDots([]);
    setDrawing(false); setDragStart(null); setCurrentRect(null);
  }

  function handleSave() {
    if (!storeName || !imgDims) return;
    saveMut.mutate(
      {
        storeName,
        data: { imageWidth: imgDims.w, imageHeight: imgDims.h, roi, slots, dots },
        image: photoFile ?? undefined,
      },
      { onSuccess: () => { setStep('done'); } },
    );
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    deleteMut.mutate(id, { onSettled: () => setDeletingId(null) });
  }

  const hasPhoto = Boolean(photoSrc && imgDims);
  const canProceedFromStore = storeName.trim().length > 0 && hasPhoto;

  if (step === 'done') {
    return (
      <div className="vsn-cal-done">
        <Check size={40} className="vsn-cal-done-icon" />
        <h3>Kalibrasyon kaydedildi!</h3>
        <p>{storeName} — {slots.length} slot, {dots.length} belirteç</p>
        <button type="button" className="rf-primary-button" onClick={resetWizard}>
          Yeni Kalibrasyon Ekle
        </button>
      </div>
    );
  }

  return (
    <div className="vsn-cal-layout">

      {/* Sol: Wizard */}
      <div className="vsn-cal-wizard">
        <Panel title="Kalibrasyon Sihirbazı" subtitle="Mağazaya özgü raf haritası oluştur — tek seferlik.">

          {/* Step gösterge */}
          <div className="vsn-cal-steps">
            {(['store','roi','slots','dots'] as const).map((s, i) => {
              const labels = ['Mağaza', 'Genel Alan', 'Ürün Alanları', 'Belirteçler'];
              const done = ['store','roi','slots','dots'].indexOf(step) > i;
              const active = step === s;
              return (
                <div key={s} className={`vsn-cal-step${active ? ' vsn-cal-step--active' : done ? ' vsn-cal-step--done' : ''}`}>
                  <div className="vsn-cal-step-num">{done ? <Check size={11} /> : i + 1}</div>
                  <span>{labels[i]}</span>
                </div>
              );
            })}
          </div>

          {/* Adım 0: Mağaza adı + fotoğraf */}
          {step === 'store' && (
            <div className="vsn-cal-step-body">
              <div className="vsn-field">
                <label className="vsn-label">Mağaza Adı *</label>
                <input
                  className="vsn-input"
                  placeholder="ör. Midtown, Bağdat Cad., Levent"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  autoFocus
                />
              </div>

              <div
                className={`vsn-upload vsn-upload--compact${hasPhoto ? ' vsn-upload--done' : ''}`}
                onClick={() => fileRef.current?.click()}
                role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              >
                {hasPhoto ? (
                  <><Check size={20} className="vsn-upload-icon" /><p className="vsn-upload-text">Fotoğraf seçildi</p></>
                ) : (
                  <><Upload size={22} strokeWidth={1.4} className="vsn-upload-icon" /><p className="vsn-upload-text">Kalibrasyon fotoğrafını yükle</p></>
                )}
                <p className="vsn-upload-hint">JPEG, PNG, WebP</p>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); e.target.value = ''; }} />
              </div>

              <div className="vsn-cal-actions">
                <button type="button" className="rf-primary-button"
                  disabled={!canProceedFromStore}
                  onClick={() => setStep('roi')}>
                  Devam <span style={{ opacity: 0.7, fontSize: 12 }}>→</span>
                </button>
              </div>
            </div>
          )}

          {/* Adım 1: Genel alan seçimi */}
          {step === 'roi' && (
            <div className="vsn-cal-step-body">
              <p className="vsn-cal-hint">
                <BoxSelect size={13} /> Analiz edilecek <b>genel raf alanını</b> bir kare ile işaretle, ardından Kaydet'e bas.
              </p>
              {roi && (
                <div className="vsn-cal-badge-row">
                  <span className="vsn-cal-badge vsn-cal-badge--roi">Seçildi</span>
                  <button type="button" className="vsn-cal-clear" onClick={() => setRoi(null)}><X size={12} /> Sil</button>
                </div>
              )}
              <div className="vsn-cal-actions">
                <button type="button" className="rf-secondary-button" onClick={() => setStep('store')}>← Geri</button>
                <button type="button" className="rf-primary-button" onClick={() => setStep('slots')}>
                  {roi ? 'Kaydet ve Devam' : 'Atla'} →
                </button>
              </div>
            </div>
          )}

          {/* Adım 2: Ürün alanları */}
          {step === 'slots' && (
            <div className="vsn-cal-step-body">
              <p className="vsn-cal-hint">
                <MousePointer2 size={13} /> Her ürünü ayrı ayrı <b>kare içine al</b>. {slots.length > 0 && <b>{slots.length} alan çizildi.</b>}
              </p>
              {slots.length > 0 && (
                <div className="vsn-cal-slot-list">
                  {slots.map((s, i) => (
                    <div key={i} className="vsn-cal-slot-item">
                      <span className="vsn-cal-slot-num">{i + 1}</span>
                      <span className="vsn-cal-slot-info">{s.width}×{s.height}</span>
                      <button type="button" className="vsn-cal-clear"
                        onClick={() => setSlots((prev) => prev.filter((_, j) => j !== i))}>
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="vsn-cal-actions">
                <button type="button" className="rf-secondary-button" onClick={() => setStep('roi')}>← Geri</button>
                <button type="button" className="rf-primary-button"
                  disabled={slots.length === 0}
                  onClick={() => setStep('dots')}>
                  Kaydet ve Devam ({slots.length}) →
                </button>
              </div>
            </div>
          )}

          {/* Adım 3: Belirteç noktaları */}
          {step === 'dots' && (
            <div className="vsn-cal-step-body">
              <p className="vsn-cal-hint">
                <Dot size={13} /> Her ürün için <b>belirteç noktasına tıkla</b> ({dots.length}/{slots.length})
              </p>
              {dots.length > 0 && (
                <div className="vsn-cal-slot-list">
                  {dots.map((d, i) => (
                    <div key={i} className="vsn-cal-slot-item">
                      <span className="vsn-cal-slot-num">{i + 1}</span>
                      <span className="vsn-cal-slot-info">{d.x}, {d.y}</span>
                      <button type="button" className="vsn-cal-clear"
                        onClick={() => setDots((prev) => prev.filter((_, j) => j !== i))}>
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="vsn-cal-actions">
                <button type="button" className="rf-secondary-button" onClick={() => setStep('slots')}>← Geri</button>
                <button type="button" className="rf-primary-button"
                  disabled={saveMut.isPending || dots.length === 0}
                  onClick={handleSave}>
                  {saveMut.isPending
                    ? <><Loader2 size={14} className="vsn-spin" /> Kaydediliyor…</>
                    : <><Check size={14} /> Kaydet ve Tamamla</>}
                </button>
              </div>
              {saveMut.isError && (
                <div className="vsn-error"><AlertCircle size={14} />
                  <span>{saveMut.error instanceof Error ? saveMut.error.message : 'Hata'}</span>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* Orta: Canvas */}
      <div className="vsn-cal-canvas-col">
        {hasPhoto && imgDims ? (
          <div className="vsn-cal-canvas-wrap">
            <div
              ref={canvasRef}
              className={`vsn-cal-canvas${step === 'dots' ? ' vsn-cal-canvas--dot-mode' : (step === 'roi' || step === 'slots') ? ' vsn-cal-canvas--draw-mode' : ''}`}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={() => { if (drawing) { setDrawing(false); setCurrentRect(null); setDragStart(null); } }}
            >
              <img src={photoSrc!} alt="" className="vsn-cal-photo" draggable={false} />
              <svg
                className="vsn-cal-svg"
                viewBox={`0 0 ${imgDims.w} ${imgDims.h}`}
                aria-hidden
              >
                {/* ROI */}
                {roi && (
                  <rect className="vsn-cal-roi-rect"
                    x={roi.x} y={roi.y} width={roi.width} height={roi.height} />
                )}
                {/* Slots */}
                {slots.map((s, i) => (
                  <g key={i}>
                    <rect className="vsn-cal-slot-rect"
                      x={s.x} y={s.y} width={s.width} height={s.height} />
                    <text className="vsn-cal-slot-label"
                      x={s.x + 4} y={s.y + 14}>{i + 1}</text>
                  </g>
                ))}
                {/* Current rect preview */}
                {currentRect && (
                  <rect className="vsn-cal-preview-rect"
                    x={currentRect.x} y={currentRect.y}
                    width={currentRect.width} height={currentRect.height} />
                )}
                {/* Dots */}
                {dots.map((d, i) => {
                  const r = Math.round(Math.min(imgDims.w, imgDims.h) * 0.018);
                  return (
                    <g key={i}>
                      <circle className="vsn-cal-dot-ring" cx={d.x} cy={d.y} r={r} />
                      <circle className="vsn-cal-dot-fill" cx={d.x} cy={d.y} r={r * 0.45} />
                      <text className="vsn-cal-dot-label" x={d.x + r + 4} y={d.y + 5}>{i + 1}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <p className="vsn-cal-canvas-hint">
              {step === 'roi'   && 'Tıkla ve sürükle → Genel raf alanını seç'}
              {step === 'slots' && 'Tıkla ve sürükle → Her ürünü ayrı kare içine al'}
              {step === 'dots'  && 'Tıkla → Belirteç noktasını işaretle'}
            </p>
          </div>
        ) : (
          <div className="vsn-cal-canvas-empty">
            <Crosshair size={36} strokeWidth={1.2} />
            <p>Fotoğraf yüklenince burada görünecek.</p>
          </div>
        )}
      </div>

      {/* Sağ: Kayıtlı kalibrasyonlar */}
      <div className="vsn-cal-list-col">
        <Panel title="Kayıtlı Kalibrasyonlar"
          subtitle={calibrations.length === 0 ? 'Henüz kalibrasyon yok' : `${calibrations.length} mağaza`}>
          {calibrationsQuery.isLoading && <div className="vsn-empty"><Loader2 size={24} className="vsn-spin vsn-empty-icon" /></div>}
          {calibrations.length === 0 && !calibrationsQuery.isLoading && (
            <div className="vsn-empty">
              <Settings2 size={32} strokeWidth={1.2} className="vsn-empty-icon" />
              <p>Soldan kalibrasyon ekle.</p>
            </div>
          )}
          {calibrations.map((cal) => (
            <div key={cal.id} className="vsn-cal-list-item">
              {cal.id && (
                <img
                  src={calibrationImageUrl(cal.id)}
                  alt={cal.storeName}
                  className="vsn-cal-list-thumb"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="vsn-cal-list-info">
                <span className="vsn-cal-list-name">{cal.storeName}</span>
                <span className="vsn-cal-list-meta">{cal.slots.length} slot · {cal.dots.length} belirteç</span>
                <span className="vsn-cal-list-date">{new Date(cal.updatedAt).toLocaleDateString('tr-TR')}</span>
              </div>
              <button type="button" className="vsn-catalog-delete"
                disabled={deletingId === cal.id}
                onClick={() => handleDelete(cal.id)}
                title="Sil">
                {deletingId === cal.id ? <Loader2 size={14} className="vsn-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

type Tab = 'catalog' | 'recognize' | 'calibration';

export function VisionPage() {
  const [tab, setTab]    = useState<Tab>('catalog');
  const catalogQuery     = useCatalog();
  const calibrationsQ    = useCalibrations();
  const catalogCount     = catalogQuery.data?.length ?? 0;
  const calCount         = calibrationsQ.data?.length ?? 0;

  return (
    <div className="rf-page">
      <div className="rf-page-header">
        <div>
          <p className="rf-page-eyebrow">Yapay Zeka</p>
          <h1 className="rf-page-title">Görsel Ürün Tanıma</h1>
          <p className="rf-page-subtitle">
            Referans görseller ekle, ardından raf fotoğrafından ürünleri tespit et.
          </p>
        </div>
        <div className="vsn-model-badge">
          <ScanSearch size={14} /> shelf-segmenter-v1
        </div>
      </div>

      <div className="vsn-tabs">
        <button type="button"
          className={`vsn-tab${tab === 'catalog' ? ' vsn-tab--active' : ''}`}
          onClick={() => setTab('catalog')}>
          <BookImage size={16} strokeWidth={1.7} /> Katalog
          {catalogCount > 0 && <span className="vsn-tab-count">{catalogCount}</span>}
        </button>
        <button type="button"
          className={`vsn-tab${tab === 'calibration' ? ' vsn-tab--active' : ''}`}
          onClick={() => setTab('calibration')}>
          <Settings2 size={16} strokeWidth={1.7} /> Kalibrasyon
          {calCount > 0 && <span className="vsn-tab-count">{calCount}</span>}
        </button>
        <button type="button"
          className={`vsn-tab${tab === 'recognize' ? ' vsn-tab--active' : ''}`}
          onClick={() => setTab('recognize')}>
          <ScanSearch size={16} strokeWidth={1.7} /> Raf Analizi
        </button>
      </div>

      <div style={{ display: tab === 'catalog'     ? 'block' : 'none' }}><CatalogTab /></div>
      <div style={{ display: tab === 'calibration' ? 'block' : 'none' }}><CalibrationTab /></div>
      <div style={{ display: tab === 'recognize'   ? 'block' : 'none' }}><RecognitionTab /></div>
    </div>
  );
}
