# RetailFlow

Perakende tekstil mağazaları arası stok transfer optimizasyon sistemi.

## Yapı

```
retailflow/
├── shared/     # Ortak TypeScript tipleri ve sabitler
├── backend/    # Express 5 API (Node.js, TypeScript)
└── frontend/   # React 19 SPA (Vite, Tailwind)
```

## Kurulum

```bash
npm install
npm run dev:backend   # :8787
npm run dev:frontend  # :5173
```

## Telegram Test Env

Backend `dotenv` ile kokteki `.env` dosyasini okur. Baslangic icin:

```bash
cp .env.example .env
```

Ardindan `.env` icinde en az su alanlari doldur:

```bash
TELEGRAM_BOT_TOKEN=buraya-yeni-token
TELEGRAM_TEST_STORE=Midtown
TELEGRAM_TEST_PROVIDER=openai
OPENAI_API_KEY=buraya-openai-key
```

Tokeni chat'e yazma. Degistirdikten sonra backend'i yeniden baslatman yeterli.

Detayli kurulum: [SISTEM_BASLATMA.md](./SISTEM_BASLATMA.md)
