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
from transformers import AutoImageProcessor, AutoModel
from ultralytics import YOLO

# ─── Model konfigürasyonu ────────────────────────────────────────────────────
DETECTOR_REPO   = 'Runware/adetailer'
DETECTOR_FILE   = 'deepfashion2_yolov8s-seg.pt'
DINOV2_MODEL_ID = 'facebook/dinov2-base'   # 768-dim, 86M param, iyi denge

# ─── Detection filtreleri ────────────────────────────────────────────────────
ALLOWED_CLASS_NAMES = {'shorts', 'trousers', 'short_sleeved_shirt', 'long_sleeved_shirt'}
MIN_BOX_WIDTH       = 40
MIN_BOX_HEIGHT      = 60
MAX_BOX_AREA_RATIO  = 0.08
MIN_ASPECT_RATIO    = 0.55
MAX_ASPECT_RATIO    = 1.25

# ─── Hibrit embedding ağırlıkları ────────────────────────────────────────────
# DINOv2 → desen/doku/şekil  |  renk histogramı → baskın renk
DINO_WEIGHT       = 0.85
COLOR_WEIGHT      = 0.15
COLOR_HIST_BINS   = 32   # hue histogram bin sayısı (toplam vektör: 768 + 32 = 800 dim)

# ─── Eşleşme parametreleri ───────────────────────────────────────────────────
# Hibrit cosine similarity (desen + renk):
#   Aynı ürün farklı açı   → ~0.80-0.92
#   Aynı desen farklı renk → ~0.50-0.65  (hue histogramı çok farklı)
#   Tamamen farklı ürün    → ~0.30-0.55
MATCH_MIN_SCORE  = 0.63
MATCH_MIN_MARGIN = 0.015
TOP_K            = 5

# ─── Singleton modeller ──────────────────────────────────────────────────────
_yolo_model: YOLO | None = None
_yolo_path:  str | None  = None
_dino_processor           = None
_dino_model               = None


# ─── Dataclass ───────────────────────────────────────────────────────────────
@dataclass
class Detection:
    x1: float; y1: float; x2: float; y2: float
    confidence: float; class_id: int; class_name: str

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
    with Image.open(path) as img:
        return img.convert('RGB').copy()


def crop_pil(image: Image.Image, crop: dict[str, float] | None) -> Image.Image:
    if crop is None:
        return image
    l = int(crop['left'])
    t = int(crop['top'])
    r = l + int(crop['width'])
    b = t + int(crop['height'])
    return image.crop((l, t, r, b))


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


def load_dinov2():
    global _dino_processor, _dino_model
    if _dino_model is None:
        _dino_processor = AutoImageProcessor.from_pretrained(DINOV2_MODEL_ID)
        model = AutoModel.from_pretrained(DINOV2_MODEL_ID)
        model.eval()
        _dino_model = model
    return _dino_processor, _dino_model


# ─── Embedding ───────────────────────────────────────────────────────────────
def _encode_pil(image: Image.Image) -> np.ndarray:
    """PIL görselinden DINOv2 [CLS] token embedding'i çıkar (L2 normalize, 768-dim)."""
    processor, model = load_dinov2()
    inputs  = processor(images=image, return_tensors='pt')
    with torch.no_grad():
        outputs = model(**inputs)
    vec  = outputs.last_hidden_state[0, 0].cpu().numpy().astype('float32')
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


def _hue_histogram(image: Image.Image) -> np.ndarray:
    """
    Normalize edilmiş hue histogramı — kırmızı wraparound düzeltmeli.

    Problem: OpenCV HSV'de kırmızı hem H≈0 hem H≈170 civarında bulunur.
    Çözüm: Hue değerlerini 90° kaydırıp kırmızıyı histogramın ortasına taşıyoruz.
    (H + 90) % 180 → kırmızı artık iki uçta değil, 90° civarında toplu.
    """
    arr = np.array(image)
    hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)
    h   = hsv[:, :, 0].astype('float32')   # OpenCV: H in [0, 179]
    s   = hsv[:, :, 1].astype('float32')
    v   = hsv[:, :, 2].astype('float32')
    mask = (s > 40) & (v > 35)
    if mask.sum() < 30:
        return np.ones(COLOR_HIST_BINS, dtype='float32') / COLOR_HIST_BINS
    # Kırmızı wraparound düzeltmesi: 90° kaydır
    h_shifted = (h[mask] + 90) % 180
    hist, _   = np.histogram(h_shifted, bins=COLOR_HIST_BINS, range=(0, 180))
    hist      = hist.astype('float32')
    total     = hist.sum()
    return hist / total if total > 0 else hist


