# MCP Setup Roadmap

Bu roadmap'i proje implementasyonundan once tamamlayacagiz. Ama amac arac kurmak, urun gelistirmeye gecisi geciktirmek degil.

## Faz 1 - Temel MCP Hazirligi

Hedef:
Repo, deployment ve test akislarini minimum dogru set ile calisir hale getirmek.

Adimlar:
1. Root seviyesinde `.env` ve `.env.example` olustur.
2. Secret'lari `.gitignore` ile koruma altina al.
3. Ilk faz MCP listesinde uzlas:
- `filesystem`
- `git`
- `github`
- `playwright`
- `render`
4. `netlify` icin karar ver:
- Kullanilacaksa simdi ekle
- Kullanilmayacaksa ikinci faza at

Teslim kriteri:
- Hangi MCP'lerin ilk gun aktif olacagi netlesmis olur.
- `.env` anahtarlari sabitlenmis olur.

## Faz 2 - Credential Toplama

Hedef:
MCP baglantilarini kurmak icin gerekli tum token ve id'leri toplamak.

Adimlar:
1. `MCP_CREDENTIALS_GUIDE.md` dosyasini takip et.
2. GitHub token ve repo bilgisini topla.
3. Render owner ve service id'lerini topla.
4. Netlify kullanilacaksa token ve site bilgilerini topla.
5. Bana degerleri ilet.

Teslim kriteri:
- `.env` gercek degerlerle doldurulmaya hazir olur.

## Faz 3 - MCP Aktivasyonu

Hedef:
MCP serverlarinin gercek baglantilarla calistigini dogrulamak.

Adimlar:
1. `.env` dosyasini gercek degerlerle doldur.
2. Her MCP icin baglanti testi yap:
- GitHub: repo erisimi
- Render: servis erisimi
- Playwright: lokal base URL
3. Eksik scope veya izin varsa burada kapat.

Teslim kriteri:
- MCP katmani kullanima hazir hale gelir.

## Faz 4 - Proje Kurulumuna Gecis

Hedef:
MCP altyapisi hazirken monorepo donusumune baslamak.

Adimlar:
1. Workspace yapisini kur.
2. `shared`, `backend`, `frontend` paketlerini olustur.
3. TypeScript tabanini kur.
4. `app.py` davranisini servis/usecase katmanlarina parcala.

Teslim kriteri:
- Teknik riskleri dusurulmus sekilde ana implementasyona gecilir.

## Ilke

MCP setup, proje isi icin yardimci katmandir. Ana hedef monorepo migration oldugu icin MCP kurulumu kisa, net ve yeterli kapsamda tutulmali.
