import { useRef, useEffect, useState, useCallback } from 'react';
import {
  ScanSearch, Trash2, Upload, ImageOff,
  Loader2, AlertCircle, Package, BookImage, X, Check,
  MapPin,
} from 'lucide-react';
import type { VisionRecognizeResponse, RecognizedProduct } from '@retailflow/shared';
import {
  useCatalog, useAddCatalogProduct, useDeleteCatalogProduct, useRecognizeShelf,
} from '../../hooks/useVision';
import { catalogImageUrl } from '../../lib/api';
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
  const deleteMutation = useDeleteCatalogProduct();

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewUrls,  setPreviewUrls]  = useState<string[]>([]);
  const [form,         setForm]         = useState<AddFormState>(EMPTY_FORM);
  const [dragging,     setDragging]     = useState(false);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
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
      { images: pendingFiles, meta: form },
      { onSuccess: () => { setPendingFiles([]); setPreviewUrls([]); setForm(EMPTY_FORM); } },
    );
  }

  function handleDelete(id: string) {
    setDeletingId(id);
    deleteMutation.mutate(id, { onSettled: () => setDeletingId(null) });
  }

  const catalog = catalogQuery.data ?? [];

  return (
    <div className="vsn-catalog-layout">

      {/* Add product */}
      <div className="vsn-catalog-left">
        <Panel title="Referans Ürün Ekle" subtitle="Görseli yükle, bilgileri doldur, kaydet.">
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
              {/* Seçili görsel küçük resimleri */}
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
                <div key={p.id} className="vsn-catalog-card">
                  <img src={catalogImageUrl(p.id)} alt={p.productName} className="vsn-catalog-thumb"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <div className="vsn-catalog-info">
                    <span className="vsn-catalog-code">{p.productCode}</span>
                    <span className="vsn-catalog-name">{p.productName}</span>
                    {p.color && <span className="vsn-catalog-meta">{p.color}</span>}
                    {p.description && <span className="vsn-catalog-desc">{p.description}</span>}
                  </div>
                  <button type="button" className="vsn-catalog-delete"
                    disabled={deletingId === p.id} onClick={() => handleDelete(p.id)} title="Sil">
                    {deletingId === p.id ? <Loader2 size={14} className="vsn-spin" /> : <Trash2 size={14} />}
                  </button>
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

  const [previewSrc,       setPreviewSrc]       = useState<string | null>(null);
  const [result,           setResult]           = useState<VisionRecognizeResponse | null>(null);
  const [activeProductId,  setActiveProductId]  = useState<string | null>(null);
  const [dragging,         setDragging]         = useState(false);
  // Display scale: canvas natural size → CSS displayed size
  const [scale, setScale] = useState({ x: 1, y: 1 });

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const wrapRef      = useRef<HTMLDivElement>(null);
  const imgRef       = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track displayed canvas size for dot positioning
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      setScale({
        x: canvas.offsetWidth  / (canvas.width  || 1),
        y: canvas.offsetHeight / (canvas.height || 1),
      });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [result]); // re-attach when result changes (canvas resizes on new image)

  const redraw = useCallback(() => {
    if (!canvasRef.current || !imgRef.current || !result) return;
    // Just draw the image — dots are rendered as React overlay
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    canvasRef.current.width  = imgRef.current.naturalWidth;
    canvasRef.current.height = imgRef.current.naturalHeight;
    ctx.drawImage(imgRef.current, 0, 0);
    // Update scale after redraw
    setScale({
      x: canvasRef.current.offsetWidth  / (canvasRef.current.width  || 1),
      y: canvasRef.current.offsetHeight / (canvasRef.current.height || 1),
    });
  }, [result]);

  useEffect(() => { redraw(); }, [redraw]);

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setResult(null); setActiveProductId(null);
    const url = URL.createObjectURL(file);
    setPreviewSrc(url);
    const img = new Image();
    img.onload = () => { imgRef.current = img; };
    img.src = url;
    recognizeMut.mutate(file, {
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
                <p className="vsn-upload-hint">{catalog.length} referans ürün · JPEG, PNG, WebP</p>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              </div>
            )
          ) : (
            <div className="vsn-canvas-wrap" ref={wrapRef}>
              <canvas ref={canvasRef} className="vsn-canvas" />

              {/* Blinking dot overlay — one dot per found location of active product */}
              {result && !isPending && (() => {
                const dotsProduct = activeProductId
                  ? result.recognizedProducts.find((p) => p.catalogProductId === activeProductId)
                  : result.recognizedProducts.find((p) => p.found);
                if (!dotsProduct?.found) return null;
                return (
                  <div className="vsn-dot-overlay" aria-hidden>
                    {dotsProduct.foundAt.map((loc, i) => {
                      const cx = (loc.boundingBox.x + loc.boundingBox.width  / 2) * scale.x;
                      const cy = (loc.boundingBox.y + loc.boundingBox.height / 2) * scale.y;
                      return (
                        <span
                          key={i}
                          className="vsn-pulse-dot"
                          style={{ left: cx, top: cy }}
                          title={`%${loc.confidence}`}
                        />
                      );
                    })}
                  </div>
                );
              })()}

              {isPending && (
                <div className="vsn-canvas-overlay">
                  <Loader2 size={30} className="vsn-spin" />
                  <span>Ürünler aranıyor…</span>
                </div>
              )}
            </div>
          )}

          {previewSrc && !isPending && (
            <button type="button" className="rf-secondary-button vsn-new-photo-btn"
              onClick={() => { setPreviewSrc(null); setResult(null); setActiveProductId(null); imgRef.current = null; }}>
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
              <p>Analiz ediliyor…</p>
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

      {tab === 'catalog'   && <CatalogTab />}
      {tab === 'recognize' && <RecognitionTab />}
    </div>
  );
}
