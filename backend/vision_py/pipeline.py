#!/usr/bin/env python3
"""
RetailFlow Vision Pipeline
──────────────────────────
Detection  : YOLOv8 DeepFashion2  (giyim ürünleri için fine-tuned)
Embedding  : DINOv2 ViT-B/14      (self-supervised, fine-grained doku/desen)
             + HSV renk histogramı (aynı desen farklı renk ayrımı için)
Retrieval  : FAISS IndexFlatIP    (küçük katalog için exact nearest-neighbor)

Hibrit embedding neden?
  - DINOv2 tek başına "flamingo deseni" görüyor: sarı flamingo ≈ kırmızı flamingo
  - HSV renk histogramı: sarı hue ≠ kırmızı hue → yanlış eşleşme engellenir
  - Birleşik vektör: DINOv2(768) * 0.65 + hue_histogram(32) * 0.35
  - Sonuç: hem desen hem renk birlikte eşleşmeli
"""

import json
import os
import sys
import time
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

os.environ.setdefault('HF_HOME', '/tmp/hf-home')
os.environ.setdefault('TORCH_HOME', '/tmp/torch-home')
os.environ.setdefault('XDG_CACHE_HOME', '/tmp/.cache')

import cv2  # type: ignore
import faiss  # type: ignore
import numpy as np
import torch
from huggingface_hub import hf_hub_download
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
from ultralytics import YOLO

# ─── Model konfigürasyonu ────────────────────────────────────────────────────
DETECTOR_REPO  = 'Runware/adetailer'
DETECTOR_FILE  = 'deepfashion2_yolov8s-seg.pt'
CLIP_MODEL_ID  = 'openai/clip-vit-large-patch14'  # 768-dim, image+text aynı uzayda

# ─── Detection filtreleri ────────────────────────────────────────────────────
ALLOWED_CLASS_NAMES = {'shorts', 'trousers', 'short_sleeved_shirt', 'long_sleeved_shirt',
                       'short_sleeved_outwear', 'long_sleeved_outwear', 'vest',
                       'short_sleeved_dress', 'long_sleeved_dress', 'skirt', 'sling', 'sling_dress'}
MIN_BOX_WIDTH       = 30
MIN_BOX_HEIGHT      = 40
MAX_BOX_AREA_RATIO  = 0.30    # rafta yakın çekim ürünleri kaçırma
MIN_ASPECT_RATIO    = 0.3
MAX_ASPECT_RATIO    = 2.5

# ─── CLIP embedding konfigürasyonu ──────────────────────────────────────────
# Katalog vektörü: CLIP görsel × (1-TEXT_BLEND) + CLIP metin × TEXT_BLEND
# Raf crop vektörü: saf CLIP görsel (açıklama yok)
# İkisi de CLIP uzayında (768-dim) → doğrudan karşılaştırılabilir
TEXT_BLEND = 0.20  # açıklamanın katalog vektörüne katkısı (0 = sadece görsel)

# ─── Eşleşme parametreleri ───────────────────────────────────────────────────
# CLIP cosine similarity kalibrasyonu:
#   Aynı ürün farklı açı      → ~0.78-0.95
#   Aynı kategori farklı ürün → ~0.60-0.73
#   Tamamen farklı ürün       → ~0.30-0.58
MATCH_MIN_SCORE  = 0.70
MATCH_MIN_MARGIN = 0.04
TOP_K            = 5

# Kalibrasyonlu mod için daha sıkı eşik (tek ürün kataloğunda false positive engeller)
CALIB_MIN_SCORE  = 0.80
CALIB_MIN_MARGIN = 0.04

# ─── Görsel ön işleme parametreleri ──────────────────────────────────────────
FULL_IMAGE_CLAHE_CLIP = 2.4
CROP_IMAGE_CLAHE_CLIP = 3.2
CROP_PAD_RATIO        = 0.10
CROP_MIN_SIDE         = 224
CROP_ZOOM_FACTOR      = 1.12
MASK_MIN_BOX_COVERAGE = 0.12
MASK_ALPHA_THRESHOLD  = 24
MASK_BACKGROUND_VALUE = 245

# ─── Singleton modeller ──────────────────────────────────────────────────────
_yolo_model: YOLO | None = None
_yolo_path:  str | None  = None
_clip_processor            = None
_clip_model                = None
_enhanced_shelf_cache: dict[str, Image.Image] = {}


# ─── Dataclass ───────────────────────────────────────────────────────────────
@dataclass
class Detection:
    x1: float; y1: float; x2: float; y2: float
    confidence: float; class_id: int; class_name: str
    mask_polygon: list[tuple[float, float]] | None = None
    mask_coverage: float = 1.0

    @property
    def width(self) -> float:  return self.x2 - self.x1
    @property
    def height(self) -> float: return self.y2 - self.y1


