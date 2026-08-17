<img width="637" height="421" alt="image" src="https://github.com/user-attachments/assets/12d7ef4f-05d5-43e5-a62e-80145bba83d7" />

## Giriş

Bir drone'u havada tutan sadece motorlar ve pervaneler değil. Onu operatöre bağlayan görünmez RF bağlantısı, modern İHA ekosisteminin en kritik bileşenlerinden biri.

Son on yılda insansız hava araçları askeri kullanımın çok ötesine geçti — sivil havacılık, endüstriyel denetim, enerji, lojistik, tarım, afet yönetimi, kamu güvenliği... Ucuzlayan elektronik, gelişen batarya teknolojisi ve güçlenen uçuş kontrol sistemleri sayesinde birkaç yüz gramlık ticari bir drone bile bugün eskiden yalnızca profesyonel platformlarda bulunan yeteneklere sahip olabiliyor.

Bu dönüşüm beraberinde yeni güvenlik gereksinimleri getirdi. Bir drone artık sadece havada uçan bir cihaz değil; sensörler, gömülü sistemler, kablosuz haberleşme protokolleri, GNSS navigasyonu ve bulut servislerinden oluşan dağıtık bir bilgi işlem platformu. Güvenlik değerlendirmesi de bu yüzden sadece hava aracının fiziksel bütünlüğüyle sınırlı kalmıyor — haberleşme altyapısı, yer kontrol istasyonu, mobil uygulamalar ve kimlik doğrulama mekanizmaları da bu ekosistemin parçası.

Bir güvenlik araştırmacısı açısından bakıldığında en kritik unsur, drone ile operatör arasında kesintisiz sürdürülen **komuta-kontrol (Command & Control – C2)** haberleşmesi. Uçuş komutları, telemetri, kamera görüntüsü, sensör verisi ve görev parametreleri hep bu kanal üzerinden akıyor. C2 bağlantısının güvenilirliği yalnızca görevin başarısını değil, platformun emniyetini, veri bütünlüğünü ve operasyonel sürekliliği doğrudan etkiliyor.

Modern sistemler tek bir kanal kullanmıyor: uçuş komutları bir RF bağlantısından giderken video akışı farklı bir kanaldan taşınabiliyor, aynı anda GNSS'ten konum alınıyor, LTE/5G üzerinden buluta veri gidiyor. Bu çok katmanlı yapı operasyonel kabiliyeti artırırken saldırı yüzeyini de genişletiyor — bu yüzden drone güvenliği artık sadece "uçuş güvenliği" değil, fiziksel güvenlik, ağ güvenliği ve elektronik harp disiplinlerinin kesiştiği bir alan.
---

## Neden C2 Haberleşmesi Bu Kadar Kritik?

Bir drone'un uçabilmesi için motorların dönmesi yetmiyor. Operatörden gelen komutların doğru iletilmesi, sensör verilerinin geri gelmesi ve uçuş kontrol bilgisayarının bunları gerçek zamanlı işlemesi gerekiyor.

C2 bağlantısı kesildiğinde platformun davranışı tamamen uçuş yazılımındaki güvenlik politikalarına bağlı — bazı sistemler otomatik kalkış noktasına döner (Return-to-Home), bazıları olduğu yerde bekler, bazıları güvenli iniş başlatır. Bu kararlar hem operasyonel hem emniyet gereksinimlerine göre tasarlanıyor.

C2'nin güvenilirliği özellikle şu senaryolarda kritik hale geliyor: kritik altyapı denetimi (elektrik hatları, petrol/gaz tesisleri), arama-kurtarma, afet yönetimi, yangın gözlemi, kamu güvenliği görevleri, endüstriyel haritalama. Bu operasyonlarda haberleşme kesintisi sadece görevi değil, çevresel güvenliği ve can güvenliğini de etkileyebiliyor. Yani drone haberleşmesi salt bir kablosuz iletişim problemi değil; yüksek erişilebilirlik, veri bütünlüğü, kimlik doğrulama ve operasyonel süreklilik gerektiren bütünleşik bir güvenlik meselesi.

---

## Drone Haberleşme Mimarisine Genel Bakış

Modern bir drone sisteminde tek bir haberleşme kanalı yok — operatör komutları, telemetri, kamera görüntüsü, GNSS verisi ve görev parametreleri farklı veri akışları olarak eşzamanlı çalışıyor. Bu hem operasyonel esneklik sağlıyor hem de bileşenleri birbirinden bağımsız hale getiriyor.

