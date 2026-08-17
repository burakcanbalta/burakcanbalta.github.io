# KEC Card Access Devices

## Giriş: KEC ve EKDS Ekosistemine Genel Bakış

**KEC (Kart Erişim Cihazı)**, Türkiye'nin yeni nesil kimlik kartlarıyla yerinde, güvenli kimlik doğrulama yapabilmek için tasarlanmış özel bir akıllı kart terminali. İçinde barındırdığı **GEM (Güvenli Eleman Modülü)**, kimlik kartının standart okuyucularla erişilemeyen hassas bölgelerine (kişisel mesaj alanı ya da biyometrik korumalı veri gibi) kontrollü erişim sağlıyor.

Bu terminal, tek başına çalışan bir donanım değil — **EKDS (Elektronik Kimlik Doğrulama Sistemi)** adlı daha büyük bir ekosistemin uç noktası. EKDS, kimlik kartının kriptografik ve isteğe bağlı biyometrik özelliklerini kullanarak güvenli kimlik doğrulama ve işlem kaydı (audit logging) yapılmasını sağlıyor. Ekosistem dört ulusal standarda dayanıyor: **TS 13582** genel çerçeveyi, **TS 13583** arayüz ve özellikleri, **TS 13584** güvenlik gereksinimlerini, **TS 13585** ise KEC uygulama yazılımı gereksinimlerini tanımlıyor. Cihaz firmware'i ayrıca Common Criteria kapsamındaki **"KEC Firmware Protection Profile v1.0"** çerçevesine göre değerlendiriliyor.

KEC terminalleri en çok GSM operatör bayilerinde, tapu/noter işlemlerinde ve sağlık kuruluşları gibi düzenlemeye tabi sektörlerde karşımıza çıkıyor — yani günlük hayatta oldukça sık temas ettiğimiz ama arka planında ne olduğunu pek düşünmediğimiz bir cihaz sınıfı.

---

## Temel Bileşenler ve Protokoller

Donanım tarafında bir KEC terminali; ISO 7816/NFC uyumlu akıllı kart okuyucu modülü, GEM (Secure Element), güvenli bir gerçek zamanlı saat (RTC), kurcalama (tamper) sensörleri, PIN pad/ekran, isteğe bağlı parmak izi sensörü ve USB/seri/Ethernet arayüzlerinden oluşuyor.

Yazılım/firmware tarafında ise secure boot, imzalı firmware güncellemeleri, KEC uygulama katmanı, PC/SC ve CCID sürücüleri ile yönetim/izleme ajanları bulunuyor.

