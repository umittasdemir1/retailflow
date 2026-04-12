# Evde Kurulum

Bu not, evdeki local PC'de repoyu cektikten sonra sistemi hizli sekilde ayaga kaldirmak icin yazildi.

## `git pull` ile gelecekler

- Tum source code degisiklikleri
- `backend/catalog/` altindaki referans gorseller ve `catalog.json`
- Frontend ve backend vision kodlari

## `git pull` ile gelmeyecekler

- `node_modules/`
- `backend/models/*.onnx`
- `dist/`
- `.env`
- Local Python venv klasorleri

## Evde yapilacaklar

### 1. Repo guncelle

```bash
git pull
```

### 2. Node ve npm kontrol et

Projede hedef Node surumu `22.22.2`.

```bash
node -v
npm -v
```

Node eskiyse uygun surume gec.

### 3. Bagimliliklari kur

Root dizinde calis:

```bash
npm install
```

### 4. Vision model dosyalarini yerine koy

Su dosyalar repo ile gelmez. Bunlari evde `backend/models/` altina kopyala:

- `clip-vision.onnx`
- `yolo-products.onnx`
- veya `yolov8n.onnx`

Klasoru kontrol et:

```bash
ls -lh backend/models
```

### 5. Python vision ortamini hazirla

```bash
bash backend/vision_py/setup.sh
```

Gerekirse Python binary'yi sabitle:

```bash
export VISION_PYTHON=/tmp/vision-venv/bin/python
```

Not: Baska bir dizin kullandiysan `VISION_PYTHON` degerini ona gore ver.

### 6. `.env` gerekiyorsa root altina koy

Projede local env kullaniyorsan root altindaki `.env` dosyasini da kendi makinene koy.

### 7. Sistemi calistir

Bir terminal:

```bash
npm run dev:backend
```

Ikinci terminal:

```bash
npm run dev:frontend
```

### 8. Hizli kontroller

Backend health:

```bash
curl http://127.0.0.1:8787/api/health
```

Frontend:

```text
http://127.0.0.1:5173
```

## Build gerekiyorsa

`dist/` klasorleri repodan gelmez. Lokal build almak icin:

```bash
npm run build
```

## Kisa ozet

Evde minimum gerekli akis su:

1. `git pull`
2. `npm install`
3. `backend/models/` icine ONNX dosyalarini koy
4. `bash backend/vision_py/setup.sh`
5. `npm run dev:backend`
6. `npm run dev:frontend`

Bu adimlardan sonra sistemin lokal olarak calismasi gerekir.