```
Operator ── GCS ── RF Link (C2) ── Flight Controller
                                          │
                            ┌─────────────┼─────────────┐
                            ▼             ▼             ▼
                          GNSS          IMU        ESC/Motor
                            │
                     Telemetry Module ── Downlink ── GCS
                            │
                    Camera/Payload ── Video Downlink
```

Uçuş kontrol bilgisayarı sensör verilerini işleyip dengeyi korurken haberleşme modülü operatörle veri alışverişini sağlıyor; kamera sistemi görüntüyü genelde ayrı bir kanaldan iletiyor. Yani drone güvenliği değerlendirilirken sadece uçuş kontrol yazılımına değil, haberleşme altyapısının tamamına bakmak gerekiyor.

### Komuta-Kontrol Kanalının Rolü

C2, drone ile yer kontrol istasyonu (GCS) arasındaki çift yönlü veri alışverişini sağlayan temel katman. Operatör bunun üzerinden drone'u yönlendiriyor, görev parametrelerini değiştiriyor, aracın durumunu gerçek zamanlı izliyor. Taşınan veriler sadece uçuş komutlarından ibaret değil — batarya durumu, motor bilgisi, GPS koordinatı, irtifa, hız, uçuş modu, sensör sağlığı, görev durumu, kamera kontrol komutları hep aynı kanaldan geçiyor.

Bazı görevlerde C2'nin gecikme süresi (latency) doğrudan görev başarısını etkiliyor; özellikle hassas manevra gerektiren operasyonlarda milisaniyelik gecikmeler bile kontrol performansını değiştirebiliyor. Bu yüzden profesyonel platformlarda haberleşme altyapısı düşük gecikme, yüksek güvenilirlik ve hata toleransı hedefiyle tasarlanıyor.

### Uplink ve Downlink

**Uplink**, GCS'den drone'a giden veri — uçuş komutları, görev planları, rota güncellemeleri, kamera kontrolü, acil durum talimatları. Burada güvenilirlik kritik: kaybolan/bozulan bir komut paketi platformun beklenmedik davranış sergilemesine yol açabileceği için iletim genelde hata kontrol mekanizmalarıyla destekleniyor.

**Downlink**, drone'dan operatöre giden veri — telemetri, GPS konumu, irtifa, hız, IMU verisi, batarya durumu, motor sıcaklığı, kamera görüntüsü, sensör çıktıları. Video aktarımı telemetriye göre çok daha fazla bant genişliği istediği için birçok platform aynı fiziksel bağlantı üzerinde bile mantıksal olarak ayrı kanallar kullanıyor — böylece görüntü akışı kritik uçuş komutlarının iletimini bloke etmiyor.

### Telemetri

Telemetri, hava aracının çalışma durumunu operatöre ileten ölçüm verilerinin tamamı. Tipik bir telemetri paketinde enlem/boylam, irtifa, yer/hava hızı, yaw/roll/pitch, batarya voltajı ve akımı, kalan uçuş süresi, GPS uydu sayısı, GNSS doğruluğu, uçuş modu, IMU/manyetometre/barometre sağlığı gibi bilgiler yer alıyor.

Bu veriler sadece operatörün durumsal farkındalığı için değil, uçuş kontrol yazılımının karar mekanizmalarının izlenebilmesi için de önemli. Kurumsal platformlarda telemetri kayıtları görev sonunda genelde merkezi sistemlerde saklanıyor — uçuş sonrası analiz, bakım planlaması ve olay incelemesi bu kayıtlara dayanıyor.

---

## RF Katmanı: Elektromanyetik Haberleşmenin Temelleri

Kumandadaki bir joystick hareketi milisaniyeler içinde radyo dalgasına dönüşüp hava aracına ulaşıyor; aynı anda telemetri ve kamera görüntüsü ters yönde geri geliyor. Bu sürecin güvenilirliği sadece yazılım/protokol seçimine değil; frekans seçimine, anten tasarımına, çevresel koşullara, sinyal-gürültü oranına (SNR) ve elektromanyetik girişime (EMI) de bağlı. Yani drone haberleşmesini değerlendirirken sadece ağ protokollerine bakmak yetmiyor, fiziksel ortamın özellikleri de analiz edilmeli.

Süreç kabaca şöyle işliyor: operatör komutu → RF vericisi tarafından belirli bir taşıyıcı frekansa modüle edilir → anten üzerinden elektromanyetik dalga olarak yayılır → drone anteni algılar → haberleşme modülü sinyali tekrar sayısala çevirir → flight controller'a ulaşır. Aynı süreç ters yönde de işliyor. Kullanılan teknolojiye bağlı olarak bu döngü saniyede yüzlerce/binlerce kez, birkaç milisaniyelik gecikmeyle tekrarlanabiliyor.

