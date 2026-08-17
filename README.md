# burakcanbalta.github.io

Burak Can Balta'nın siber güvenlik portalı: güncel haberler, CVE takibi, markdown makaleler/writeup'lar, SiberTools ve CV formatında "Hakkımda" sayfası.

## 🚀 Yayına alma (GitHub Pages)

1. GitHub'da **`burakcanbalta.github.io`** adında (kullanıcı adınla birebir aynı) yeni bir repo aç.
2. Bu klasördeki tüm dosyaları repo'nun **kök dizinine** kopyala (alt klasör içine koyma).
3. Commit + push et:
   ```bash
   git init
   git add .
   git commit -m "SiberPortal ilk yayın"
   git branch -M main
   git remote add origin https://github.com/burakcanbalta/burakcanbalta.github.io.git
   git push -u origin main
   ```
4. Birkaç dakika içinde site şurada yayında olur: **https://burakcanbalta.github.io**
   (`username.github.io` reposu için ekstra bir Pages ayarı gerekmez, otomatik yayınlanır. Ayarları kontrol etmek istersen: repo → Settings → Pages → Source: `main` branch / `/root`.)

## 📁 Yapı

```
index.html          → Ana sayfa (DOOM temalı hero, orijinal tasarımın)
haberler.html        → Canlı siber güvenlik haberleri
cve.html              → Güncel CVE takibi
makaleler.html        → Markdown makale/writeup listesi
makale.html            → Tekil makale görüntüleyici (?slug=... ile)
araclar.html           → SiberTools (kullandığın araçlar)
hakkimda.html          → Hakkımda / CV sayfası
assets/css/home.css    → Ana sayfanın (DOOM) stil dosyası
assets/css/style.css   → Diğer tüm sayfaların stil dosyası
assets/js/main-home.js → Ana sayfa terminal easter egg + mobil menü
assets/js/main.js      → Diğer sayfalar için terminal + ortak davranışlar
assets/js/news.js      → Haberler sayfası mantığı
assets/js/cve.js       → CVE sayfası mantığı
assets/js/articles.js  → Makale listesi mantığı
assets/js/article.js   → Tekil makale render mantığı (marked.js + highlight.js)
assets/js/tools.js     → SiberTools sayfası mantığı
content/articles/*.md  → Makale/writeup içerikleri (markdown)
content/data/*.json    → Makale/araç meta verileri + fallback veri dosyaları
```

## ✍️ Yeni makale / writeup ekleme

1. `content/articles/` klasörüne `yeni-makale-slug.md` adında bir dosya ekle, içeriği markdown olarak yaz.
2. `content/data/articles.json` dosyasına şu formatta yeni bir satır ekle:
   ```json
   {
     "slug": "yeni-makale-slug",
     "title": "Makale Başlığı",
     "date": "2026-08-18",
     "tags": ["web", "writeup"],
     "excerpt": "Kısa özet metni.",
     "readTime": "6 dk"
   }
   ```
3. Kaydet, push et — makale otomatik olarak `makaleler.html` listesinde ve `makale.html?slug=yeni-makale-slug` adresinde görünür.

`writeup` tag'ini kullanırsan, ana sayfadaki "WRITEUPS" kartı otomatik olarak o makaleleri filtreler.

## 🛠 Yeni araç ekleme

`content/data/tools.json` dosyasına `{ "name": "...", "category": "...", "description": "...", "link": "..." }` formatında satır ekle.

## 🎓 Sertifika / CV bilgilerini güncelleme

`hakkimda.html` dosyasında `sertifikalar` bölümündeki `.cert-card` bloklarını kendi sertifika adın, veren kurum ve tarihle değiştir. Aynı sayfada yetenek yüzdeleri (`skill-fill` genişlikleri) ve deneyim zaman çizelgesini de düzenleyebilirsin.

## 📰 Haberler & CVE hakkında önemli not

Haberler sayfası The Hacker News, BleepingComputer, Krebs on Security ve Dark Reading RSS beslemelerini **rss2json** üzerinden; CVE sayfası ise **cve.circl.lu** API'sini tarayıcı üzerinden (client-side) çeker. Bu ücretsiz servisler zaman zaman limit/CORS nedeniyle yanıt vermeyebilir — bu durumda site otomatik olarak `content/data/news-fallback.json` ve `content/data/cve-fallback.json` dosyalarındaki içeriği gösterir, sayfa asla boş kalmaz.

**Daha güvenilir/production kalitesinde canlı veri için önerilen sonraki adım:** GitHub Actions ile günde birkaç kez çalışan bir cron job kurup, RSS/CVE verisini sunucu tarafında çekip doğrudan `content/data/*.json` dosyalarına yazdırmak. Böylece tarayıcı CORS/limit sorunlarından tamamen bağımsız, her zaman güncel bir statik veri seti sunulur. İstersen bu Actions workflow'unu da bir sonraki adımda birlikte kurabiliriz.

## ⚠️ DOOM görseli hakkında not

Ana sayfadaki hero arka planı (Doctor Doom görseli), Marvel/Disney'e ait telifli bir karakter tasarımı. Kişisel isteğin üzerine görsel şu an korunuyor, ancak herkese açık bir profesyonel portfolyo/CV sitesinde telifli IP kullanımı ileride sorun çıkarabilir (ör. bir işveren/kurum incelediğinde). İstersen ileride kendi tasarımın, bir fotoğrafın ya da lisanssız/orijinal bir görselle değiştirebiliriz — kod tarafında sadece `assets/img/doom-bg.jpg` dosyasını değiştirmen yeterli, başka hiçbir şeye dokunman gerekmez.