# ─── Yardımcı fonksiyonlar ───────────────────────────────────────────────────
def normalize(vector: Iterable[float]) -> np.ndarray:
    arr  = np.asarray(list(vector), dtype='float32')
    norm = np.linalg.norm(arr)
    if norm == 0:
        raise ValueError('Sıfır uzunluklu embedding normalize edilemiyor')
    return arr / norm


def pil_to_rgb(path: str) -> Image.Image:
    from PIL import ImageOps
    with Image.open(path) as img:
        img = ImageOps.exif_transpose(img)
        return img.convert('RGB').copy()


def crop_pil(image: Image.Image, crop: dict[str, float] | None) -> Image.Image:
    if crop is None:
        return image
    l = max(0, int(round(crop['left'])))
    t = max(0, int(round(crop['top'])))
    r = min(image.width,  l + int(round(crop['width'])))
    b = min(image.height, t + int(round(crop['height'])))
    return image.crop((l, t, r, b))


def expand_crop(crop: dict[str, float], image_width: int, image_height: int, pad_ratio: float) -> dict[str, float]:
    pad_w = crop['width'] * pad_ratio
    pad_h = crop['height'] * pad_ratio
    left  = max(0.0, crop['left'] - pad_w)
    top   = max(0.0, crop['top']  - pad_h)
    right = min(float(image_width),  crop['left'] + crop['width']  + pad_w)
    bot   = min(float(image_height), crop['top']  + crop['height'] + pad_h)
    return {
        'left': left,
        'top': top,
        'width': max(1.0, right - left),
        'height': max(1.0, bot - top),
    }


def tighten_box_to_polygon(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    polygon: list[tuple[float, float]] | None,
    image_width: int,
    image_height: int,
) -> tuple[float, float, float, float, float]:
    if polygon is None or len(polygon) < 3:
        return x1, y1, x2, y2, 1.0

    pts = np.asarray(polygon, dtype='float32')
    px1 = float(np.clip(np.min(pts[:, 0]), 0, max(image_width - 1, 0)))
    py1 = float(np.clip(np.min(pts[:, 1]), 0, max(image_height - 1, 0)))
    px2 = float(np.clip(np.max(pts[:, 0]), 0, image_width))
    py2 = float(np.clip(np.max(pts[:, 1]), 0, image_height))
    tight_x1 = max(x1, px1)
    tight_y1 = max(y1, py1)
    tight_x2 = min(x2, px2)
    tight_y2 = min(y2, py2)
    if tight_x2 <= tight_x1 or tight_y2 <= tight_y1:
        return x1, y1, x2, y2, 1.0

    poly_area = float(abs(cv2.contourArea(pts)))
    box_area  = max((x2 - x1) * (y2 - y1), 1.0)
    coverage  = poly_area / box_area
    return tight_x1, tight_y1, tight_x2, tight_y2, coverage


def isolate_masked_crop(
    image: Image.Image,
    crop: dict[str, float],
    polygon: list[tuple[float, float]] | None,
) -> Image.Image:
    expanded = expand_crop(crop, image.width, image.height, CROP_PAD_RATIO)
    cropped  = crop_pil(image, expanded)
    if polygon is None or len(polygon) < 3:
        return cropped

    crop_width, crop_height = cropped.size
    if crop_width <= 1 or crop_height <= 1:
        return cropped

    local_polygon = np.asarray([
        [x - expanded['left'], y - expanded['top']] for x, y in polygon
    ], dtype='float32')
    local_polygon[:, 0] = np.clip(local_polygon[:, 0], 0, crop_width - 1)
    local_polygon[:, 1] = np.clip(local_polygon[:, 1], 0, crop_height - 1)

    mask = np.zeros((crop_height, crop_width), dtype='uint8')
    cv2.fillPoly(mask, [np.round(local_polygon).astype('int32')], 255)
    mask = cv2.dilate(mask, np.ones((3, 3), dtype='uint8'), iterations=1)
    mask = cv2.GaussianBlur(mask, (0, 0), 0.8)

    foreground = mask > MASK_ALPHA_THRESHOLD
    if int(foreground.sum()) < 48:
        return cropped

    ys, xs = np.where(foreground)
    left   = max(0, int(xs.min()) - 2)
    top    = max(0, int(ys.min()) - 2)
    right  = min(crop_width, int(xs.max()) + 3)
    bottom = min(crop_height, int(ys.max()) + 3)

    rgb        = np.array(cropped, dtype='uint8')[top:bottom, left:right]
    tight_mask = mask[top:bottom, left:right]
    background = np.full_like(rgb, MASK_BACKGROUND_VALUE)
    alpha      = (tight_mask.astype('float32') / 255.0)[..., None]
    isolated   = np.clip(
        rgb.astype('float32') * alpha + background.astype('float32') * (1.0 - alpha),
        0,
        255,
    ).astype('uint8')
    return Image.fromarray(isolated)


