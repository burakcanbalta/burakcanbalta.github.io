![aaa](https://github.com/user-attachments/assets/9bab4af5-e828-4546-91d6-084676cb1e55)

Eğer detaylı bir şekilde izlemek isterseniz linki bırakıyorum aşağıya:
[Video](https://www.youtube.com/watch?v=Hk3QtBXftWE)

## Giriş

**PKES (Passive Keyless Entry & Start)**, aracın yakınındaki yetkili bir anahtarlığı ya da telefonu tespit edip kullanıcı herhangi bir düğmeye basmadan kapıyı açması ve motoru çalıştırabilmesi anlamına geliyor. Amaç basit: cepten anahtar çıkarma zahmetini ortadan kaldırmak. Ama bu kullanıcı deneyimi kolaylığı, aynı zamanda saldırganlar için yeni bir yüzey açıyor — radyo protokolü katmanı, link katmanı, uygulama katmanı ve araç içi ağların (CAN bus) birbirine zincirlendiği bir saldırı yüzeyi.

Tesla özelinde bu yüzey son sekiz-dokuz yılda akademik ve endüstriyel araştırma ekipleri tarafından defalarca test edildi. Ortaya çıkan tablo tek bir zafiyetten değil; zayıf kriptografi, yanlış yapılandırma, eksik karşılıklı kimlik doğrulama ve firmware doğrulama eksikliklerinin bir araya gelmesinden oluşuyor.



---

## Saldırı Türleri

### Röle (Relay) Saldırıları

Röle saldırısında amaç, yetkili cihaz (fob/telefon) ile araç arasındaki radyo sinyalini iki nokta üzerinden şeffaf biçimde iletmek — bir nevi sinyali "uzatmak". Araç, anahtarın fiziksel olarak menzilde olduğunu düşünüyor çünkü sinyal gerçekten oradan geliyormuş gibi davranıyor; sadece araya bir aktarım katmanı girmiş oluyor.

Bu saldırının işe yaramasının temel nedeni, birçok sistemin mesafe kararını RSSI (sinyal gücü) ve gecikme toleransına dayandırması. Eğer eklenen aktarım gecikmesi, sistemin normal varyasyon olarak kabul ettiği aralığın içinde kalırsa, saldırı sistemin gözünden "görünmez" hale geliyor. NCC Group'un Model 3/Model Y üzerinde gösterdiği BLE link-layer relay tekniği tam olarak bu prensibe dayanıyor.

### Replay, Jamming ve Downgrade

**Replay** saldırısında daha önce kaydedilmiş bir mesaj yeniden gönderiliyor. Rolling-code (her kullanımda değişen kod) mekanizmaları bunu genel olarak engellemek için tasarlanmış olsa da, uygulamadaki belirli tasarım hataları replay'e izin verebiliyor.

**Jamming + rollback** ise farklı bir yaklaşım: saldırgan araç ile fob arasındaki iletişimi bozarak (jam ederek) tarafları daha eski, daha zayıf bir şifreleme protokolüne düşmeye zorluyor. KU Leuven'in gösterdiği downgrade saldırıları bu kategoriye giriyor — sistem geriye dönük uyumluluk için eski protokolü kabul ettiği sürece, saldırgan bu eski protokolün zayıflığından faydalanabiliyor.

### Kopyalama (Cloning) ve Zayıf Kriptografi

Burada hedef, key fob içindeki kriptografik anahtarın kısmen ya da tamamen açığa çıkarılması. Tesla'nın eski nesil fob'larında kullanılan **DST40** gibi özel (proprietary) ve kısa anahtar uzunluğuna sahip şifreleme algoritmaları, akademik camiada uzun süredir bilinen bir risk kategorisi: zayıf anahtar alanı ya da yapılandırma hatası, brute-force veya kriptoanalizle pratikte kırılabilir hale geliyor.

### Firmware Manipülasyonu ve Provisioning Akışı Hataları

Anahtarlık ya da araç tarafındaki firmware güncelleme veya eşleme (provisioning) akışında eksik doğrulama varsa — yani gelen paket imzalı değilse ya da imza doğru kontrol edilmiyorsa — kötü amaçlı bir paketle cihazın davranışı değiştirilebiliyor. Bu, saf bir kriptografi zafiyeti değil, süreç/mimari tasarımı zafiyeti.

### Zincirsel Saldırılar: Kablosuzdan CAN Bus'a Pivot

En kritik senaryo, tek bir kablosuz erişim noktasının araç içindeki başka bileşenlere (gateway ECU, telematik ünitesi gibi) pivot yaparak CAN bus'a kadar uzanması. Keen Security Lab'in 2016'daki çalışması, bunun teorik değil pratikte mümkün olduğunu göstermişti — web tarayıcısı üzerinden başlayan bir zincir, sonunda CAN verisine kadar ulaşabiliyordu.

---

## Tarihçe

**2016 — Keen Security Lab.** Tesla Model S üzerinde, aracın web tarayıcısı ile kötü amaçlı bir Wi-Fi erişim noktası arasındaki etkileşimden başlayan zincirsel bir zafiyet gösterildi; sonunda CAN verisi manipüle edilebiliyordu. Bu çalışma, otomotiv endüstrisinde OTA code-signing'in (imzalı yazılım dağıtımı) önemini gündeme taşıyan dönüm noktalarından biri oldu.

**2018 — KU Leuven, Model S.** Araştırmacılar mevcut key fob sisteminin DST40 gibi zayıf ve özel bir şifreleme kullandığını, bu 40-bit sınıfı zayıflığın araçların klonlanmasına yol açabildiğini duyurdu.

**2019-2020 — KU Leuven, Model S & X takip çalışmaları.** Tesla yeni fob'larda iyileştirme yapmış olsa da, yapılandırma ve downgrade hataları nedeniyle kopyalama/analiz yine mümkün olduğu gösterildi.

**2022 — NCC Group, Model 3 BLE relay.** BLE link-layer relay tekniğiyle phone-as-key sistemlerinde relay saldırısı gösterildi. Sistemin kabul ettiği gecikme marjının (birkaç onlarca milisaniye mertebesinde) saldırıyı pratikte uygulanabilir kıldığı ortaya çıktı.

Bu kaynaklar arasında KU Leuven/imec duyuruları, NCC Group'un teknik yayınları, Keen Security Lab'in BlackHat sunumu ve konuyu takip eden Wired gibi yayın organlarının haberleri sayılabilir.

---

## Zafiyetlerin Kök Nedenleri

Bu vakaların ortak paydasına bakıldığında altı temel yapısal zayıflık öne çıkıyor:

**Miras/proprietary kriptografi.** DST40 gibi, yeterince akademik incelemeden geçmemiş ve kısa anahtar uzunluğuna sahip özel algoritmalar ciddi risk taşıyor. Açık, standartlaşmış ve yaygın incelenmiş algoritmalar (AES, eliptik eğri tabanlı yöntemler) bu açıdan çok daha güvenilir bir temel sunuyor.

**Yanlış yapılandırma / downgrade izinleri.** Bir cihazın daha eski ve zayıf bir protokol moduna geri dönmesine izin vermek, güvenlik mimarisindeki en kritik hatalardan biri — çünkü sistemin en zayıf desteklediği mod, gerçek güvenlik seviyesini belirliyor.

**Eksik karşılıklı kimlik doğrulama (mutual authentication).** Araç ile fob arasındaki doğrulama tek yönlü ya da zayıfsa, bu durum doğrudan relay ve replay saldırılarına zemin hazırlıyor.

**İmzasız ya da yanlış doğrulanmış firmware.** Firmware veya yapılandırma paketleri kriptografik olarak doğrulanmıyorsa, cihaz davranışı nispeten kolay şekilde manipüle edilebiliyor.

**Güvenilir mesafe ölçümünün olmaması.** Sadece RSSI veya gecikme toleransına dayanan karar mekanizmaları röle saldırılarına yapısal olarak açık — çünkü bu yöntemler "cihaz gerçekten yakında mı" sorusuna kriptografik değil, istatistiksel bir cevap veriyor.

**Bileşen etkileşimleri ve saldırı zincirleri.** Tek başına küçük ve önemsiz görünen zafiyetler, birden fazla bileşen üzerinden zincirlendiğinde kritik etkiye ulaşabiliyor — Keen Security Lab'in 2016 çalışması bunun somut örneği.

---

## Araştırmada Kullanılan Donanım Kategorileri

Bu tür araştırmalar genelde şu donanım sınıflarına dayanıyor:

- **SDR (Software Defined Radio) ve spektrum analizörleri** — PKES ve rolling-code protokollerinin radyo trafiğini incelemek, protokol özelliklerini çıkarmak için.
- **BLE sniffer'lar ve link-layer debug araçları** — phone-as-key ve BLE tabanlı protokollerin zamanlama/cevap örüntülerini analiz etmek için.
- **CAN bus sniffer ve loglama araçları** — araç içi ağ trafiğinin kaydı, mesaj yapısının analizi ve anomali tespiti için.
- **Gömülü geliştirme kartları / SBC'ler** — ölçüm, prototipleme ve test otomasyonu için.
- **JTAG/SWD gibi donanım programlama ekipmanı** — yalnızca sahip olunan cihazlar üzerinde firmware analizi için.

---

## Vaka İncelemeleri

**KU Leuven — Model S (DST40 ve downgrade).** Eski şifreleme algoritmasının zayıflığı ile fob/araç yazılımındaki yapılandırma hatasının birleşimi, saldırıyı teorik olarak mümkün kılıyordu. Tesla yazılım güncellemesi ve bazı fob değişiklikleriyle sorunu kapattı; ayrıca kullanıcılar ek bir PIN katmanı (PIN-to-Drive) kullanmaya yönlendirildi.

**KU Leuven/imec — Model X.** Keyless entry akışının bazı adımlarında yeterli doğrulama yapılmadığı ve provisioning/güncelleme mantığında açıklar olduğu görüldü — bu da daha karmaşık senaryolarda fob davranışının manipüle edilebileceğini gösterdi. Sorun hem yazılım yamalarıyla hem de mimari önerilerle kapatıldı.

**NCC Group — Model 3 BLE relay.** Link-layer relay tekniği, BLE bağlantısının şifreli olması ya da standart GATT zamanlaması içinde kalması gerektiği yönündeki varsayımları atlatabiliyordu. Önemi büyük: telefon fiziksel olarak araçtan uzaktayken bile aracın açılabildiği gösterildi — bu, önceki relay senaryolarından daha geniş bir tehdit modeli anlamına geliyor.

**Keen Security Lab (2016) — Web/OTA'dan CAN'a pivot.** Aracın web tarayıcısının kötü amaçlı bir Wi-Fi erişim noktasıyla etkileşimi üzerinden başlayan zincirsel bir saldırı, sonunda CAN verisinin manipülasyonuna kadar uzanabiliyordu. OTA code signing ve hızlı yamalarla kısmen kapatılsa da, gösterilen kavram otomotiv endüstrisi için önemli bir uyarı niteliğindeydi.

---

## Tespit ve Adli Bilişim İpuçları

Bu tür saldırıların izini sürerken bakılması gereken başlıca kaynaklar:

- **Anahtar eşleştirme/kayıt değişiklikleri** — araç geçmişinde beklenmeyen yeni fob eşleştirmeleri.
- **Gateway/telematik bağlantı kayıtları** — olağandışı Wi-Fi SSID'leri, yetkisiz OTA deneme kayıtları.
- **CAN bus anomalileri** — normalden farklı mesaj tipleri veya zamanlama sapmaları.
- **Fob/telefon tarafı kayıtları** — mobil uygulama kimlik doğrulama zamanları, şüpheli yeniden bağlanma olayları.
- **RSSI/mesafe metriği logları** — ani ve fiziksel olarak tutarsız mesafe okumaları (örneğin sinyal gücünün fiziksel hareketle uyuşmayan değişimi).

---

## Mühendislik ve Ürün Tasarımı Önerileri

**Açık, incelenmiş kriptografi.** Özel ve kısa anahtar uzunluklu algoritmalardan kaçınmak, anahtar yönetimini ve anahtar uzunluğunu güncel standartlarla hizalamak.

**Karşılıklı kimlik doğrulama ve oturum bağlama.** Hem fob hem araç birbirini doğrulamalı; kurulan oturumlar sağlam biçimde bağlanmalı, tek yönlü güven modelinden kaçınılmalı.

**İmzalı firmware / secure boot.** Firmware paketleri ve önyükleme zinciri imzalanmalı, tedarik zincirindeki her adım doğrulanabilir olmalı.

**Distance bounding / time-of-flight (UWB gibi).** RSSI tabanlı yaklaşık mesafe tahmini yerine, sinyalin gerçek uçuş süresini ölçen protokoller röle saldırılarına karşı çok daha dirençli — bu yüzden UWB (Ultra-Wideband) tabanlı çözümler son yıllarda otomotiv endüstrisinde öne çıkıyor.

**Provisioning akışının sertleştirilmesi.** Fob eşleme süreçleri fiziksel ya da kriptografik kanıt gerektirmeli, sadece kablosuz bir istekle tetiklenmemeli.

**Anomali tespiti ve telemetri.** Araç içi davranışlar, RSSI/zamanlama anomalileri sürekli izlenerek gerçek zamanlı uyarı üretilmeli.

**Güncelleme süreçlerinin doğrulanması.** Geriye dönük uyumluluk kararları (eski protokolü desteklemeye devam etmek gibi) risk-maliyet analizine tabi tutulmalı — "eski cihazlar da çalışsın" kolaylığı, downgrade saldırılarının asıl kapısı olabiliyor.

---

## Kullanıcı Düzeyinde Alınabilecek Önlemler

- **PIN-to-Drive özelliği varsa aktif edilmeli** — aracın yalnızca fiziksel/şifreli bir onayla çalışmasını sağlıyor ve relay saldırısının son adımını etkisiz kılıyor.
- **Pasif giriş kapatma seçeneği** kullanılabilir — bu durumda anahtar/telefon üzerinde fiziksel bir onay (buton) gerekir.
- **Fob ve telefonlar fiziksel olarak korunmalı** — örneğin RF sinyalini bloke eden bir kutu/çanta kullanmak, sinyalin dışarıdan yakalanabilirliğini azaltıyor.
- **Araç yazılımı güncel tutulmalı** — üreticinin yayınladığı güvenlik yamaları çoğu zaman tam olarak bu tür zafiyetleri kapatmak için çıkıyor.

---

## Saldırı Akışlarının Kavramsal Gösterimi

Aşağıdaki adımlar, saldırıların nasıl işlediğini kavramsal düzeyde açıklamak amacıyla verilmiştir; doğrudan uygulanabilir bir prosedür değildir.

**Röle saldırısı** kabaca şöyle ilerliyor: saldırgan araç yakınına bir cihaz, anahtar/telefon yakınına başka bir cihaz yerleştirir; iki cihaz arasındaki protokol akışı önce pasif olarak gözlemlenir; ardından araç ile anahtar arasındaki radyo sinyali mümkün olduğunca şeffaf biçimde iki cihaz arasında aktarılır. Sistem eklenen gecikmeyi normal varyasyon olarak algılarsa kilit açma/çalıştırma tetiklenir. Saldırı başarısız olsa bile ölçülen gecikme/RTT verileri, savunma tarafında tespit eşiği belirlemek için kullanılabilir.

**Replay/kopyalama** tarafında süreç dinleme (protokol mesajlarının pasif kaydı), analiz (rolling-code/nonce kullanımının değerlendirilmesi, zayıflık varsa tekrar kullanım senaryosunun teorik olarak kurgulanması) ve denetim (kaydedilen örüntülerin araç loglarıyla karşılaştırılıp sıra numarası atlamalarının tespit edilmesi) adımlarından oluşuyor.

**Firmware/provisioning zafiyeti** araştırmasında ise önce fob-araç eşleştirme akışı ve OTA süreci haritalanıyor, ardından imza/sertifika mekanizmalarının varlığı ve doğruluğu denetleniyor; imza doğrulaması yoksa ya da yanlış yapılandırılmışsa bu tasarım düzeyinde bir bulgu olarak raporlanıyor.

---

## Güvenli Laboratuvar Test Planı

Bu tür araştırmaların gerçek bir araca veya üçüncü şahıslara zarar vermeden yürütülmesi için tipik bir çalışma planı şu adımları içeriyor:

1. **İzin ve yönetim** — yazılı izin, kapsam (scope), zaman çizelgesi ve rollback planı önceden netleştirilir.
2. **İzole test ortamı kurulumu** — Faraday çantası/odası, izole CAN test düzeneği, test amaçlı fob'lar ve araç simülatörleri hazırlanır.
3. **Baseline toplama** — normal çalışma sırasında telemetri, RSSI dağılımı ve protokol zamanlaması kayıt altına alınır.
4. **Kavramsal deneyler** — relay etkinliğinin teorik sınırları laboratuvar ortamında, doğrudan gerçek bir aracı hedeflemeden ölçülür; amaç savunma tarafının kabul edeceği gecikme aralığını (latency envelope) belirlemektir.
5. **Provisioning/firmware doğrulaması** — güncelleme paketlerinin imza doğrulama adımları ve eşleştirme akışının mantıksal güvenliği değerlendirilir.
6. **Anomali tespit kurallarının geliştirilmesi** — CAN/telemetri/RSSI anomali kuralları oluşturulup gerçek zamanlı uyarı mekanizmaları test edilir.
7. **Raporlama ve sorumlu açıklama** — bulgular üreticiye veya ilgili CERT'e koordineli biçimde bildirilir.

---

## Ürün Geliştirme Tarafında Ek Öneriler

- **UWB prototip entegrasyonu** — distance bounding deneyleriyle relay toleransları fiziksel katmanda ölçülmeli.
- **Fob tasarımında secure element kullanımı** — anahtarların donanım tabanlı, ayrı bir güvenli bileşende saklanması.
- **OTA code signing iş akışı** — üretimden dağıtıma kadar imzalama anahtarlarının korunması ve bir revocation (iptal) planının olması.
- **Telemetri ve ML tabanlı anomali tespiti** — RSSI/zamanlama/CAN örüntülerinden anormal senaryoları öğrenen modellerin geliştirilmesi.

---

## Sonuç

Tesla ve genel olarak çağdaş otomotiv üreticilerinin PKES/phone-as-key sistemleri kullanıcı deneyimi açısından gerçekten kolaylık sağlıyor, ama arkasında oldukça karmaşık bir güvenlik gereksinimi barındırıyor. Tarihçeye bakıldığında görülen şu: tek başına "kötü" bir bileşen yok, birbirini besleyen tasarım ve yapılandırma kararları var — zayıf bir kriptografi seçimi, geriye dönük uyumluluk için bırakılan bir downgrade yolu, eksik bir imza kontrolü, ya da sadece sinyal gücüne dayanan bir mesafe kararı.

Güncel araştırma yönü net bir şeyi gösteriyor: gerçek dayanıklılık, daha güvenilir mesafe ölçümü (UWB gibi time-of-flight temelli yöntemler), güçlü ve standart anahtar yönetimi, imzalı firmware ve kapsamlı telemetri/anomali tespitinin birlikte uygulanmasından geliyor. Bunlardan herhangi biri eksik kaldığında, geri kalan katmanlar da tek başına yeterli koruma sağlayamıyor.

---

## Kaynakça ve Ek Okuma

- Keen Security Lab (2016). *Tesla Model S — Remote Attack via Web Browser and Chained Vulnerabilities.* BlackHat / DEF CON sunumları.
- KU Leuven / imec (2018). *Fast, Furious and Insecure: Passive Keyless Entry and Start Systems in Modern Supercars* — DST40 ve Tesla Model S üzerine bulgular.
- KU Leuven / imec (2019-2020). Model S & Model X üzerine takip çalışmaları.
- NCC Group (2022). *BLE Link-Layer Relay Attacks on Tesla Model 3 Phone-as-Key.*
- Wired ve ilgili teknoloji basınının konuyu takip eden haberleri.
