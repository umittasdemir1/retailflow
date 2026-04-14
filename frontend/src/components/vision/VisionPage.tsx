import { useRef, useEffect, useState, useCallback } from 'react';
import {
  ScanSearch, Trash2, Upload, ImageOff,
  Loader2, AlertCircle, Package, BookImage, X, Check,
  MapPin, Link, Search, SquarePen,
} from 'lucide-react';
import type { VisionRecognizeResponse, RecognizedProduct } from '@retailflow/shared';
import {
  useCatalog, useAddCatalogProduct, useAddCatalogProductFromCdn,
  useUpdateCatalogProduct, useDeleteCatalogProduct, useRecognizeShelf,
} from '../../hooks/useVision';
import { catalogImageUrl, searchProducts, type ProductLookupEntry, type VisionProvider } from '../../lib/api';
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
  description: string;
}
const EMPTY_FORM: AddFormState = { productCode: '', productName: '', color: '', description: '' };


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
  const [expandedKey,  setExpandedKey]  = useState<string | null>(null);
  const [expandedDesc, setExpandedDesc] = useState('');
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

  function handleAddFromSearch(entry: ProductLookupEntry, description = '') {
    const key = `${entry.productCode}-${entry.colorCode}`;
    setAddingId(key);
    setExpandedKey(null);
    setExpandedDesc('');
    cdnMutation.mutate(
      { productCode: entry.productCode, colorCode: entry.colorCode,
        productName: entry.productName, color: entry.color, description, provider },
      {
        onSuccess: () => { setAddedIds((s) => new Set(s).add(key)); },
        onSettled: () => setAddingId(null),
      }
    );
  }

  function handleExpandEntry(key: string) {
    if (expandedKey === key) {
      setExpandedKey(null);
      setExpandedDesc('');
    } else {
      setExpandedKey(key);
      setExpandedDesc('');
    }
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
    setEditForm({ productCode: p.productCode, productName: p.productName, color: p.color, description: p.description });
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
                    const isExpanded = expandedKey === key;
                    const alreadyInCatalog = (catalogQuery.data ?? []).some(
                      (p) => p.productCode === entry.productCode && p.color === entry.color
                    );
                    const done = isDone || alreadyInCatalog;
                    return (
                      <div key={key} className={`vsn-cdn-result-row${isExpanded ? ' vsn-cdn-result-row--expanded' : ''}`}>
                        <div className="vsn-cdn-result-info">
                          <span className="vsn-cdn-result-code">{entry.productCode}</span>
                          <span className="vsn-cdn-result-name">{entry.productName}</span>
                          <span className="vsn-cdn-result-color">{entry.color}</span>
                          <span className="vsn-cdn-result-meta">#{entry.colorCode}</span>
                        </div>
                        <button
                          type="button"
                          className={`vsn-cdn-add-btn${done ? ' vsn-cdn-add-btn--done' : isExpanded ? ' vsn-cdn-add-btn--active' : ''}`}
                          disabled={isAdding || done}
                          onClick={() => handleExpandEntry(key)}
                        >
                          {isAdding ? <Loader2 size={13} className="vsn-spin" />
                            : done ? <Check size={13} />
                            : isExpanded ? <X size={13} />
                            : <Link size={13} />}
                        </button>

                        {isExpanded && (
                          <div className="vsn-cdn-desc-row">
                            <input
                              className="vsn-input vsn-cdn-desc-input"
                              placeholder="Açıklama (isteğe bağlı) — ör. kırmızı zemin, flamingo deseni"
                              value={expandedDesc}
                              onChange={(e) => setExpandedDesc(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleAddFromSearch(entry, expandedDesc); }
                                if (e.key === 'Escape') { setExpandedKey(null); setExpandedDesc(''); }
                              }}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="rf-primary-button vsn-cdn-confirm-btn"
                              disabled={isAdding}
                              onClick={() => handleAddFromSearch(entry, expandedDesc)}
                            >
                              {isAdding ? <Loader2 size={13} className="vsn-spin" /> : <Check size={13} />}
                              Ekle
                            </button>
                          </div>
                        )}
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
              <div className="vsn-field">
                <label className="vsn-label">Açıklama</label>
                <input className="vsn-input" placeholder="Yazlık desenli şort" value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
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
                      <input className="vsn-input vsn-catalog-edit-input" placeholder="Açıklama"
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
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
  const catalogQuery = useCatalog();
  const recognizeMut = useRecognizeShelf();

  const [previewSrc,      setPreviewSrc]      = useState<string | null>(null);
  const [result,          setResult]          = useState<VisionRecognizeResponse | null>(null);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [provider,        setProvider]        = useState<VisionProvider>('python');
  const [dragging,        setDragging]        = useState(false);
  // Doğal görsel boyutları — SVG viewBox için (canvas yok artık)
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setResult(null); setActiveProductId(null); setImgDims(null);
    const url = URL.createObjectURL(file);
    setPreviewSrc(url);
    // Doğal boyutları oku — SVG viewBox için
    const img = new Image();
    img.onload = () => setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    recognizeMut.mutate({ image: file, provider }, {
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

  return (
    <div className="vsn-layout">

      {/* Left: photo + canvas */}
      <div className="vsn-left">
        <Panel title="Raf Fotoğrafı" subtitle="Toplu görseli yükle — katalogdaki ürünler aranır.">
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
                <p className="vsn-upload-hint">{catalog.length} referans ürün · {provider === 'openai' ? 'OpenAI Vision' : 'Yerel AI'} · JPEG, PNG, WebP</p>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              </div>
            )
          ) : (
            <div className="vsn-canvas-wrap">
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
                const dotsProduct = activeProductId
                  ? result.recognizedProducts.find((p) => p.catalogProductId === activeProductId)
                  : result.recognizedProducts.find((p) => p.found);
                if (!dotsProduct?.found) return null;
                const r = Math.round(Math.min(result.imageWidth, result.imageHeight) * 0.022);
                return (
                  <svg
                    className="vsn-dot-svg"
                    viewBox={`0 0 ${result.imageWidth} ${result.imageHeight}`}
                    aria-hidden
                  >
                    {dotsProduct.foundAt.map((loc, i) => {
                      const cx = loc.boundingBox.x + loc.boundingBox.width  / 2;
                      const cy = loc.boundingBox.y + loc.boundingBox.height / 2;
                      return (
                        <g key={i}>
                          <circle className="vsn-svg-ring" cx={cx} cy={cy} r={r} />
                          <circle className="vsn-svg-dot"  cx={cx} cy={cy} r={r * 0.45} />
                        </g>
                      );
                    })}
                  </svg>
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
              onClick={() => { setPreviewSrc(null); setResult(null); setActiveProductId(null); setImgDims(null); }}>
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
              ? `${result.recognizedProducts.length} katalog ürünü tarandı — ${foundCount} bulundu`
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
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

type Tab = 'catalog' | 'recognize';

export function VisionPage() {
  const [tab, setTab]    = useState<Tab>('catalog');
  const catalogQuery     = useCatalog();
  const catalogCount     = catalogQuery.data?.length ?? 0;

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
          className={`vsn-tab${tab === 'recognize' ? ' vsn-tab--active' : ''}`}
          onClick={() => setTab('recognize')}>
          <ScanSearch size={16} strokeWidth={1.7} /> Raf Analizi
        </button>
      </div>

      <div style={{ display: tab === 'catalog'   ? 'block' : 'none' }}><CatalogTab /></div>
      <div style={{ display: tab === 'recognize' ? 'block' : 'none' }}><RecognitionTab /></div>
    </div>
  );
}