def _gray_world_white_balance(rgb: np.ndarray) -> np.ndarray:
    arr   = rgb.astype('float32')
    means = arr.reshape(-1, 3).mean(axis=0)
    gray  = float(np.mean(means))
    scale = gray / np.clip(means, 1.0, None)
    return np.clip(arr * scale.reshape(1, 1, 3), 0, 255).astype('uint8')


def _compress_highlights(rgb: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype('float32')
    v   = hsv[:, :, 2]
    bright = v > 225.0
    if bright.any():
        v[bright] = 225.0 + np.tanh((v[bright] - 225.0) / 18.0) * 18.0
        hsv[:, :, 2] = np.clip(v, 0, 255)
    return cv2.cvtColor(hsv.astype('uint8'), cv2.COLOR_HSV2RGB)


def _apply_clahe_rgb(rgb: np.ndarray, clip_limit: float) -> np.ndarray:
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2RGB)


def _unsharp_mask(rgb: np.ndarray, sigma: float = 1.0, amount: float = 0.5) -> np.ndarray:
    blurred = cv2.GaussianBlur(rgb, (0, 0), sigma)
    sharp   = cv2.addWeighted(rgb, 1.0 + amount, blurred, -amount, 0)
    return np.clip(sharp, 0, 255).astype('uint8')


def _resize_min_side(image: Image.Image, min_side: int) -> Image.Image:
    width, height = image.size
    shortest = min(width, height)
    if shortest >= min_side:
        return image
    scale = min_side / max(shortest, 1)
    return image.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.Resampling.LANCZOS)