### Frekans Bantları

Her frekans bandının kendine özgü avantaj ve sınırlamaları var: düşük frekans daha uzun menzil sağlarken yüksek frekans daha fazla bant genişliği veriyor, ama çevresel engellerden de daha çok etkileniyor. Kullanılacak teknoloji görev profiline, çevresel koşullara, veri miktarına ve gecikme gereksinimine göre seçiliyor.

| Bant | Tipik Kullanım | Avantaj | Sınırlama |
|------|-----------------|---------|-----------|
| 433 MHz | Açık kaynak telemetri | Uzun menzil, düşük güç tüketimi | Düşük veri hızı, video için yetersiz |
| 868/915 MHz | LoRa tabanlı telemetri | Uzun menzil, kararlı sinyal | Bant genişliği sınırlı |
| 2.4 GHz (ISM) | Çoğu ticari drone / C2 | Yaygın donanım desteği, yeterli bant genişliği | Wi-Fi/Bluetooth/IoT ile aynı bant, yoğun şehirde parazit riski |
| 5.8 GHz | HD video aktarımı | Yüksek bant genişliği, düşük gecikme | Kısa menzil, engellerden daha çok etkilenir |
| LTE/5G | BVLOS operasyonlar | Hücresel kapsama | Operatör altyapısına bağımlılık |

Buradaki önemli nokta: **aynı frekans aynı güvenlik seviyesi anlamına gelmiyor.** İki farklı üretici aynı 2.4 GHz bandını kullanabilir ama bu, aynı güvenlik seviyesine sahip oldukları anlamına gelmez. Gerçek güvenlik; haberleşme protokolü, kimlik doğrulama mekanizması, oturum yönetimi, paket bütünlüğü, anahtar yönetimi ve kriptografinin toplamından çıkıyor. LoRa ayrıca kilometrelerce menzil sunabiliyor ama bant genişliği düşük olduğu için sadece telemetri/sensör verisi taşımaya uygun, video aktarımı için değil.

Anten tasarımı da göz ardı edilmemesi gereken bir katman — kapsama alanını, sinyal kalitesini, yönlülüğü ve bağlantı kararlılığını doğrudan etkiliyor. Profesyonel platformlarda MIMO ve diversity anten yapıları haberleşmenin sürekliliğini artırmak için sıkça kullanılıyor.

---

## Haberleşme Protokolleri

Fiziksel katman kadar önemli olan diğer konu, veri paketlerinin nasıl yapılandırıldığını belirleyen protokol katmanı. Bu katman kimlik doğrulama, hata kontrolü, paket bütünlüğü ve görev yönetimini tanımlıyor. En yaygın kullanılan protokoller MAVLink, üreticiye özgü (proprietary) sistemler ve FPV'ye özel düşük gecikmeli protokoller.

### MAVLink

Açık kaynak İHA ekosisteminin fiili standardı **MAVLink (Micro Air Vehicle Link)**. ArduPilot ve PX4 tabanlı platformların büyük kısmı bu protokolü kullanıyor. Oldukça hafif bir mesajlaşma protokolü olduğu için gömülü sistemlerde düşük işlemci yükü oluşturuyor ve telemetri, uçuş komutları, sensör verisi, görev planları gibi çok farklı veri tiplerini standart mesaj yapılarıyla taşıyabiliyor (HEARTBEAT, ATTITUDE, GPS_RAW_INT, BATTERY_STATUS, COMMAND_LONG gibi).

Bir MAVLink paketi kabaca şu alanlardan oluşuyor: header/start byte, payload length, sequence number, system ID, component ID, message ID, payload, CRC. Bu standart yapı sayesinde farklı üreticilerin yazılımları aynı platformla konuşabiliyor — açık kaynak ekosisteminin büyümesindeki en önemli faktörlerden biri de bu.

**MAVLink 1 vs MAVLink 2:** İlk sürüm performans odaklı tasarlandığı için güvenlik tarafında önemli eksiklikleri var — mesaj imzalama yok, paketler varsayılan olarak şifrelenmiyor, kimlik doğrulama mekanizması bulunmuyor. MAVLink 2 bunu; **Packet Signing** (mesaj doğrulama), genişletilmiş mesaj formatı ve daha fazla mesaj tipiyle çözmeye çalışıyor. Ama şunu net söylemek lazım: paket imzalama ile uçtan uca şifreleme aynı şey değil. İmzalama mesajın değişmediğini ve doğru kaynaktan geldiğini kanıtlıyor; şifreleme ise içeriğin üçüncü taraflarca okunmasını engelliyor. Modern sistemlerde ikisinin birlikte kullanılması öneriliyor — sadece MAVLink 2 kullanmak, "packet signing açık mı" sorusunu sormadan güvenli olduğu anlamına gelmiyor.