Kriptografi ve protokol tarafında öne çıkan iki bileşen var: **PACE/EAC tabanlı erişim kontrolü** (BSI TR-03110 standardına dayanıyor — Almanya merkezli BSI'nin elektronik kimlik belgeleri için geliştirdiği, dünya genelinde de referans alınan bir protokol ailesi) ve **PKI/TLS/mTLS** tabanlı backend iletişimi. Kart ile terminal arasındaki iletişim ise sıkı erişim kurallarına bağlı APDU komut/cevap yapısı üzerinden yürüyor.

Biyometri desteği olan terminallerde, sahte parmak izi/yüz kullanımını engellemeye yönelik **ISO/IEC 30107 (Presentation Attack Detection – PAD)** uyumluluğu bekleniyor — yani sadece "biyometri var mı" değil, "bu biyometri gerçek bir insana mı ait, yoksa taklit bir örneğe mi" sorusuna da cevap veren bir katman.

---

## Saldırı Yüzeyi Haritası

Bir KEC terminalinin güvenlik değerlendirmesi yapılırken tek bir katmana odaklanmak yeterli olmuyor — cihaz, üretimden imhaya kadar birçok farklı katmanda risk taşıyor:

1. **Donanım** — tamper sensörleri, debug arayüzleri (UART/JTAG), bootloader güvenliği
2. **Firmware** — secure boot zorunluluğu, güncelleme doğrulaması, anahtar yönetimi
3. **Secure Element** — PIN/anahtar provisioning süreci, anahtar depolama koruması
4. **Kart etkileşimi (APDU/durum makinesi)** — PACE/EAC uygulamasının doğruluğu, durum geçişlerinin güvenliği
5. **Host ve sürücüler** — PC/SC, CCID, PKCS#11, SDK kütüphaneleri
6. **Ağ ve protokoller** — TLS/mTLS, sertifika doğrulama, zaman senkronizasyonu
7. **Backend servisleri** — API güvenliği, oturum bağlama, denetim kaydı
8. **Kullanıcı arayüzü ve süreçler** — kişisel mesaj doğrulaması, operatör davranışları
9. **Tedarik zinciri ve yaşam döngüsü** — üretim, sevkiyat, kurulum, hizmet dışı bırakma

Bu dokuz katman, aslında birbirinden bağımsız değil — birindeki küçük bir eksiklik diğerini etkisiz bırakabiliyor. Örneğin firmware imzalaması ne kadar sağlam olursa olsun, tedarik zincirinde bir donanım implantı yerleştirilmişse bu koruma anlamsızlaşıyor.

---

## Yaşam Döngüsüne Göre Zafiyet Sınıfları

Bir KEC cihazının güvenlik riskini tek bir "anlık fotoğraf" olarak değil, tasarımdan hizmet dışı bırakmaya kadar uzanan bir zaman çizelgesi olarak düşünmek gerekiyor.

**Tasarım aşaması.** Zayıf kriptografik politikalar, güncelliğini yitirmiş algoritmalar, KEC-backend arasında eksik karşılıklı kimlik doğrulama ve yetersiz korunan bir güvenli saat (RTC) bu aşamanın tipik riskleri. Buradaki temel önlem, modern kriptografiyi TR-03110 ile uyumlu şekilde kullanmak ve veri minimizasyonunu tasarımın bir parçası haline getirmek.

**Üretim ve provisioning.** Anahtar enjeksiyonu ve PIN yükleme süreçlerinin güvensiz yapılması, tamper korumasının hatalı kalibre edilmesi bu aşamada karşılaşılan sorunlar. Anahtarların HSM üzerinden yönetilmesi, dört göz prensibinin (four-eyes principle) uygulanması ve güvenli loglama burada kritik.

**Lojistik ve depolama.** Tedarik zinciri riskleri — donanım implantı ya da kötü amaçlı firmware'in cihaz henüz sahaya çıkmadan yerleştirilmesi — bu aşamanın en ciddi tehdidi. Chain-of-custody (gözetim zinciri) kontrolleri ve rastgele kabul testleri bu riski azaltmanın standart yöntemi.

**Kurulum ve entegrasyon.** Varsayılan kimlik bilgilerinin değiştirilmemiş olması, gereksiz açık servisler, eksik mTLS ya da sertifika sabitleme (pinning) bu aşamanın klasik hataları. mTLS + pinning kombinasyonu, kiosk moduna kilitlenmiş bir arayüz ve MDM (mobil cihaz yönetimi) zorunluluğu burada standart karşı önlemler.

**Operasyonel aşama.** İmzasız ya da eski sürüme düşürülebilen (downgrade edilebilen) firmware güncellemeleri ve APDU durum makinesindeki mantık hataları bu aşamada öne çıkıyor. Anti-rollback (geri sürüme düşürmeyi engelleme) zorunluluğu, imzalı loglama ve PAD uyumluluğu burada devreye giriyor.

**Bakım.** Uzaktan yönetim arayüzlerindeki zayıf kimlik doğrulama, en çok göz ardı edilen risklerden biri — zaman sınırlı erişim ve güvenli loglama bu riski azaltıyor.

**Hizmet dışı bırakma.** Hassas anahtarların sıfırlanmadan (zeroize edilmeden) cihazın elden çıkarılması, belki de en kolay gözden kaçan ama en pahalıya patlayabilecek hata. Güvenli silme ve gerektiğinde fiziksel imha burada standart pratik.

---

## Saldırı Vektörleri ve Yaygın Zayıflıklar

**Fiziksel/donanım.** Tamper bypass, fault injection (kasıtlı elektriksel/termal müdahaleyle cihazın beklenmedik davranmasını sağlamak) ve yan kanal (side-channel) saldırıları bu kategoride. Epoksi dolgu, elektromanyetik ekranlama ve tetiklendiğinde anahtarları sıfırlayan zeroization mekanizmaları standart savunma.

**Firmware.** Secure boot doğrulamasının eksik olması ve parser (ayrıştırıcı) zafiyetleri en sık karşılaşılan sorunlar. İmzalı, versiyonlanmış güncellemeler ve fuzz testing burada koruyucu rol oynuyor.

**Secure Element.** Zayıf PIN/anahtar yükleme politikaları ve rastgele sayı üretecindeki (RNG) zayıflıklar kritik risk taşıyor. Sertifikalı bir SE kullanımı, hız sınırlama (rate-limiting) ve kilitlenme mekanizmaları bu riski azaltıyor.

**Protokol düzeyi (PACE/EAC).** Downgrade saldırıları ve eksik terminal yetkilendirme kontrolleri bu katmanın tipik zafiyetleri. TR-03110 uyumluluk testleri ve negatif test senaryoları (protokolün "olmaması gereken" durumlarda nasıl davrandığını test etmek) burada gerekli.

**Host ve sürücüler.** DLL hijacking ve imzasız sürücü kullanımı klasik Windows-tarafı riskleri. Kod imzalama zorunluluğu ve uygulama beyaz listesi (whitelisting) burada standart önlem.

**Ağ güvenliği.** Eksik mTLS ve zayıf sertifika doğrulaması, backend iletişiminin en kritik açığı. TLS sertleştirmesi, sertifika pinning ve kısa ömürlü sertifikalar burada önerilen yaklaşım.

**Backend.** Zayıf işlem bağlama (transaction binding) ve replay saldırısı riski — nonce ve zaman damgası zorunluluğu, imzalı loglama bu riski azaltıyor.

**Kullanıcı arayüzü ve sosyal mühendislik.** Kişisel mesaj ekranının operatör tarafından göz ardı edilmesi ya da zayıf PAD, insan faktörünün devreye girdiği kısım. Operatör eğitimi ve çift kanallı doğrulama burada gerekli.

---

## Örnek Tehdit Senaryoları (Yüksek Seviye)

Aşağıdaki senaryolar, spesifik bir istismar adımı değil, hangi zafiyet sınıfının hangi sonuca yol açabileceğini göstermek amacıyla verilmiştir.

**Zayıf TLS doğrulaması → MITM → işlem manipülasyonu.** Sertifika doğrulaması gevşek yapılandırılmışsa, ağ konumunda bulunan bir saldırgan işlem trafiğine müdahale edebilir. Önlem: mTLS, pinning, imzalı işlem bağlama.

**İmzasız/downgrade edilmiş firmware → güvenlik atlaması.** Anti-rollback koruması yoksa, cihaz bilinen zafiyetleri olan eski bir firmware sürümüne düşürülebilir. Önlem: secure boot, versiyon sayaçları, anti-rollback.

**APDU durum makinesi hatası → yetkisiz veri erişimi.** PACE/EAC uygulamasındaki bir durum geçiş hatası, normalde erişilemeyen bir veri alanına erişime yol açabilir. Önlem: formal doğrulama, TR-03110 protokol testleri.

**Host SDK istismarı → yetki yükseltme.** Terminal ile konuşan host tarafı yazılımdaki bir zafiyet, sistem üzerinde daha yüksek yetki elde etmek için kullanılabilir. Önlem: en az ayrıcalık ilkesi, EDR izleme, sandboxing.

**PAD eksikliği → biyometrik sahtecilik.** Zayıf ya da sertifikasız bir PAD çözümü, sahte parmak izi/yüz ile doğrulamayı atlatmaya açık kapı bırakabilir. Önlem: ISO/IEC 30107-3 sertifikalı PAD çözümleri.

---

## Yetkili Güvenlik Testi Planı

Bu tür bir değerlendirmenin başlayabilmesi için üç ön koşul gerekiyor: yazılı yetkilendirme, net tanımlanmış kapsam ve izole bir laboratuvar ortamı.

Tipik bir test akışı şu şekilde ilerliyor: tehdit modelleme ile başlanır, ardından yapılandırma incelemesi, ağ/TLS denetimi, protokol uyumluluk testi, firmware güncelleme doğrulaması, sürücü/SDK güvenlik testleri, gizlilik etki değerlendirmesi ve PAD sertifikasyon kontrolleriyle devam edilir.

Sınırlar da en az adımlar kadar önemli: fiziksel imha yapılmaz, gerçek kişisel veriye erişilmez ve canlı üretim ortamına müdahale edilmez. Bu üç sınır, bu tür bir değerlendirmeyi klasik bir "red team saldırısından" ayıran temel fark.

---

##  Sertleştirme Kontrol Listesi

Aşağıdaki liste, bir KEC dağıtımının minimum güvenlik seviyesini karşılayıp karşılamadığını hızlıca kontrol etmek için kullanılabilir:

- Secure Boot + anti-rollback + kapatılmış debug arayüzleri
- Modern kriptografi; anahtarlar SE/HSM içinde saklanıyor
- İmzalı, versiyon kontrollü güncellemeler
- Sıkı mTLS + sertifika pinning
- Host sistemlerde uygulama beyaz listesi
- TR-03110 protokol uyumluluk testleri
- Biyometrik modüller için PAD sertifikasyonu
- İmzalı, gizlilik uyumlu loglama

---

## İhlal Göstergeleri (Indicators of Compromise)

Sahada bir KEC terminalinin normalden saptığını gösterebilecek işaretler:

- TLS ya da sertifika zinciri hataları
- Beklenmeyen firmware sürüm değişiklikleri
- Anormal APDU komut dizileri
- Başarısız PAD denemelerinde ani artış
- Yönetim arayüzlerinde alışılmadık IP kaynakları

---

## Sonuç

KEC terminalleri, ilk bakışta sıradan bir kart okuyucu gibi görünse de aslında PACE/EAC protokolü, secure element mimarisi, PKI tabanlı backend iletişimi ve biyometrik PAD kontrollerinin iç içe geçtiği, kimlik doğrulama zincirinin fiziksel uç noktasını oluşturuyor. Bu yüzden güvenlik değerlendirmesi de tek bir katmana (örneğin sadece "kart mı klonlanabiliyor") odaklanarak yapılamaz — donanımdan tedarik zincirine, firmware'den backend'e kadar uzanan tüm yaşam döngüsünün birlikte ele alınması gerekiyor.

Pratik sonuç şu: "TR-03110 uyumluyuz" ya da "secure element kullanıyoruz" demek tek başına yeterli değil. Anti-rollback var mı, mTLS pinning uygulanıyor mu, tedarik zincirinde gözetim zinciri kontrolleri var mı, uzaktan yönetim erişimi zaman sınırlı mı — asıl güvenlik seviyesini bu soruların toplu cevabı belirliyor. Ulusal kimlik altyapısının bir parçası olan bu tür cihazlarda, zincirin herhangi bir halkasındaki zayıflık, tek bir terminali değil potansiyel olarak tüm ekosistemin güvenilirliğini etkileyebiliyor.

---

## Kaynakça

- TSE TS 13582-13585 — Ulusal KEC standartları
- TÜBİTAK BİLGEM OKTEM laboratuvarı test kapsamları
- Common Criteria — KEC Firmware Protection Profile v1.0
- BSI TR-03110 — PACE/EAC protokolleri
- ISO/IEC 30107-3 — Biyometrik PAD değerlendirmesi
- NVİ (Nüfus ve Vatandaşlık İşleri Genel Müdürlüğü) EKDS tanımları ve kamuya açık kullanım senaryoları