def _center_zoom(image: Image.Image, zoom_factor: float) -> Image.Image:
    if zoom_factor <= 1.0:
        return image
    width, height = image.size
    crop_w = max(1, round(width  / zoom_factor))
    crop_h = max(1, round(height / zoom_factor))
    left   = max(0, (width  - crop_w) // 2)
    top    = max(0, (height - crop_h) // 2)
    focused = image.crop((left, top, left + crop_w, top + crop_h))
    return focused.resize((width, height), Image.Resampling.LANCZOS)


def enhance_rack_image_for_detection(image: Image.Image) -> Image.Image:
    rgb = np.array(image, dtype='uint8')
    rgb = _gray_world_white_balance(rgb)
    rgb = _compress_highlights(rgb)
    rgb = _apply_clahe_rgb(rgb, FULL_IMAGE_CLAHE_CLIP)
    rgb = cv2.bilateralFilter(rgb, d=5, sigmaColor=30, sigmaSpace=30)
    rgb = _unsharp_mask(rgb, sigma=0.8, amount=0.35)
    return Image.fromarray(rgb)


def enhance_crop_for_matching(image: Image.Image) -> Image.Image:
    image = _center_zoom(image, CROP_ZOOM_FACTOR)
    image = _resize_min_side(image, CROP_MIN_SIDE)
    rgb   = np.array(image, dtype='uint8')
    rgb   = _compress_highlights(rgb)
    rgb   = _apply_clahe_rgb(rgb, CROP_IMAGE_CLAHE_CLIP)
    rgb   = _unsharp_mask(rgb, sigma=0.9, amount=0.45)
    return Image.fromarray(rgb)


def get_enhanced_shelf_image(image_path: str) -> Image.Image:
    cached = _enhanced_shelf_cache.get(image_path)
    if cached is None:
        cached = enhance_rack_image_for_detection(pil_to_rgb(image_path))
        _enhanced_shelf_cache[image_path] = cached
    return cached.copy()


# ─── Model yükleyiciler ──────────────────────────────────────────────────────
def load_detector() -> YOLO:
    global _yolo_model, _yolo_path
    if _yolo_model is None:
        _yolo_path = hf_hub_download(
            repo_id=DETECTOR_REPO, filename=DETECTOR_FILE,
            local_dir='/tmp/hf-fashion-cache',
        )
        _yolo_model = YOLO(_yolo_path)
    return _yolo_model


def load_clip():
    global _clip_processor, _clip_model
    if _clip_model is None:
        _clip_processor = CLIPProcessor.from_pretrained(CLIP_MODEL_ID)
        model = CLIPModel.from_pretrained(CLIP_MODEL_ID)
        model.eval()
        _clip_model = model
    return _clip_processor, _clip_model


# ─── Embedding ───────────────────────────────────────────────────────────────
def _encode_image(image: Image.Image) -> np.ndarray:
    """PIL görselinden CLIP görsel embedding'i (L2-normalize, 768-dim)."""
    processor, model = load_clip()
    pixel_values = processor(images=image, return_tensors='pt')['pixel_values']
    with torch.no_grad():
        vision_out = model.vision_model(pixel_values=pixel_values)
        pooled = vision_out.pooler_output          # (1, hidden_dim) — CLS token
        projected = model.visual_projection(pooled) # (1, 768)
        vec = projected[0].cpu().numpy().astype('float32')  # (768,)
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


def _encode_text(text: str) -> np.ndarray:
    """Metin açıklamasından CLIP metin embedding'i (L2-normalize, 768-dim)."""
    processor, model = load_clip()
    tok = processor(text=[text], return_tensors='pt', padding=True, truncation=True, max_length=77)
    with torch.no_grad():
        text_out = model.text_model(
            input_ids=tok['input_ids'],
            attention_mask=tok['attention_mask'],
        )
        pooled = text_out.pooler_output             # (1, hidden_dim)
        projected = model.text_projection(pooled)   # (1, 768)
        vec = projected[0].cpu().numpy().astype('float32')  # (768,)
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


def _REMOVED_color_histogram_placeholder() -> None:
    """Removed: CLIP handles color natively in 768-dim space."""
    sat_hist, _ = np.histogram(s[mask], bins=COLOR_SAT_BINS, range=(80, 256))
    sat_hist    = sat_hist.astype('float32')
    sat_total   = sat_hist.sum()
    sat_hist    = sat_hist / sat_total if sat_total > 0 else sat_hist

    return np.concatenate([hue_hist, sat_hist])   # 40-dim


def embed_image(
    image_path: str,
    crop: dict[str, float] | None = None,
    mask_polygon: list[tuple[float, float]] | None = None,
) -> list[float]:
    """Raf crop'u → saf CLIP görsel embedding (768-dim)."""
    if crop is None:
        image = _resize_min_side(pil_to_rgb(image_path), CROP_MIN_SIDE)
        return _encode_image(image).tolist()

    shelf_image = get_enhanced_shelf_image(image_path)
    isolated    = isolate_masked_crop(shelf_image, crop, mask_polygon)
    enhanced    = enhance_crop_for_matching(isolated)
    return _encode_image(enhanced).tolist()


def embed_catalog_images(
    image_paths: list[str],
    description: str = '',
) -> tuple[list[float], list[list[float]]]:
    """
    Katalog referans görselleri → CLIP embedding.

    Catalog vektörü = CLIP_image × (1-TEXT_BLEND) + CLIP_text × TEXT_BLEND (açıklama varsa).
    Raf crop vektörü (embed_image) = saf CLIP_image.
    İkisi de aynı CLIP uzayında → doğrudan karşılaştırılabilir.
    """
    vecs = [_encode_image(_resize_min_side(pil_to_rgb(p), CROP_MIN_SIDE)) for p in image_paths]
    individual = [v.tolist() for v in vecs]

    # Görsel ortalama
    mean_img = np.mean(vecs, axis=0).astype('float32')
    norm     = np.linalg.norm(mean_img)
    mean_img = mean_img / norm if norm > 0 else mean_img

    # Açıklama varsa metin embedding ile blend et
    if description.strip():
        text_vec = _encode_text(description.strip())
        blended  = mean_img * (1.0 - TEXT_BLEND) + text_vec * TEXT_BLEND
        norm     = np.linalg.norm(blended)
        blended  = blended / norm if norm > 0 else blended
    else:
        blended = mean_img

    return blended.tolist(), individual


# ─── NMS ─────────────────────────────────────────────────────────────────────
def iou(a: Detection, b: Detection) -> float:
    ix1 = max(a.x1, b.x1); iy1 = max(a.y1, b.y1)
    ix2 = min(a.x2, b.x2); iy2 = min(a.y2, b.y2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if inter <= 0: return 0.0
    union = a.width * a.height + b.width * b.height - inter
    return inter / union if union > 0 else 0.0


def dedupe(detections: list[Detection]) -> list[Detection]:
    ordered  = sorted(detections, key=lambda d: d.confidence, reverse=True)
    selected: list[Detection] = []
    for det in ordered:
        if any(iou(det, sel) >= 0.5 for sel in selected):
            continue
        selected.append(det)
    return selected


# ─── Detection ───────────────────────────────────────────────────────────────
def detect_products(image_path: str) -> tuple[int, int, list[Detection]]:
    model          = load_detector()
    enhanced_image = get_enhanced_shelf_image(image_path)
    enhanced_bgr   = cv2.cvtColor(np.array(enhanced_image), cv2.COLOR_RGB2BGR)
    result = model.predict(
        source=enhanced_bgr, device='cpu', verbose=False,
        imgsz=1280, conf=0.12, iou=0.5, max_det=100,
    )[0]

    image_width, image_height = enhanced_image.size
    detections: list[Detection] = []

    if result.boxes is None:
        return image_width, image_height, detections

    coords_list = result.boxes.xyxy.cpu().numpy().tolist()
    conf_list   = result.boxes.conf.cpu().numpy().tolist()
    cls_list    = result.boxes.cls.cpu().numpy().tolist()
    mask_list   = list(result.masks.xy) if result.masks is not None else [None] * len(coords_list)

    for idx, (coords, conf, cls) in enumerate(zip(coords_list, conf_list, cls_list)):
        class_id   = int(cls)
        class_name = model.names.get(class_id, str(class_id))
        if class_name not in ALLOWED_CLASS_NAMES:
            continue

        polygon: list[tuple[float, float]] | None = None
        if idx < len(mask_list) and mask_list[idx] is not None and len(mask_list[idx]) >= 3:
            polygon = [(float(x), float(y)) for x, y in mask_list[idx].tolist()]

        x1, y1, x2, y2 = [float(v) for v in coords]
        x1, y1, x2, y2, mask_coverage = tighten_box_to_polygon(
            x1, y1, x2, y2, polygon, image_width, image_height,
        )
        w = x2 - x1; h = y2 - y1
        if w < MIN_BOX_WIDTH or h < MIN_BOX_HEIGHT:
            continue
        area_ratio   = (w * h) / float(image_width * image_height)
        aspect_ratio = w / max(h, 1.0)
        if area_ratio > MAX_BOX_AREA_RATIO:
            continue
        if not (MIN_ASPECT_RATIO <= aspect_ratio <= MAX_ASPECT_RATIO):
            continue
        if polygon is not None and mask_coverage < MASK_MIN_BOX_COVERAGE:
            continue
        # Görsel üst kenarına çok yakın tespitler genelde raf kenarı/etiket — filtrele
        if y1 < image_height * 0.08:
            continue

        detections.append(Detection(x1, y1, x2, y2, float(conf), class_id, class_name, polygon, mask_coverage))

    return image_width, image_height, dedupe(detections)


# ─── FAISS index ─────────────────────────────────────────────────────────────
EXPECTED_DIM = 768  # CLIP ViT-L/14 image/text features


def build_multi_vector_index(catalog: list[dict[str, Any]]) -> tuple[faiss.IndexFlatIP, list[int]]:
    """
    Multi-vector FAISS index: her ürünün tüm referans görsellerini ayrı vektör olarak ekler.
    Returns: (index, vec_to_product_idx) — her vektörün hangi catalog ürününe ait olduğu.
    """
    if not catalog:
        raise ValueError('Katalog boş')

    all_vecs: list[np.ndarray] = []
    vec_to_product: list[int]  = []   # her vektörün catalog index'i
    skipped_dim: int           = 0

    for cat_idx, item in enumerate(catalog):
        # featureVectors varsa multi-vector, yoksa tek featureVector
        fvecs = item.get('featureVectors') or []
        added = 0
        for fv in fvecs:
            if not fv or len(fv) != EXPECTED_DIM:
                skipped_dim += 1
                continue
            all_vecs.append(normalize(fv))
            vec_to_product.append(cat_idx)
            added += 1

        if added == 0:
            fv = item.get('featureVector') or []
            if fv and len(fv) == EXPECTED_DIM:
                all_vecs.append(normalize(fv))
                vec_to_product.append(cat_idx)
            elif fv:
                skipped_dim += 1

    if skipped_dim > 0:
        _log(f'UYARI: {skipped_dim} vektör {EXPECTED_DIM}-dim olmadığı için atlandı '
             f'(OpenAI embedding ile mi eklendi?)')

    if not all_vecs:
        raise ValueError(
            f'Katalogda {EXPECTED_DIM}-dim vektör yok. '
            f'Ürünler OpenAI embedding ile eklenmiş olabilir — '
            f'Yerel AI tanıma için "Yerel Embedding" seçeneği ile yeniden ekleyin.'
        )

    mat   = np.stack(all_vecs).astype('float32')
    index = faiss.IndexFlatIP(mat.shape[1])
    index.add(mat)

    _log(f'FAISS index: {mat.shape[0]} vektör ({len(catalog)} ürün), dim={mat.shape[1]}')
    return index, vec_to_product


def best_margin(scores: list[float], matches: list[dict[str, Any]]) -> float:
    if not scores:
        return 0.0

    best_variant = matches[0]['catalogProductId']
    for score, match in zip(scores[1:], matches[1:]):
        if match['catalogProductId'] != best_variant:
            return scores[0] - score
    return scores[0]


# ─── Ana işlemler ─────────────────────────────────────────────────────────────
def _log(msg: str) -> None:
    """Stderr'e timestamp'li log yazar (Node.js subprocess stderr'i okur)."""
    print(f'[VISION] {msg}', file=sys.stderr, flush=True)


def recognize(payload: dict[str, Any]) -> dict[str, Any]:
    image_path = payload['imagePath']
    catalog    = payload['catalog']
    started    = time.time()

    _log(f'Tanıma başladı — görsel: {image_path}')
    _log(f'Katalog: {len(catalog)} ürün — {[c["productCode"] + " " + c.get("color","") for c in catalog]}')

    image_width, image_height, detections = detect_products(image_path)
    _log(f'YOLO tespiti: {len(detections)} crop ({image_width}x{image_height})')
    for i, det in enumerate(detections):
        _log(f'  crop{i}: [{det.class_name}] ({round(det.x1)},{round(det.y1)}) '
             f'{round(det.width)}x{round(det.height)} conf={det.confidence:.2f} mask={det.mask_coverage:.2f}')

    index, vec_to_product = build_multi_vector_index(catalog)
    total_vecs = index.ntotal

    matched: list[dict[str, Any]] = []
    for i, det in enumerate(detections):
        crop = {'left': det.x1, 'top': det.y1, 'width': det.width, 'height': det.height}
        emb  = normalize(embed_image(image_path, crop, det.mask_polygon))

        # Multi-vector: TOP_K * çoklu referans görsel sayısı kadar sonuç al
        k = min(total_vecs, TOP_K * 5)
        distances, indices = index.search(np.expand_dims(emb, axis=0), k)

        # Aynı ürünün farklı referans görsellerinden gelen sonuçları birleştir:
        # her ürün için en yüksek skoru al
        product_best: dict[int, float] = {}   # catalog_idx → best score
        for score, vec_idx in zip(distances[0].tolist(), indices[0].tolist()):
            if vec_idx < 0: continue
            cat_idx = vec_to_product[vec_idx]
            if cat_idx not in product_best or score > product_best[cat_idx]:
                product_best[cat_idx] = score

        # Skora göre sırala
        sorted_products = sorted(product_best.items(), key=lambda x: x[1], reverse=True)

        top_matches: list[dict[str, Any]] = []
        scores:      list[float]          = []
        for cat_idx, score in sorted_products[:TOP_K]:
            item = catalog[cat_idx]
            top_matches.append({
                'catalogProductId': item['id'],
                'productCode':      item['productCode'],
                'productName':      item['productName'],
                'color':            item.get('color', ''),
                'description':      item.get('description', ''),
                'score':            float(score),
            })
            scores.append(float(score))

        if not top_matches:
            _log(f'  crop{i}: FAISS sonuç yok, atlandı')
            continue

        margin = best_margin(scores, top_matches)
        best   = top_matches[0]

        top3_str = '  |  '.join(
            f'{m["productCode"]} [{m.get("color","")}]={m["score"]:.4f}' for m in top_matches[:3]
        )
        _log(f'  crop{i} [{det.class_name}] → en iyi: {best["productCode"]} [{best.get("color","")}] '
             f'score={best["score"]:.4f} margin={margin:.4f} | top3: {top3_str}')

        if best['score'] < MATCH_MIN_SCORE:
            _log(f'  crop{i}: REDDEDİLDİ — score {best["score"]:.4f} < eşik {MATCH_MIN_SCORE}')
            continue
        if len(top_matches) > 1 and margin < MATCH_MIN_MARGIN:
            _log(f'  crop{i}: REDDEDİLDİ — margin {margin:.4f} < {MATCH_MIN_MARGIN} (belirsiz eşleşme)')
            continue

        _log(f'  crop{i}: ONAYLANDI → {best["productCode"]} | {best["productName"]} | {best.get("color","")} | score={best["score"]:.4f}')

        candidate = {
            'catalogProductId':  best['catalogProductId'],
            'productCode':       best['productCode'],
            'productName':       best['productName'],
            'color':             best.get('color', ''),
            'description':       best.get('description', ''),
            'confidence':        round(best['score'] * 100),
            '_score':            best['score'],
            '_margin':           margin,
            '_detectorConfidence': det.confidence,
            'boundingBox':       {
                'x':      round(det.x1), 'y':      round(det.y1),
                'width':  round(det.width), 'height': round(det.height),
            },
            'detectorConfidence': round(det.confidence * 100),
            'detectorClass':      det.class_name,
            'margin':             round(margin, 4),
            'topMatches': [{
                'catalogProductId': m['catalogProductId'],
                'productCode':      m['productCode'],
                'productName':      m['productName'],
                'score':            round(m['score'], 4),
            } for m in top_matches],
        }
        existing_idx = next(
            (j for j, m in enumerate(matched) if m['catalogProductId'] == candidate['catalogProductId']),
            None,
        )
        if existing_idx is None:
            matched.append(candidate)
        else:
            current = matched[existing_idx]
            current_rank = (
                float(current['_margin']),
                float(current['_detectorConfidence']),
                float(current['_score']),
            )
            candidate_rank = (
                float(candidate['_margin']),
                float(candidate['_detectorConfidence']),
                float(candidate['_score']),
            )
            if candidate_rank > current_rank:
                matched[existing_idx] = candidate

    # Geçici score alanını temizle
    for m in matched:
        m.pop('_score', None)
        m.pop('_margin', None)
        m.pop('_detectorConfidence', None)

    clip_name = CLIP_MODEL_ID.split('/')[-1]
    det_name  = Path(_yolo_path or DETECTOR_FILE).name

    return {
        'imageWidth':        image_width,
        'imageHeight':       image_height,
        'processingTimeMs':  round((time.time() - started) * 1000),
        'scannedRegions':    len(detections),
        'modelVersion':      f'{det_name} + {clip_name} + faiss-multivec',
        'detections':        matched,
    }


def cmd_status(_: dict[str, Any]) -> dict[str, Any]:
    load_detector()
    load_clip()
    clip_name = CLIP_MODEL_ID.split('/')[-1]
    det_name  = Path(_yolo_path or DETECTOR_FILE).name
    return {
        'ready':      True,
        'modelName':  f'{det_name} + {clip_name} + faiss',
        'loadTimeMs': None,
    }


def cmd_recognize_calibrated(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Kalibrasyon tabanlı tanıma: YOLO atlat, elle çizilmiş slot dikdörtgenlerini kullan.

    payload:
      imagePath : str
      slots     : [{x, y, width, height}, ...]   — kullanıcının çizdiği ürün alanları
      dots      : [{x, y}, ...]                  — kullanıcının işaretlediği dot pozisyonları
      catalog   : [{id, productCode, productName, color, description, featureVector, featureVectors}, ...]
    """
    image_path = payload['imagePath']
    slots      = payload['slots']       # list of {x,y,width,height}
    dots       = payload.get('dots', [])
    catalog    = payload['catalog']
    started    = time.time()

    _log(f'Kalibrasyonlu tanıma: {len(slots)} slot, görsel: {image_path}')
    _log(f'Katalog: {len(catalog)} ürün')

    image = pil_to_rgb(image_path)
    image_width, image_height = image.size

    index, vec_to_product = build_multi_vector_index(catalog)
    total_vecs = index.ntotal

    matched: list[dict[str, Any]] = []

    for slot_idx, slot in enumerate(slots):
        # Slot koordinatlarını tam sayıya çevir ve sınır içine al
        sx = max(0, int(round(slot['x'])))
        sy = max(0, int(round(slot['y'])))
        sw = int(round(slot['width']))
        sh = int(round(slot['height']))
        sx2 = min(image_width,  sx + sw)
        sy2 = min(image_height, sy + sh)

        if sx2 <= sx or sy2 <= sy:
            _log(f'  slot{slot_idx}: Geçersiz boyut, atlandı')
            continue

        # Sadece slot alanını kırp — orijinal piksel kalitesi korunur
        crop_img = image.crop((sx, sy, sx2, sy2))

        # Embed — ham piksel, preprocessing yok
        emb = _encode_image(crop_img)
        norm = np.linalg.norm(emb)
        emb = emb / norm if norm > 0 else emb

        k = min(total_vecs, TOP_K * 5)
        distances, indices = index.search(np.expand_dims(emb, axis=0), k)

        # Multi-vector: her ürün için en iyi skoru al
        product_best: dict[int, float] = {}
        for score, vec_idx in zip(distances[0].tolist(), indices[0].tolist()):
            if vec_idx < 0:
                continue
            cat_idx = vec_to_product[vec_idx]
            if cat_idx not in product_best or score > product_best[cat_idx]:
                product_best[cat_idx] = score

        sorted_products = sorted(product_best.items(), key=lambda x: x[1], reverse=True)

        top_matches: list[dict[str, Any]] = []
        scores:      list[float]          = []
        for cat_idx, score in sorted_products[:TOP_K]:
            item = catalog[cat_idx]
            top_matches.append({
                'catalogProductId': item['id'],
                'productCode':      item['productCode'],
                'productName':      item['productName'],
                'color':            item.get('color', ''),
                'score':            float(score),
            })
            scores.append(float(score))

        if not top_matches:
            _log(f'  slot{slot_idx}: FAISS sonuç yok, atlandı')
            continue

        margin = best_margin(scores, top_matches)
        best   = top_matches[0]

        top3_str = '  |  '.join(
            f'{m["productCode"]}={m["score"]:.4f}' for m in top_matches[:3]
        )
        _log(f'  slot{slot_idx} → {best["productCode"]} [{best.get("color","")}] '
             f'score={best["score"]:.4f} margin={margin:.4f} | {top3_str}')

        if best['score'] < CALIB_MIN_SCORE:
            _log(f'  slot{slot_idx}: REDDEDİLDİ — score {best["score"]:.4f} < {CALIB_MIN_SCORE}')
            continue
        if len(top_matches) > 1 and margin < CALIB_MIN_MARGIN:
            _log(f'  slot{slot_idx}: REDDEDİLDİ — margin {margin:.4f} < {CALIB_MIN_MARGIN}')
            continue

        _log(f'  slot{slot_idx}: ONAYLANDI → {best["productCode"]} | {best.get("color","")} | score={best["score"]:.4f}')

        # Dot pozisyonu: kalibrasyon noktası varsa onu kullan, yoksa slot merkezi
        if slot_idx < len(dots):
            dot_pos = {'x': int(round(dots[slot_idx]['x'])), 'y': int(round(dots[slot_idx]['y']))}
        else:
            dot_pos = {'x': sx + (sx2 - sx) // 2, 'y': sy + (sy2 - sy) // 2}

        candidate = {
            'catalogProductId':  best['catalogProductId'],
            'productCode':       best['productCode'],
            'productName':       best['productName'],
            'color':             best.get('color', ''),
            'confidence':        round(best['score'] * 100),
            'boundingBox':       {'x': sx, 'y': sy, 'width': sx2 - sx, 'height': sy2 - sy},
            'dotPosition':       dot_pos,
            'detectorConfidence': round(best['score'] * 100),
            'detectorClass':      'calibrated_slot',
            'margin':             round(margin, 4),
            'slotIndex':          slot_idx,
            '_score':             best['score'],
            '_margin':            margin,
            'topMatches':         [{
                'catalogProductId': m['catalogProductId'],
                'productCode':      m['productCode'],
                'productName':      m['productName'],
                'score':            round(m['score'], 4),
            } for m in top_matches],
        }

        # Aynı ürün birden fazla slotta eşleştiyse sadece en iyisini tut
        existing_idx = next(
            (j for j, m in enumerate(matched) if m['catalogProductId'] == candidate['catalogProductId']),
            None,
        )
        if existing_idx is None:
            matched.append(candidate)
        else:
            current = matched[existing_idx]
            if candidate['_score'] > current['_score']:
                matched[existing_idx] = candidate

    # Geçici score alanlarını temizle
    for m in matched:
        m.pop('_score', None)
        m.pop('_margin', None)

    clip_name = CLIP_MODEL_ID.split('/')[-1]
    return {
        'imageWidth':       image_width,
        'imageHeight':      image_height,
        'processingTimeMs': round((time.time() - started) * 1000),
        'scannedRegions':   len(slots),
        'modelVersion':     f'calibrated+{clip_name}+faiss',
        'detections':       matched,
    }


def cmd_embed(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Katalog embed komutu.
    - imagePaths: list[str] + description → çoklu referans görsel, CLIP görsel+metin blend
    - imagePath + crop                    → recognition sırasında tek crop embedding
    """
    paths = payload.get('imagePaths')
    if paths:
        description = payload.get('description', '')
        avg, individual = embed_catalog_images(paths, description)
        return {'featureVector': avg, 'featureVectors': individual}
    else:
        vec = embed_image(payload['imagePath'], payload.get('crop'))
        return {'featureVector': vec, 'featureVectors': [vec]}


# ─── CLI ─────────────────────────────────────────────────────────────────────
def read_payload(path: str | None) -> dict[str, Any]:
    if path is None:
        return {}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            return json.loads(content) if content else {}
    except (json.JSONDecodeError, OSError):
        return {}


def main() -> int:
    command      = sys.argv[1] if len(sys.argv) > 1 else None
    payload_path = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        payload = read_payload(payload_path)
        if command == 'status':
            response = cmd_status(payload)
        elif command == 'embed':
            response = cmd_embed(payload)
        elif command == 'recognize':
            response = recognize(payload)
        elif command == 'recognize_calibrated':
            response = cmd_recognize_calibrated(payload)
        else:
            raise ValueError(f'Bilinmeyen komut: {command}')

        print(json.dumps(response, ensure_ascii=False))
        return 0

    except Exception as err:
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({'error': str(err)}, ensure_ascii=False))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