### PX4 ve ArduPilot

Bunlar protokol değil, açık kaynak uçuş kontrol platformları — ikisi de MAVLink'i haberleşme standardı olarak kullanıyor. PX4 daha çok akademik/araştırma tarafında yaygın; ArduPilot ise multikopterden VTOL'e, kara ve deniz araçlarına kadar geniş bir platform yelpazesini destekliyor. İkisi de açık kaynak olduğu için dünya genelinde yoğun şekilde inceleniyor — bu da güvenlik açıklarının görece hızlı tespit edilmesini sağlıyor.

### DJI OcuSync ve Kapalı Protokoller

DJI, Autel, Skydio gibi üreticiler kendi kapalı (proprietary) haberleşme mimarilerini geliştiriyor. DJI'nin OcuSync teknolojisi tek başına bir RF protokolü değil — video, telemetri, komuta-kontrol ve frekans yönetimini tek mimaride birleştiriyor; otomatik kanal seçimi, adaptif veri oranı ve düşük gecikmeli video gibi özellikler sunuyor. Protokol ayrıntıları kamuya açık olmadığı için güvenlik değerlendirmeleri büyük ölçüde üretici dokümantasyonuna ve akademik tersine mühendislik çalışmalarına dayanıyor.

FPV camiasında ise CRSF (Crossfire) gibi kapalı, ELRS (ExpressLRS) gibi açık kaynak, çok düşük gecikmeli protokoller de var — bunlar özellikle yarış/serbest uçuş dronlarında tercih ediliyor.

| | Açık Protokoller | Kapalı Protokoller |
|---|---|---|
| İncelenebilirlik | Yüksek | Sınırlı |
| Bağımsız güvenlik denetimi | Yapılabilir | Üreticiye bağımlı |
| Topluluk desteği | Yüksek | Üreticiye bağlı |

Şunu belirtmek gerekiyor: protokolün kapalı olması tek başına ne iyi ne kötü bir şey — "security through obscurity" tek başına güvenlik garantisi vermiyor. Modern güvenlik yaklaşımı algoritmanın gizliliğine değil, kriptografik tasarımın sağlamlığına dayanıyor.

---

## Komuta-Kontrol Kanalının Güvenliği

C2 kanalının güvenliği dört temel ilke üzerinden değerlendiriliyor: **kimlik doğrulama (authentication), bütünlük (integrity), gizlilik (confidentiality), erişilebilirlik (availability)**. Bunlardan herhangi birinin eksik olması, sadece haberleşme kalitesini değil operasyonun güvenilirliğini de etkileyebiliyor. Örneğin güçlü bir şifreleme algoritması kullanmak tek başına yetmiyor — karşı tarafın kimliği doğrulanmıyorsa sistem yanlış kaynaktan gelen komutları kabul edebilir.

**Kimlik doğrulama.** Modern sistemlerde cihaz kimlikleri, dijital sertifikalar, kriptografik anahtarlar ve paket imzalama ile sağlanıyor. Giderek yaygınlaşan yaklaşım **karşılıklı doğrulama (mutual authentication)**: sadece operatör doğrulanmıyor, drone da karşı taraftaki GCS'in gerçekten yetkili olduğunu doğruluyor — bu, sahte yer kontrol istasyonlarının devreye girmesini zorlaştırıyor.

**Bütünlük.** İletilen paketin değişmeden ulaştığını doğrulamak için MAC (Message Authentication Code), hash algoritmaları, dijital imza ve paket imzalama kullanılıyor. CRC de yaygın ama önemli bir ayrım var: CRC sadece iletim hatalarını yakalar, kriptografik bir garanti sunmaz — kasıtlı bir saldırıya karşı koruma sağlamıyor. Güvenlik açısından kritik sistemlerde bu yüzden HMAC ya da dijital imza tercih ediliyor.

**Gizlilik.** Komut, telemetri ve görev bilgilerinin üçüncü kişilerce okunamaması için simetrik şifreleme kullanılıyor — en yaygın olanlar AES-128, AES-256 ve ChaCha20. Ama güçlü algoritma tek başına yeterli değil; anahtar yönetiminin güvenli yapılması, oturum anahtarlarının düzenli yenilenmesi de aynı derecede önemli.

