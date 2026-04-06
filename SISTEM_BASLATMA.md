# Sistem Baslatma

Bu proje monorepo yapisindadir ve `shared`, `backend`, `frontend` workspace'lerinden olusur.

## Gereksinimler

- Node.js `22.22.2`
- npm
- Root altinda `.env` dosyasi

Node surumunu kontrol etmek icin:

```bash
node -v
npm -v
```

Repo icinde hedeflenen surum:

```bash
cat .nvmrc
```

## Ilk Kurulum

Root dizinde calis:

```bash
npm install
```

## Backend Baslatma

Backend varsayilan olarak `8787` portunda calisir.

Root dizinde:

```bash
npm run dev:backend
```

Alternatif olarak dogrudan workspace komutu:

```bash
npm run dev --workspace backend
```

Saglik kontrolu:

```bash
curl http://127.0.0.1:8787/api/health
```

## Frontend Baslatma

Frontend varsayilan olarak Vite ile `5173` portunda acilir.
`/api` istekleri otomatik olarak `http://localhost:8787` adresindeki backend'e proxy edilir.

Root dizinde:

```bash
npm run dev:frontend
```

Eger Vite cache kaynakli sorun gorursen force ile baslat:

```bash
npm run dev --workspace frontend -- --force
```

Tarayicida ac:

```text
http://127.0.0.1:5173
```

## Tum Sistemi Calistirma Sirasi

1. Ilk terminalde backend'i baslat:

```bash
npm run dev:backend
```

2. Ikinci terminalde frontend'i baslat:

```bash
npm run dev:frontend
```

3. Tarayicidan uygulamayi ac:

```text
http://127.0.0.1:5173
```

## Build Alma

Tum workspaceleri build etmek icin root dizinde:

```bash
npm run build
```

## Backend Production Baslatma

Backend build sonrasi production modda:

```bash
npm run build --workspace backend
npm run start --workspace backend
```

## Frontend Preview

Frontend build alip preview acmak icin:

```bash
npm run build --workspace frontend
npm run preview --workspace frontend
```

## Sik Kullanilan Kontroller

Backend testleri:

```bash
npm run test --workspace backend
```

Port dinleme kontrolu:

```bash
curl http://127.0.0.1:8787/api/health
curl http://127.0.0.1:5173
```

## Notlar

- Backend env ayarlari `backend/src/config.ts` uzerinden okunur.
- Varsayilan backend portu `8787`'dir.
- Varsayilan frontend Vite portu `5173`'tur.
- Frontend tek basina anlamli calismaz; once backend ayakta olmali.
- React/Vite cache problemi yasarsan frontend'i `--force` ile yeniden baslat.