def _hybrid_vector(image: Image.Image) -> np.ndarray:
    """
    DINOv2(768) * DINO_WEIGHT + hue_hist(32) * COLOR_WEIGHT → L2-normalize.
    Toplam dim: 800. FAISS bu vektörler üzerinde cosine similarity hesaplar.
    """
    dino_vec  = _encode_pil(image)                          # 768-dim, L2-norm=1
    color_vec = _hue_histogram(image)                       # 32-dim, sum=1
    combined  = np.concatenate([
        dino_vec  * DINO_WEIGHT,
        color_vec * COLOR_WEIGHT,
    ]).astype('float32')
    norm = np.linalg.norm(combined)
    return combined / norm if norm > 0 else combined


def embed_image(image_path: str, crop: dict[str, float] | None = None) -> list[float]:
    """Görsel (veya crop) → hibrit embedding (desen + renk)."""
    image = crop_pil(pil_to_rgb(image_path), crop)
    return _hybrid_vector(image).tolist()


def embed_catalog_images(image_paths: list[str]) -> list[float]:
    """
    Birden fazla referans görselden ortalama hibrit embedding.
    Farklı açı / ışık / mesafedeki görseller birleşince ürünün
    'görsel kimliği' daha robust hale gelir.
    """
    vecs = [_hybrid_vector(pil_to_rgb(p)) for p in image_paths]
    mean = np.mean(vecs, axis=0).astype('float32')
    norm = np.linalg.norm(mean)
    return (mean / norm if norm > 0 else mean).tolist()


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
    model  = load_detector()
    result = model.predict(
        source=image_path, device='cpu', verbose=False,
        imgsz=1280, conf=0.05, iou=0.5, max_det=100,
    )[0]

    image_height, image_width = result.orig_shape
    detections: list[Detection] = []

    if result.boxes is None:
        return image_width, image_height, detections

    for coords, conf, cls in zip(
        result.boxes.xyxy.cpu().numpy().tolist(),
        result.boxes.conf.cpu().numpy().tolist(),
        result.boxes.cls.cpu().numpy().tolist(),
    ):
        class_id   = int(cls)
        class_name = model.names.get(class_id, str(class_id))
        if class_name not in ALLOWED_CLASS_NAMES:
            continue

        x1, y1, x2, y2 = [float(v) for v in coords]
        w = x2 - x1; h = y2 - y1
        if w < MIN_BOX_WIDTH or h < MIN_BOX_HEIGHT:
            continue
        area_ratio   = (w * h) / float(image_width * image_height)
        aspect_ratio = w / max(h, 1.0)
        if area_ratio > MAX_BOX_AREA_RATIO:
            continue
        if not (MIN_ASPECT_RATIO <= aspect_ratio <= MAX_ASPECT_RATIO):
            continue

        detections.append(Detection(x1, y1, x2, y2, float(conf), class_id, class_name))

    return image_width, image_height, dedupe(detections)


# ─── FAISS index ─────────────────────────────────────────────────────────────
def build_faiss_index(catalog: list[dict[str, Any]]) -> faiss.IndexFlatIP:
    if not catalog:
        raise ValueError('Katalog boş')
    vecs  = np.stack([normalize(item['featureVector']) for item in catalog]).astype('float32')
    index = faiss.IndexFlatIP(vecs.shape[1])
    index.add(vecs)
    return index