**Erişilebilirlik.** C2 bağlantısı güvenli olsa bile görev sırasında kesilmesi ciddi operasyonel risk oluşturuyor. Bu yüzden otomatik kanal değiştirme, yedek haberleşme kanalları, adaptif veri oranı ve hata düzeltme mekanizmaları kullanılıyor — amaç, zorlu elektromanyetik ortamlarda bile haberleşmenin mümkün olduğunca sürmesi.

### Kriptografi Katmanı

Komuta-kontrol sistemlerinde genelde hibrit bir yaklaşım kullanılıyor — tıpkı TLS/SSH'de olduğu gibi. **Simetrik şifreleme** (AES gibi) aynı anahtarı hem şifreleme hem çözme için kullanıyor; düşük işlem maliyeti ve düşük gecikme sayesinde gerçek zamanlı veri akışında tercih ediliyor. **Asimetrik şifreleme** (public/private key) ise daha çok kimlik doğrulama, anahtar değişimi ve dijital imza için kullanılıyor — sürekli veri akışını şifrelemek için değil, çünkü işlem maliyeti yüksek. Genel akış: güvenli oturum asimetrik yöntemle kurulur, ardından veri iletimi simetrik anahtarla devam eder.

**Oturum anahtarları (session keys)** de önemli bir detay: aynı anahtarın uzun süre kullanılması riskli olduğu için her oturumda yeni bir simetrik anahtar üretiliyor — kimlik doğrulanır, güvenli anahtar değişimi yapılır, oturuma özel anahtar oluşturulur, haberleşme bu geçici anahtarla sürer, oturum bitince anahtar geçersizleşir.

**Replay attack koruması** da göz ardı edilmemesi gereken bir konu — saldırgan yeni komut üretmez, daha önce yakalanmış geçerli bir paketi tekrar gönderip sistemin aynı işlemi yeniden yapmasını sağlamaya çalışır. Nonce değerleri, sequence number, timestamp doğrulaması ve session identifier bu riski azaltıyor.

---

## Haberleşmede Hata Yönetimi ve Dayanıklılık

Kablosuz iletişim doğası gereği kararsız — atmosferik koşullar, EMI, çok yollu yayılım (multipath) ve fiziksel engeller paket kaybına yol açabiliyor. **CRC** her paket için matematiksel bir kontrol değeri üretip alıcı tarafta tekrar hesaplanarak doğrulanıyor (sadece hata tespiti, güvenlik garantisi değil). **FEC (Forward Error Correction)** veriye fazladan düzeltme biti ekleyerek bazı paketler kaybolsa bile alıcının eksik veriyi yeniden oluşturmasını sağlıyor — özellikle video ve uzun menzil haberleşmede kullanılıyor. **ARQ (Automatic Repeat Request)** ise eksik paket tespit edildiğinde yeniden gönderim talep ediyor; doğruluğu artırsa da gecikmeyi yükseltebildiği için gerçek zamanlı uçuş kontrolünde dikkatli kullanılıyor.

Dayanıklılık tarafında birkaç teknik öne çıkıyor:

- **FHSS (Frequency Hopping Spread Spectrum):** Haberleşme tek bir kanalda sabit kalmıyor, önceden belirlenmiş bir dizi boyunca çok kısa aralıklarla kanal değiştiriliyor. Bu, parazitten etkilenmeyi azaltıyor ve yoğun bantlarda kararlılığı artırıyor.
- **Adaptive Frequency Selection:** Sistem RSSI, SNR, packet error rate gibi metrikleri sürekli ölçüp en temiz kanalı otomatik seçiyor.
- **Diversity antenna / MIMO:** Birden fazla anten kullanarak gölgelenme ve multipath kaynaklı sinyal kaybını azaltıyor; MIMO ayrıca aynı anda birden fazla veri akışını farklı antenlerden ileterek veri hızını ve menzili artırabiliyor.

Bu mekanizmaların ortak amacı: bağlantı kalitesi düştüğünde tamamen kopmak yerine, veri oranını düşürerek veya kanal değiştirerek görevin devam edebilmesini sağlamak. Profesyonel operasyonlarda görevin tamamlanması genelde maksimum bant genişliğinden daha önceliklidir.

### Fail-Safe Davranışları

