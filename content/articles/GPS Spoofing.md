![Ekran görüntüsü 2025-08-16 150957](https://github.com/user-attachments/assets/f9838b1e-6f39-4cbd-aa77-276f27446a66)

## GPS Spoofing ve Konum Yönlendirme: GNSS Güvenliğine Teknik Bir Bakış

## Giriş

GNSS (Global Navigation Satellite System) — GPS, Galileo, GLONASS, BeiDou — artık sadece "navigasyon" değil. Ulaşım, finans (borsa işlemlerinin zaman damgalanması), telekom (baz istasyonu senkronizasyonu), enerji şebekeleri ve savunma sistemleri, GNSS'in ürettiği konum ve zaman bilgisine doğrudan bağımlı. Bu bağımlılık, GNSS'i hem kritik hem de saldırı yüzeyi geniş bir altyapı haline getiriyor.

Sorunun kökeninde şu var: sivil GNSS sinyalleri, tasarım gereği açık ve doğrulamasız. Bir GPS alıcısı, sinyal yeterince güçlü ve yapısal olarak "doğru" göründüğü sürece onu gerçek kabul ediyor — sinyalin gerçekten bir uydudan gelip gelmediğini kriptografik olarak doğrulayan bir mekanizma çoğu sivil sistemde yok. Bu, GNSS spoofing'in teorik temelini oluşturuyor.

---

## GPS Spoofing Nedir?

GPS spoofing, bir alıcıya sahte konum, hız veya zaman verisi göndererek yanlış bir PVT (Position, Velocity, Time) çözümü hesaplatma saldırısıdır. Alıcı, gerçek uydu sinyalleri yerine (veya onların üzerine binen) sahte sinyalleri işleyerek olması gerekenden farklı bir konumda, farklı bir zamanda veya farklı bir hızda olduğuna "inanır".

Bu saldırının araştırılması ve simüle edilmesi meşru birkaç amaca hizmet ediyor:

- **Savunma ve elektronik harp (EW) testleri** — GNSS'e bağımlı sistemlerin dayanıklılığının değerlendirilmesi
- **Drone ve otonom sistem güvenlik testleri** — navigasyon sisteminin sahte sinyallere karşı davranışının analiz edilmesi
- **Kritik altyapı risk analizi** — zaman/konum bağımlı sistemlerin (finans, telekom, enerji) spoofing senaryolarına dayanıklılığının ölçülmesi
- **Akademik araştırma** — yeni tespit algoritmalarının geliştirilmesi ve doğrulanması

---

## Zafiyetin Teknik Kaynakları

GPS spoofing'in mümkün olmasının tek bir nedeni yok; birkaç yapısal zayıflığın bir araya gelmesinden besleniyor.

### Sivil GNSS Sinyallerinin Doğrulamasız Olması

Sivil GPS (L1 C/A), Galileo (E1 açık servis) ve GLONASS sinyalleri şifrelenmiyor ve mesaj düzeyinde kriptografik doğrulama içermiyor. Askeri GPS sinyalleri (P(Y) kodu, M-code) şifreli ve bu yüzden taklit edilmesi çok daha zor; ama sivil tarafta alıcı, kendisine ulaşan sinyalin yapısal olarak doğru göründüğü ve gücü belirli bir eşiğin üzerinde olduğu sürece onu gerçek kabul ediyor. Bu durum literatürde genelde "güç temelli güvenlik" (power-based trust) olarak adlandırılıyor — ve tam olarak spoofing'in istismar ettiği nokta burası: sahte sinyal, gerçek uydu sinyalinden daha güçlü gönderildiğinde alıcının izleme döngüsü (tracking loop) sahte sinyale kilitlenir.

### Tek Kaynak Bağımlılığı

Alıcı tek bir GNSS konstelasyonuna (örneğin sadece GPS L1) bağımlıysa, tek bir sahte sinyal kaynağı alıcıyı tamamen yanıltabilir. Buna karşılık multi-constellation (GPS + Galileo + GLONASS + BeiDou) ve multi-frequency (L1 + L5 gibi) alıcılarda saldırganın aynı anda tüm sinyalleri tutarlı biçimde taklit etmesi gerekir — bu, saldırının karmaşıklığını ve maliyetini önemli ölçüde artırır.

### Zaman ve Faz Hassasiyeti

Bir GNSS alıcısı, her uydudan gelen sinyalin hem yayılma kodunu (C/A code) hem taşıyıcı fazını (carrier phase) sürekli takip eder. PVT çözümü bu takibe dayanır. Kod ve fazdaki milisaniyenin çok altındaki değişiklikler bile konum çözümünü kaydırmaya yetebiliyor — bu da "aligned/carry-off" tarzı kademeli saldırıların neden etkili olabildiğini açıklıyor: alıcı, sinyaldeki değişimi ani bir sıçrama olarak değil, doğal bir drift gibi algılıyor.

### Alıcı Tarafındaki Mantıksal Eksiklikler

Birçok tüketici sınıfı ve hatta bazı endüstriyel alıcıda **RAIM (Receiver Autonomous Integrity Monitoring)** ya kapalı ya da zayıf yapılandırılmış durumda. RAIM, alıcının aldığı uydu ölçümleri arasındaki tutarsızlıkları (bir uydunun diğerleriyle uyuşmayan bir çözüm üretmesi gibi) tespit etmeye çalışan bir bütünlük kontrolü. Benzer şekilde Doppler kayması ve carrier-to-noise oranı (C/N0) analizi yapılmıyorsa, sahte sinyalin "fiziksel olarak tutarsız" davranışı (örneğin gerçekçi olmayan Doppler değerleri) fark edilmeden kabul edilebiliyor.

---

## Saldırı Teknikleri

Literatürde spoofing saldırıları genelde karmaşıklık ve gerçekçilik seviyesine göre dört kategoride sınıflandırılır.

**Replay / Meaconing.** En basit yöntem: gerçek bir GNSS sinyali kaydedilip, daha sonra (aynı yerde ya da başka bir yerde) aynen tekrar yayınlanır. Saldırgan sinyali üretmez, sadece "kaydedip oynatır". Alıcı bu durumda kısa süreli ve genelde tutarsız bir yanlış konum üretir; sofistike değildir ama düşük maliyetlidir ve pratikte hâlâ etkili olabilir.

**Aligned / Carry-off Spoofing.** Daha gelişmiş bir teknik: saldırgan önce sahte sinyali gerçek sinyalle zaman ve faz olarak senkronize eder (alıcı fark etmeden "yanına oturur"), sonra sahte sinyalin gücünü kademeli olarak artırıp gerçek sinyalin üstüne çıkararak alıcının izleme döngüsünü ele geçirir (carry-off). Bu noktadan sonra konum ve rota bilgisi saldırgan tarafından kademeli olarak manipüle edilebilir. Ani bir sıçrama olmadığı için tespiti replay saldırılarına göre daha zordur.

**Fake Constellation (Tam Sahte Takımyıldız).** Bu yöntemde gerçek sinyalle senkronizasyon aranmaz; laboratuvar/simülatör ortamında tamamen sahte, kendi içinde tutarlı bir uydu takımyıldızı üretilir. Alıcı bu sahte takımyıldızı gerçek sanıp doğrudan yanlış bir PVT çözümüne kilitlenir. Test ve araştırma senaryolarında en çok kullanılan yaklaşım budur çünkü kontrol edilebilirliği yüksektir.

**Sensor Fusion Bypass.** Modern otonom sistemler (drone, araç) genelde sadece GNSS'e değil; IMU, odometri ve görüntü tabanlı navigasyona da güveniyor. Eğer sistem bu sensörler arasında çapraz kontrol (cross-check) yapmıyorsa, sahte GNSS sinyali diğer sensörlerle "senkronize" görünecek şekilde tasarlanarak sensör füzyonu katmanı da atlatılabilir. Bu, saf GNSS spoofing'den daha karmaşık ama gerçek dünyadaki otonom sistemler için daha gerçekçi bir tehdit modelidir.

---

## Test ve Analiz Metodolojisi

Bir spoofing senaryosunun (savunma amaçlı) sistematik olarak değerlendirilmesi genelde şu aşamalardan geçer:

1. **Hedef alıcı analizi** — Hangi konstelasyon(lar) destekleniyor, RAIM ve plausibility kontrolleri aktif mi, tek frekans mı çoklu frekans mı kullanılıyor?
2. **Sinyal modelleme** — Offline I/Q veri setleri veya bir GNSS simülatörü kullanılarak sahte sinyal üretilir; sinyal gücü ve faz senkronizasyonu kontrollü laboratuvar koşullarında ayarlanır.
3. **Senaryo testi** — Üretilen sahte sinyal karşısında alıcının PVT çözümündeki değişim gözlemlenir; konum, hız ve zaman sapmaları kayıt altına alınır.
4. **Tespit ve analiz** — Doppler kayması, C/N0 tutarlılığı ve PRN (Pseudo-Random Noise code) tutarlılığı gibi sinyal özellikleri incelenir; CUSUM (Cumulative Sum) gibi istatistiksel yöntemler veya makine öğrenmesi tabanlı sınıflandırıcılar anomali tespiti için kullanılabilir.

### Laboratuvar Bazlı ve Etik Deney Tasarımı

Bu tür araştırmaların **canlı RF yayını yapılmadan**, yalnızca kontrollü ortamda yürütülmesi hem yasal hem etik açıdan zorunludur — çoğu ülkede spektrum düzenleyicisinin izni olmadan GNSS bantlarında sinyal yaymak suç teşkil eder ve gerçek sistemleri (uçak, gemi, acil durum hizmetleri) etkileme riski taşır. Bu yüzden akademik ve kurumsal çalışmalar genelde şu yaklaşımı izler:

- Canlı yayın yerine **önceden kaydedilmiş, açık erişimli I/Q veri setleri** kullanılır — bu alanda en sık referans verilen kaynaklar arasında **TEXBAT** (University of Texas Spoofing Test Battery), **FGI** (Finnish Geospatial Research Institute) veri setleri ve Mendeley Data üzerinde paylaşılan çeşitli GNSS kayıtları sayılabilir.
- Sinyal üretimi gerekiyorsa RF yayını yapılmaz; iş, bir **GNSS simülatörü** içinde veya kablolu/izole (shielded/anechoic) bir laboratuvar ortamında tutulur.
- Değerlendirme için **Detection Rate, False Positive Rate, Time-to-Detect ve konum hatası (position error)** gibi performans metrikleri kullanılır.
- Tespit tarafında CUSUM gibi klasik istatistiksel yöntemlerin yanında Random Forest ve LSTM gibi makine öğrenmesi modelleri de literatürde sıkça kullanılıyor.

### Adım Adım Analiz Akışı

Tipik bir araştırma akışı şu şekilde ilerler: önce uygun bir veri seti (TEXBAT veya FGI gibi) seçilir; ardından SNR, Doppler kayması, görünür PRN sayısı ve PVT residual'leri gibi özellikler çıkarılır; bu özellikler üzerinden istatistiksel ya da ML tabanlı bir anomali tespit algoritması uygulanır; sonuçlar ROC eğrileri, kümülatif dağılım fonksiyonları (CDF) ve tespit süresi üzerinden değerlendirilir; son olarak çoklu sensör ve çoklu konstelasyon kullanımının tespit performansına etkisi karşılaştırmalı olarak incelenir.

---

## Spoofing'in Potansiyel Etkileri

Başarılı bir spoofing saldırısının etkisi, hedef sistemin GNSS'e ne kadar bağımlı olduğuyla doğru orantılı olarak büyüyor:

- **Navigasyon hataları** — yanlış konum ve rota hesaplamaları, özellikle otonom sistemlerde fiziksel güvenlik riskine dönüşebilir
- **Zaman senkronizasyonu bozulmaları** — GNSS zaman referansına bağımlı sistemlerde (telekom baz istasyonları, finans işlem zaman damgaları, enerji şebekesi senkronizasyonu) domino etkisi yaratabilecek hatalar
- **Otonom araç/drone yönlendirme sapmaları** — sahte konum bilgisiyle aracın istenmeyen bir bölgeye yönlendirilmesi veya güvenlik protokollerinin (geofence gibi) hatalı tetiklenmesi
- **Kritik altyapı güvenilirlik riski** — konum/zaman bilgisine dayanan otomasyon sistemlerinde hatalı kararlar

---

## Tespit ve Savunma Yöntemleri

Tek bir önlem GNSS spoofing'e karşı yeterli koruma sağlamıyor; etkili savunma genelde birden fazla katmanın birleşimine dayanıyor.

**Kriptografik doğrulama.** Galileo'nun sunduğu **OSNMA (Open Service Navigation Message Authentication)**, sivil sinyallere kriptografik mesaj doğrulaması ekleyen önemli bir gelişme. Navigasyon mesajına dijital imza benzeri bir doğrulama katmanı ekleyerek alıcının sinyalin gerçekten Galileo'dan geldiğini doğrulamasını sağlıyor — bu, geleneksel "güç temelli güven" modelinin ötesine geçen, sivil GNSS güvenliğindeki en somut adımlardan biri.

**RAIM ve alıcı iç tutarlılık kontrolü.** Alıcının, aldığı ölçümler arasındaki tutarsızlıkları kendi içinde tespit edebilmesi — özellikle fazla sayıda uydu görünür olduğunda "hangi ölçüm diğerleriyle uyuşmuyor" sorusuna cevap arayan bir bütünlük kontrolü.

**Çoklu konstelasyon ve çoklu frekans karşılaştırması.** GPS, Galileo, GLONASS ve BeiDou'dan aynı anda çözüm üretip bunları karşılaştırmak; saldırganın tüm konstelasyonları aynı anda ve tutarlı biçimde taklit etmesini gerektirdiği için saldırı maliyetini ciddi ölçüde artırıyor.

**Sinyal temelli tespit.** SNR/C/N0 anormallikleri, beklenmeyen Doppler kaymaları ve PRN kod tutarsızlıkları izlenerek sinyalin fiziksel olarak "gerçekçi" olup olmadığı değerlendiriliyor.

**DOA (Direction of Arrival) ve çoklu anten kullanımı.** Gerçek GNSS sinyalleri farklı uydulardan farklı yönlerden gelir; tek bir spoofing kaynağından gelen sahte sinyaller ise genelde aynı yönden geliyor gibi görünür. Çoklu anten dizileriyle sinyallerin geliş açısı ölçülerek bu tutarsızlık tespit edilebilir.

**Sensör füzyonu.** IMU, odometri ve görüntü tabanlı (vision) navigasyon verisiyle GNSS çözümü çapraz kontrol edilerek, ani ve fiziksel olarak tutarsız bir GNSS sıçraması diğer sensörlerle uyuşmadığında işaretlenebilir.

**ML tabanlı anomali tespiti.** Yukarıdaki sinyal ve sensör özelliklerinin tamamı, klasik istatistiksel yöntemlerin yakalayamayacağı daha karmaşık spoofing paternlerini öğrenebilen makine öğrenmesi modellerine (Random Forest, LSTM gibi) girdi olarak verilebiliyor.

---

## Sonuç

GNSS spoofing, "sinyali gücü yeterince yüksek olduğu sürece gerçek kabul et" varsayımına dayanan yapısal bir zafiyetten besleniyor. Bu, sivil GNSS'in tasarım felsefesinin doğal bir sonucu — açıklık ve erişilebilirlik önceliklendirilirken kriptografik doğrulama uzun süre göz ardı edildi. OSNMA gibi girişimler bu açığı kapatmaya başlasa da, bugün hâlâ çoğu sivil sistem güç temelli güven modeline dayanıyor.

Bu yüzden gerçek dayanıklılık tek bir çözümden değil, katmanlı bir yaklaşımdan geliyor: kriptografik doğrulama mümkünse kullanılmalı, alıcı tarafında RAIM ve sinyal tutarlılık kontrolleri aktif tutulmalı, mümkünse çoklu konstelasyon/frekans kullanılmalı ve kritik sistemlerde GNSS tek başına değil, sensör füzyonunun bir parçası olarak değerlendirilmeli. Spoofing araştırması da bu yüzden yalnızca "saldırı nasıl yapılır" sorusuna değil, "bu katmanlardan hangisi eksik ve neden" sorusuna cevap aramalı — ve bunun yolu, canlı RF yayınından değil, kayıtlı veri setleri ve izole laboratuvar ortamlarından geçiyor.

---

## Kaynakça ve Ek Okuma

- Humphreys, T. E. vd. — *University of Texas Spoofing Test Battery (TEXBAT).*
- Finnish Geospatial Research Institute (FGI) — GNSS spoofing/jamming veri setleri.
- European GNSS Agency (EUSPA) — *Galileo Open Service Navigation Message Authentication (OSNMA) User Guide.*
- RTCA / ICAO — RAIM ve alıcı bütünlük izleme standartları üzerine teknik dokümantasyon.
- Psiaki, M. L. & Humphreys, T. E. (2016). *GNSS Spoofing and Detection.* Proceedings of the IEEE.
- Tippenhauer, N. O. vd. (2011). *On the Requirements for Successful GPS Spoofing Attacks.* ACM CCS.