def best_margin(scores: list[float], matches: list[dict[str, Any]]) -> float:
    if not scores: return 0.0
    best_code = matches[0]['productCode']
    for score, match in zip(scores[1:], matches[1:]):
        if match['productCode'] != best_code:
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
    _log(f'Katalog: {len(catalog)} ürün — {[c["productCode"] for c in catalog]}')

    image_width, image_height, detections = detect_products(image_path)
    _log(f'YOLO tespiti: {len(detections)} crop ({image_width}x{image_height})')
    for i, det in enumerate(detections):
        _log(f'  crop{i}: [{det.class_name}] ({round(det.x1)},{round(det.y1)}) '
             f'{round(det.width)}x{round(det.height)} conf={det.confidence:.2f}')

    index = build_faiss_index(catalog)

    matched: list[dict[str, Any]] = []
    for i, det in enumerate(detections):
        crop = {'left': det.x1, 'top': det.y1, 'width': det.width, 'height': det.height}
        emb  = normalize(embed_image(image_path, crop))

        distances, indices = index.search(
            np.expand_dims(emb, axis=0), min(TOP_K, len(catalog))
        )

        top_matches: list[dict[str, Any]] = []
        scores:      list[float]          = []
        for score, idx in zip(distances[0].tolist(), indices[0].tolist()):
            if idx < 0: continue
            item = catalog[idx]
            top_matches.append({
                'catalogProductId': item['id'],
                'productCode':      item['productCode'],
                'productName':      item['productName'],
                'color':            item['color'],
                'description':      item['description'],
                'score':            float(score),
            })
            scores.append(float(score))

        if not top_matches:
            _log(f'  crop{i}: FAISS sonuç yok, atlandı')
            continue

        margin = best_margin(scores, top_matches)
        best   = top_matches[0]

        top3_str = '  |  '.join(
            f'{m["productCode"]}={m["score"]:.4f}' for m in top_matches[:3]
        )
        _log(f'  crop{i} [{det.class_name}] → en iyi: {best["productCode"]} '
             f'score={best["score"]:.4f} margin={margin:.4f} | top3: {top3_str}')

        if best['score'] < MATCH_MIN_SCORE:
            _log(f'  crop{i}: REDDEDİLDİ — score {best["score"]:.4f} < eşik {MATCH_MIN_SCORE}')
            continue
        if len(top_matches) > 1 and margin < MATCH_MIN_MARGIN:
            _log(f'  crop{i}: REDDEDİLDİ — margin {margin:.4f} < {MATCH_MIN_MARGIN} (belirsiz eşleşme)')
            continue

        _log(f'  crop{i}: ONAYLANDI → {best["productCode"]} ({best["productName"]}) score={best["score"]:.4f}')

        candidate = {
            'catalogProductId':  best['catalogProductId'],
            'productCode':       best['productCode'],
            'productName':       best['productName'],
            'color':             best['color'],
            'description':       best['description'],
            'confidence':        round(best['score'] * 100),
            '_score':            best['score'],
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
        # Aynı katalog ürünü daha önce eşleştiyse sadece en yüksek scorelıyı tut
        existing_idx = next(
            (i for i, m in enumerate(matched) if m['catalogProductId'] == candidate['catalogProductId']),
            None
        )
        if existing_idx is None:
            matched.append(candidate)
        elif candidate['_score'] > matched[existing_idx]['_score']:
            matched[existing_idx] = candidate

    # Geçici score alanını temizle
    for m in matched:
        m.pop('_score', None)

    dino_name = DINOV2_MODEL_ID.split('/')[-1]
    det_name  = Path(_yolo_path or DETECTOR_FILE).name

    return {
        'imageWidth':        image_width,
        'imageHeight':       image_height,
        'processingTimeMs':  round((time.time() - started) * 1000),
        'scannedRegions':    len(detections),
        'modelVersion':      f'{det_name} + {dino_name}+color + faiss',
        'detections':        matched,
    }


def cmd_status(_: dict[str, Any]) -> dict[str, Any]:
    load_detector()
    load_dinov2()
    dino_name = DINOV2_MODEL_ID.split('/')[-1]
    det_name  = Path(_yolo_path or DETECTOR_FILE).name
    return {
        'ready':      True,
        'modelName':  f'{det_name} + {dino_name}+color({COLOR_HIST_BINS}bins) + faiss',
        'loadTimeMs': None,
    }


def cmd_embed(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Katalog embed komutu.
    - imagePaths: list[str] → çoklu referans görsel, ortalama embedding
    - imagePath + crop       → recognition sırasında tek crop embedding
    """
    paths = payload.get('imagePaths')
    if paths:
        vec = embed_catalog_images(paths)
    else:
        vec = embed_image(payload['imagePath'], payload.get('crop'))
    return {'featureVector': vec}


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