Hiçbir kablosuz sistem kesintisiz çalışmayı garanti edemiyor, bu yüzden profesyonel platformlarda haberleşme kaybı senaryosu önceden tanımlanıyor. En yaygın davranışlar: **Return to Home (RTH)** — bağlantı belirli süre kesilirse önceden kaydedilmiş güvenli noktaya otomatik dönüş; **Hover** — bulunduğu konumda bekleme (özellikle şehir ortamında ani hareketleri önlemek için); **Controlled/Automatic Landing** — GPS doğruluğu düşükse ya da batarya kritikse kontrollü iniş; **Geofence enforcement** — tanımlı bölge dışına çıkıldığında uyarı, hız sınırlama veya otomatik geri dönüş. Hangi davranışın uygulanacağı görev senaryosuna göre önceden planlanıp test ediliyor — bir haritalama görevinde göreve devam tercih edilebilirken, kritik altyapı yakınında kontrollü iniş daha güvenli olabilir.

Kritik sistemlerde ayrıca **redundancy (yedeklilik)** yaklaşımı kullanılıyor — çift IMU, çift GPS, çift pusula, çift haberleşme kanalı gibi. Bir bileşen arızalandığında sistem otomatik olarak yedeğe geçebiliyor.

---

## Flight Controller ve Ground Control Station

**Flight Controller**, komuta-kontrol zincirinin merkezi — gelen komutları ileten pasif bir bileşen değil. Sensör verilerini toplar, uçuş algoritmalarını çalıştırır, motor hızlarını hesaplar, dengeyi korur, fail-safe'i yönetir. Bunun için farklı sensörlerden (GPS, IMU, pusula, barometre) gelen veriyi birleştiren **sensor fusion** işlemi yapılır — en yaygın kullanılan algoritmalar arasında Extended Kalman Filter (EKF), Unscented Kalman Filter (UKF) ve Complementary Filter var. Yani güvenilir bir C2 sadece sağlam RF bağlantısına değil, doğru çalışan sensör füzyonuna da bağlı.

**Ground Control Station (GCS)** ise operatör açısından sadece harita gösteren bir yazılım gibi görünse de aslında uçuşun yönetildiği merkez — görev planlama, waypoint oluşturma, canlı telemetri, video görüntüleme, firmware güncelleme, parametre yönetimi, log analizi gibi işlevleri barındırıyor. Açık kaynak tarafta Mission Planner, QGroundControl, MAVProxy gibi araçlar; ticari tarafta üreticiye özgü kapalı yazılımlar (DJI Pilot, DJI Fly gibi) kullanılıyor. GCS aynı zamanda güvenlik açısından önemli bir sorumluluk taşıyor — yetkisiz erişimin engellenmesi, kullanıcı doğrulaması ve görev planlarının bütünlüğü büyük ölçüde bu katmanda uygulanıyor.

---

## Tehdit Modellemesi ve Saldırı Yüzeyi

Bir C2 altyapısını güvenli hale getirmek için sadece kullanılan teknolojiyi bilmek yetmiyor; bu mimarinin hangi tehditlere maruz kalabileceğinin sistematik olarak değerlendirilmesi gerekiyor. Kurumsal güvenlik ve Red Team ekipleri bunun için STRIDE, MITRE ATT&CK, NIST RMF, ENISA Threat Landscape gibi metodolojilerden yararlanıyor.

Bir drone'un saldırı yüzeyi sadece RF haberleşmesinden ibaret değil:

```
Operator → GCS → Communication Network → Flight Controller
                                                │
                                    ┌───────────┼───────────┐
                                    ▼                        ▼
                                Firmware                 Navigation
                                    │                        │
                                Telemetry                 Sensors
                                    │
                              Cloud Services
```

GCS istemci güvenliği, RF haberleşme güvenliği, firmware bütünlüğü, sensör doğruluğu, GPS güvenilirliği, bulut servisi güvenliği ve mobil uygulama güvenliği ayrı ayrı değerlendirilmesi gereken alanlar.

**STRIDE** modeli drone C2'ye uygulandığında şöyle bir tablo çıkıyor:

| STRIDE Kategorisi | Drone C2 Karşılığı |
|---|---|
| Spoofing | Yetkisiz cihazın kendini meşru GCS gibi göstermesi |
| Tampering | Haberleşme paketlerinin değiştirilmesi |
| Repudiation | Yapılan işlemlerin inkâr edilebilmesi |
| Information Disclosure | Telemetrinin yetkisiz kişilerce görüntülenmesi |
| Denial of Service | Haberleşmenin kesintiye uğraması |
| Elevation of Privilege | Yetkisiz kullanıcının yönetici hakları kazanması |

MITRE ATT&CK çerçevesi ise ağırlıklı olarak kurumsal BT için geliştirilmiş olsa da; Initial Access, Credential Access, Discovery, Collection, Exfiltration, Command and Control, Defense Evasion gibi kategoriler C2 ekosisteminin hangi noktalarında hangi kontrollerin eksik olduğunu sistematik biçimde ortaya koymaya yardımcı oluyor.

