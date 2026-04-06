# MCP Credentials Guide

Bu dosya, proje kurulumundan once ihtiyacimiz olan MCP serverlarini, hangilerinin zorunlu oldugunu ve credential'larin nereden alinacagini listeler.

## 1. Onerilen MCP Server Listesi

### Zorunlu ilk grup

1. `filesystem`
Yerel repo okuma/yazma.
Credential gerekmez.

2. `git`
Lokal branch, diff, status, commit akisi.
Credential gerekmez.
Ancak `GIT_USER_NAME` ve `GIT_USER_EMAIL` ayarlanmis olmali.

3. `github`
PR, issue, remote repo, branch ve code review akislari.
Gerekli degiskenler:
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`

4. `playwright`
Frontend smoke test, upload flow, analyze flow ve regression kontrolu.
Genelde credential gerekmez.
Gerekli degiskenler:
- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_HEADLESS`

5. `render`
API ve static site deploy, service health, env var ve build takibi.
Gerekli degiskenler:
- `RENDER_API_KEY`
- `RENDER_OWNER_ID`
- `RENDER_SERVICE_ID_API`
- `RENDER_SERVICE_ID_FRONTEND`

### Ikinci grup

6. `netlify`
Frontend'i Netlify'da denemek veya preview deploy almak istersen faydali.
Render static service kullanacaksak opsiyonel.
Gerekli degiskenler:
- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`
- `NETLIFY_TEAM_ID`

7. `sentry`
Hata takibi ve release health icin onerilir.
Monorepo'ya gececegimiz icin backend ve frontend hata izlemede fayda saglar.
Gerekli degiskenler:
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

8. `postgres`
Bu asamada zorunlu degil ama ileride auth, SaaS ve multi-tenant icin faydali.
Gerekli degisken:
- `POSTGRES_URL`

9. `redis`
Bu asamada zorunlu degil ama cache, queue veya session icin sonraki adimlarda faydali.
Gerekli degisken:
- `REDIS_URL`

## 2. Nereden Alinacak

### Git

- `GIT_USER_NAME`: `git config --global user.name` icin kullanacagin isim
- `GIT_USER_EMAIL`: `git config --global user.email` icin kullanacagin e-posta

### GitHub

1. GitHub > sag ust profil > `Settings`
2. Sol menu > `Developer settings`
3. `Personal access tokens`
4. Tercihen `Fine-grained tokens`
5. Repo uzerinde en az su yetkiler verilmeli:
- Contents: Read and write
- Pull requests: Read and write
- Issues: Read and write
- Metadata: Read only
6. Token olusturunca `GITHUB_TOKEN` olarak `.env` icine koy
7. `GITHUB_OWNER` = org veya kullanici adi
8. `GITHUB_REPO` = repo adi

### Render

1. Render dashboard'a gir
2. `Account Settings` > `API Keys`
3. Yeni API key olustur
4. Bunu `RENDER_API_KEY` olarak kaydet
5. `RENDER_OWNER_ID` icin:
- Dashboard URL veya account/team settings icinden owner/team bilgisini al
6. `RENDER_SERVICE_ID_API` ve `RENDER_SERVICE_ID_FRONTEND` icin:
- Her servis sayfasina gir
- URL'de veya service settings alaninda service id'yi kopyala

### Netlify

1. Netlify dashboard > user menu > `User settings`
2. `Applications` veya `Personal access tokens`
3. Yeni token olustur ve `NETLIFY_AUTH_TOKEN` olarak kaydet
4. `NETLIFY_SITE_ID` icin ilgili site > `Site configuration` > `General`
5. `NETLIFY_TEAM_ID` icin team settings veya team URL bilgisini kullan

### Sentry

1. Sentry > `Settings`
2. `Auth Tokens`
3. Project veya org scope'u olan token olustur
4. `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` bilgilerini doldur

### Postgres

- Lokal veya bulut veritabani baglanti URL'si gerekir
- Ornek: `postgresql://user:password@localhost:5432/retailflow`

### Redis

- Lokal veya bulut Redis URL'si gerekir
- Ornek: `redis://localhost:6379`

## 3. Bu Proje Icin Net Tavsiye

Bugun kurulum sirasi olarak su kombinasyon yeterli:

1. `filesystem`
2. `git`
3. `github`
4. `playwright`
5. `render`

`netlify` opsiyonel.
`Sentry`, `postgres`, `redis` ise ikinci faz.

Render hem API hem static frontend'i tasiyacaksa deploy tarafinda Netlify zorunlu degil. Iki platformu birden acmak gereksiz operasyon yukudur.

## 4. Benden Beklenen Sirali Girdi

Asagidaki bilgileri sagladiginda `.env` dosyasini ben dolduracagim:

1. `GIT_USER_NAME`
2. `GIT_USER_EMAIL`
3. `GITHUB_TOKEN`
4. `GITHUB_OWNER`
5. `GITHUB_REPO`
6. `RENDER_API_KEY`
7. `RENDER_OWNER_ID`
8. `RENDER_SERVICE_ID_API`
9. `RENDER_SERVICE_ID_FRONTEND`
10. Opsiyonelse `NETLIFY_AUTH_TOKEN`
11. Opsiyonelse `NETLIFY_SITE_ID`
12. Opsiyonelse `NETLIFY_TEAM_ID`
13. Opsiyonelse `SENTRY_AUTH_TOKEN`
14. Opsiyonelse `SENTRY_ORG`
15. Opsiyonelse `SENTRY_PROJECT`