Risk değerlendirmesinde tipik olarak şu alanlar sistematik biçimde inceleniyor: kimlik doğrulama (operatör/cihaz kimliği, sertifikalar), haberleşme (şifreleme, bütünlük, gecikme), flight controller (güvenli önyükleme, firmware doğrulama), telemetri (gizlilik, doğruluk), GCS (işletim sistemi, yetkilendirme), bulut altyapısı (API güvenliği, erişim kontrolü), log yönetimi (merkezi loglama, olay analizi).

Teknik kontroller kadar operasyonel süreçler de önemli: Firmware güncellemeleri nasıl yönetiliyor? Kim yeni görev planı oluşturabiliyor? Operatör hesapları nasıl korunuyor? Görev kayıtları ne kadar saklanıyor? Anahtar yönetimi merkezi mi? Bu soruların cevapları, teknik açıklardan bağımsız olarak kurumun güvenlik olgunluğunu ortaya koyuyor — güvenli bir sistem sadece güçlü algoritma kullanan değil, süreçleri doğru yöneten sistem.

---

## Kurumsal Savunma Yaklaşımları

Drone C2 güvenliği sadece güçlü haberleşme protokollerine dayanmıyor. Güvenilir bir mimari; kimlik yönetimi, anahtar yönetimi, ağ segmentasyonu, sürekli izleme ve güvenli yazılım geliştirme süreçlerinin birlikte uygulanmasını gerektiriyor — tek katmana bağımlı kalmadan çok katmanlı (defense in depth) bir yaklaşım.

**Kimlik yönetimi.** GCS'e erişen her kullanıcı aynı yetkiye sahip olmamalı. MFA, rol tabanlı yetkilendirme (RBAC), en az ayrıcalık ilkesi, ayrıcalıklı hesap yönetimi (PAM) ve merkezi IAM burada devreye giriyor. Örneğin bakım personelinin sadece durum görüntüleme yetkisi olmalı; görev planı değiştirme veya firmware güncelleme yetkisi yalnızca yetkili operatörlerde kalmalı.

**Anahtar yönetimi.** Anahtarların rastgele üretimi, HSM (donanımsal güvenlik modülü) kullanımı, düzenli rotasyon ve güvenli depolama kritik. Anahtarların düz metin saklanması veya tüm cihazlarda ortak anahtar kullanılması güvenlik seviyesini ciddi şekilde düşürüyor.

**Firmware güvenliği.** Secure Boot, firmware signing, güvenli OTA güncellemeleri, bütünlük doğrulaması ve rollback koruması ile sadece üretici tarafından imzalanmış/doğrulanmış yazılımların çalışması sağlanıyor.

**Ağ segmentasyonu.** GCS'in doğrudan kurumsal kullanıcı ağı üzerinde çalıştırılması önerilmiyor; bunun yerine ayrı bir operasyon VLAN'ı (Corporate Network → Firewall → Drone Operations VLAN → GCS → Mission Server) kullanılıyor, böylece bir güvenlik olayının diğer kurumsal sistemlere yayılma riski azalıyor.

**Log yönetimi ve SIEM.** GCS, flight controller, telemetri sunucuları, IAM, ağ cihazları ve bulut servislerinden gelen kayıtlar merkezi SIEM platformlarına aktarılıyor. Bu sayede örneğin "aynı operatör hesabının farklı lokasyondan oturum açması" ile "aynı zamanda yeni görev planı oluşturulması" gibi olaylar birlikte değerlendirilip anlamlı uyarılara dönüştürülebiliyor.

**Sürekli izleme.** RF bağlantı kalitesi, telemetri tutarlılığı, firmware durumu, operatör etkinlikleri, sistem sağlığı ve güvenlik logları sürekli izleniyor — amaç sadece gerçekleşmiş olayları değil, potansiyel riskleri erken fark edebilmek.

**Zero Trust.** "Never trust, always verify" prensibi drone ekosistemine uygulandığında: hiçbir cihaz varsayılan güvenilir kabul edilmiyor, her oturum yeniden doğrulanıyor, erişim kararları bağlamsal değerlendiriliyor. Farklı ülkeden yapılan operatör oturumları, alışılmadık saatte oluşturulan görev planları veya yeni bir cihazdan erişim gibi durumlar ek doğrulama tetikleyebiliyor. Bu yaklaşım özellikle kritik altyapı, kamu ve savunma sanayii operasyonlarında giderek daha fazla benimseniyor.

---

## Davranış Analitiği ve Yapay Zekâ Destekli Güvenlik

Büyük ölçekli İHA filolarında her uçuş milyonlarca veri noktası üretebiliyor — GPS, hız, irtifa, batarya, RF sinyal kalitesi, paket kayıp oranı, operatör komutları... Bu hacmi manuel taramak pratik değil, bu yüzden davranış analitiği ve makine öğrenmesi tabanlı yaklaşımlar giderek daha çok kullanılıyor.

Klasik güvenlik sistemleri eşik tabanlı kurallarla çalışıyor (batarya %15 altına düşünce uyar, GPS kaybolunca RTH başlat gibi). Ama gerçek operasyonlarda her risk önceden tanımlanamıyor; bu yüzden **anomali tespiti** platformun normal çalışma profilini (tipik uçuş süresi, hız, görev bölgesi, RF kalitesi, operatör davranışı) öğrenip bundan önemli sapmaları işaretliyor.

**UEBA (User and Entity Behavior Analytics)** sadece kimliği değil kullanıcının sistemi nasıl kullandığını değerlendiriyor: daha önce görülmemiş bir cihazdan giriş, mesai dışı görev oluşturma, kısa sürede çok sayıda görev planı değişikliği, aynı hesabın farklı coğrafi konumlardan kullanımı gibi sinyaller tek başına ihlal anlamına gelmese de birlikte değerlendirildiğinde dikkat gerektiren durumlar oluşturabiliyor.

Telemetri analitiği tarafında GPS sapmaları, irtifa profili, motor verisi, batarya eğrisi, RSSI ve sensör tutarlılığı gibi parametreler hem güvenlik hem kestirimci bakım (predictive maintenance) amacıyla inceleniyor.

Kurumsal yapılarda drone operasyonları artık bağımsız sistemler olarak görülmüyor — çoğu zaman doğrudan SOC ile entegre çalışıyor, uçuş kayıtları/kullanıcı oturumları/ağ trafiği/kimlik doğrulama olayları tek platformda analiz edilebiliyor. Bu, farklı güvenlik olaylarının ilişkilendirilmesini kolaylaştırıyor.

Savunma sanayii ve endüstriyel projelerde öne çıkan bir diğer kavram **dijital ikiz (digital twin)**: hava aracının gerçek zamanlı dijital modeli sürekli telemetri ve sensör verisiyle güncelleniyor, bu sayede performans analizi ve güvenlik testleri gerçek platform riske atılmadan yapılabiliyor.

Son olarak, birçok üretici artık **bulut tabanlı filo yönetim platformları** sunuyor — görev planlarının merkezi yönetimi, telemetri depolama, firmware dağıtımı, cihaz envanteri. Ölçeklenebilirlik avantajı büyük ama beraberinde API güvenliği, kimlik federasyonu, erişim kontrolü ve bulut yapılandırma güvenliği gibi yeni sorumluluklar getiriyor. Yani modern C2 güvenliği artık sadece RF katmanını değil, bulut servislerini de kapsayan bütüncül bir yaklaşım gerektiriyor.

---

## Sonuç

Drone komuta-kontrol haberleşmesi, ilk bakışta basit görünen ("joystick hareket ettir, drone dönsün") bir etkileşimin arkasında; RF fiziği, protokol tasarımı, kriptografi, sensör füzyonu, kimlik yönetimi ve bulut güvenliğinin iç içe geçtiği çok katmanlı bir mimari barındırıyor.

Bunun pratik sonucu şu: "AES kullanıyoruz" ya da "MAVLink 2'ye geçtik" gibi tek bir cümle, sistemin güvenli olduğu anlamına gelmiyor. Kimlik doğrulama var mı, karşılıklı mı, anahtar yönetimi nasıl yapılıyor, replay koruması mevcut mu, ağ segmentasyonu uygulanıyor mu, fail-safe senaryoları test edilmiş mi — asıl güvenlik seviyesini bu soruların toplu cevabı belirliyor.

Bir güvenlik araştırmacısı için drone C2 zinciri; RF haberleşmesi, gömülü sistem güvenliği, kriptografi, kimlik yönetimi ve ağ güvenliğinin kesiştiği bir güven zinciri. Zincirin herhangi bir halkasındaki zayıflık, hem operasyonel emniyeti hem kurumun genel güvenlik duruşunu aynı anda etkileyebiliyor. Teknoloji hızla gelişiyor — mobil kimlik, bulut tabanlı filo yönetimi, davranış analitiği, yapay zekâ destekli tespit — ama hiçbiri, doğru mimari tasarım, güvenli yapılandırma ve düzenli değerlendirme yapılmadan tek başına yeterli olmuyor.
