<img width="1154" height="664" alt="access-control-system-app-story" src="https://github.com/user-attachments/assets/e0a8c40d-4615-400a-9ab5-2c4b4e124be8" />

## Giriş

Kurumlar genelde güvenlik bütçesini ekrana, sunucuya, buluta yatırıyor; ama insanların her sabah elini bile sürmeden geçtiği o küçük kart okuyucu kutusuna neredeyse hiç bakmıyor. Oysa çok sağlam kurulmuş bir SOC/EDR/MFA altyapısının arkasında yıllardır değişmemiş, eski nesil bir kart okuyucu sistemi bulmak hiç de nadir değil.

Siber güvenlik dendiğinde akla ilk gelen şeyler genelde internetten gelen tehditler oluyor — güvenlik duvarı, EDR, MFA, AD, bulut güvenliği. Bu doğal, çünkü büyük ihlallerin çoğu gerçekten de bu kanallardan geliyor. Ama gerçek bir Red Team operasyonunda saldırı yüzeyi internetle bitmiyor. Fiziksel katmandaki bir zafiyet, en sağlam mantıksal kontrolleri bile dolaylı yoldan devre dışı bırakabilir. Bir saldırgan binaya bir şekilde girdiğinde; boşta bırakılmış bir network portu, korumasız bir yönetim cihazı ya da sadece "güvenlik farkındalığı" eksik bir süreç, ona istediğinden fazlasını verebilir.

Bu yüzden artık fiziksel güvenlik ile bilgi güvenliğini iki ayrı kutuda tutmak pek gerçekçi değil. Özellikle büyük kurumlarda fiziksel erişim sistemleri (PACS) kimlik yönetimiyle, SOC'la, log altyapısıyla iç içe çalışıyor.

Bir çalışan kartını okuttuğunda aslında sadece kapı açılmıyor. Arka planda kimlik doğrulanıyor, yetki kontrol ediliyor, olay kaydı oluşuyor, bu kayıt merkezi log sistemine düşüyor, bazı kurumlarda SIEM üzerinde korelasyon kurallarına giriyor ve fiziksel olaylar dijital olaylarla ilişkilendirilebiliyor. Yani o kapı artık binanın değil, kurumun genel güvenlik mimarisinin bir parçası.

Ve bu mimarinin merkezinde hâlâ, onlarca yıldır olduğu gibi, RFID var.

---

## RFID Neden Hâlâ Bu Kadar Yaygın?

Ofis kartlarından veri merkezi erişimine, üretim tesislerinden kampüslere kadar hemen her yerde RFID görüyoruz. Sebebi aslında basit: ucuz, temassız, hızlı, mevcut kimlik sistemleriyle kolayca entegre oluyor ve donanımı yıllarca dayanıyor.

Kullanıcı tarafında süreç üç adım: kartı okuyucuya yaklaştır, doğrulansın, kapı açılsın. Ama bu birkaç yüz milisaniyelik işlemin arkasında oldukça katmanlı bir mimari çalışıyor — ve bu makalenin asıl konusu da bu katmanlar.

RFID sadece erişim kontrolünden ibaret de değil aslında. Lojistik, tedarik zinciri, sağlık, perakende, toplu taşıma gibi pek çok alanda kullanılıyor. Ama kurumsal dünyada en yaygın kullanım amacı hâlâ personel ve ziyaretçi erişiminin merkezi ve güvenli şekilde yönetilmesi.

---

## Kart Okutulduğunda Ne Oluyor?

Basitçe şöyle bir zincir işliyor:

```
RFID Kart → RFID Okuyucu → Access Controller → Access Control Server
                                                        │
                                        ┌───────────────┼───────────────┐
                                        ▼               ▼               ▼
                                Active Directory      SIEM/SOC        LDAP/IAM
```

| Bileşen | Görevi |
|---------|--------|
| RFID Kart | Dijital kimliği taşır |
| RFID Okuyucu | Kimliği alır, ilk doğrulamayı başlatır |
| Controller | Yetkilendirme kararını verir |
| Access Server | Politika yönetimi ve merkezi kontrol |
| AD / IAM | Kullanıcı yaşam döngüsü |
| SIEM | Olayların korelasyonu |

Yani güvenlik değerlendirmesi tek bir bileşene odaklanarak yapılamaz. Zincirin her halkası ayrı ayrı incelenmeli.

---

## Bir Pentester Aynı Sisteme Nasıl Bakar?

Kullanıcı için okuyucu duvara vidalanmış sıradan bir kutu. Bir pentester içinse; RF haberleşmesi, gömülü sistem güvenliği, kimlik doğrulama protokolleri, ağ segmentasyonu, AD entegrasyonu ve loglama süreçlerinin kesiştiği bir başlangıç noktası.

Bir fiziksel güvenlik değerlendirmesinde asıl amaç "bu kart kırılabilir mi" sorusuna cevap aramak değil — çok daha geniş bir soru bu aslında: *zincirin herhangi bir noktasında kurumu riske atacak bir mimari ya da operasyonel eksiklik var mı?*

Bu yazıda da tam olarak bunu ele alacağız: RFID'nin fiziksel temelinden, kart teknolojilerine, haberleşme protokolüne, PACS mimarisine, kimlik yönetimi entegrasyonlarından bulut/mobil kimlik ve modern güvenlik yaklaşımlarına kadar uçtan uca bir bakış.

---

## RFID'nin Fiziksel Temelleri

RFID, nesnelerin radyo frekansı üzerinden kablosuz tanımlanmasını sağlıyor. Barkoddan farkı, görüş hattına ihtiyaç duymaması — kart cebinizde bile olsa okunabiliyor.

Her RFID sisteminde dört temel bileşen var: kart (credential), okuyucu, controller ve merkezi sunucu. Bunlar birlikte çalışarak erişim kararını üretiyor.

**Enerji nereden geliyor?** Pasif kartların içinde pil yok. Okuyucunun ürettiği elektromanyetik alan, kartın antenine enerji indüklüyor (Faraday'ın indüksiyon prensibi) ve kart bu enerjiyle "uyanıyor". Okuyucu anteni sürekli belirli bir frekansta elektromanyetik alan üretiyor; kart bu alana girdiğinde anten bobini üzerinde indüklenen enerji, kartın entegre devresini çalıştırıyor. Bu yüzden pasif kartlar bakım gerektirmeden yıllarca çalışabiliyor — dahili bir güç kaynağı olmamasına rağmen.

Üç tür etiket var:

| Tür | Güç Kaynağı | Mesafe | Tipik Kullanım |
|-----|-------------|--------|-----------------|
| Pasif | Okuyucudan alınır | Kısa | Personel kartları |
| Aktif | Dahili pil | Uzun | Araç takibi |
| Yarı pasif | Pil destekli | Orta | Endüstriyel |

Kurumsal erişim sistemlerinde neredeyse hep pasif kart görürsünüz — ucuz, dayanıklı, bakımsız.

---

## Frekans Bantları: LF, HF, UHF

RFID tek bir teknoloji değil, farklı frekanslarda çalışan ve birbirinden epey farklı güvenlik özelliklerine sahip birkaç ayrı standardın toplamı. Bir PACS değerlendirmesine başlarken ilk sorduğum şeylerden biri "hangi frekans" oluyor, çünkü mesafe, hız ve desteklenen güvenlik mekanizmaları buna bağlı.

**LF (125-134 kHz)** RFID'nin en eski nesli. Yıllarca bina girişlerinde, otoparklarda, personel takibinde ve endüstriyel tesislerde standart oldu. Avantajları var: metal yüzeylerden az etkileniyor, haberleşmesi kararlı, maliyeti düşük, donanım ömrü uzun. Ama güvenlik özellikleri günümüz beklentilerine göre oldukça sınırlı. Yeni kurulumlarda artık genelde HF'ye geçiliyor; LF'ye hâlâ eski/değişmemiş altyapılarda rastlanıyor.

**HF (13.56 MHz)** bugün kurumsal PACS'lerin büyük kısmının çalıştığı bant. Sadece bina girişlerinde değil; e-pasaportlarda, temassız banka kartlarında, üniversite kimliklerinde, toplu taşıma kartlarında, mobil ödeme sistemlerinde ve NFC tabanlı uygulamalarda da kullanılıyor. Yaygınlaşmasının sebebi daha gelişmiş haberleşme mekanizmaları, daha yüksek veri aktarım kapasitesi ve modern güvenlik standartlarını destekleyebilmesi. HF sistemlerin büyük kısmı ISO/IEC 14443 standardını temel alıyor.

**UHF (860-960 MHz)** metrelerce mesafeden okunabiliyor ama bu özellik erişim kontrolü için pek işe yaramıyor çünkü "kimin kapıdan geçtiğini" değil "civarda ne var"ı ölçmeye daha yakın. Bu yüzden UHF daha çok depo, kargo merkezi, üretim hattı, perakende stok yönetimi ve araç takip sistemlerinde kullanılıyor. Yüksek güvenlik gerektiren fiziksel erişim senaryolarında genelde HF tercih ediliyor.

|  | LF | HF | UHF |
|---|----|----|----|
| Frekans | 125-134 kHz | 13.56 MHz | 860-960 MHz |
| Mesafe | Kısa | Kısa-Orta | Uzun |
| Hız | Düşük | Orta | Yüksek |
| NFC desteği | Yok | Var | Yok |
| Tipik kullanım | Eski sistemler | Kurumsal PACS | Lojistik |

### ISO/IEC 14443 Standardı

HF tarafındaki bu standart, sadece fiziksel haberleşmeyi değil kart-okuyucu arasındaki veri alışverişinin temel kurallarını da tanımlıyor. Dört bölümden oluşuyor:

| Bölüm | Açıklama |
|-------|----------|
| Part 1 | Fiziksel özellikler |
| Part 2 | RF arayüzü |
| Part 3 | Başlatma ve kart seçimi (anti-collision) |
| Part 4 | İletişim protokolü |

Bu ortak çerçeve sayesinde farklı üreticilerin kartları aynı okuyucuyla konuşabiliyor.

### NFC, RFID'nin Neresinde?

Sık karışan bir nokta: NFC ile RFID aynı şey değil. NFC, HF RFID'nin belirli özelliklerini temel alan daha üst seviye bir haberleşme standardı. Her NFC cihazı belli RFID standartlarını destekler ama her RFID sistemi NFC değildir. Telefonlardaki NFC donanımı sayesinde kullanıcılar dijital kimlik kullanabiliyor, mobil erişim sağlayabiliyor, temassız ödeme yapabiliyor — bu yüzden mobil kimlik çözümleri de giderek yaygınlaşıyor (aşağıda ayrıca değineceğim).

---

## Kart Ailesi Bir Şey İfade Ediyor mu?

"MIFARE kullanıyoruz, güvenliyiz" diye düşünmek yaygın bir yanılgı; çünkü "MIFARE" tek başına hiçbir şey söylemiyor. Bu ailenin içinde güvenlik seviyesi baştan aşağı farklı ürünler var:

**MIFARE Classic** — uzun yıllar boyunca erişim kontrolünün fiili standardı oldu, düşük maliyeti ve geniş donanım desteği sayesinde dünya genelinde milyonlarca kurum tarafından kullanıldı. Belleği sektör ve bloklara ayrılmış, her sektör ayrı erişim kurallarıyla yapılandırılabiliyor. Kriptografik zayıflıkları akademik camiada (Garcia vd., Nohl vd.) uzun süredir biliniyor. Hâlâ eski altyapılarda karşınıza çıkabilir.

**MIFARE Plus** — mevcut altyapıyla uyumluluğu korurken daha gelişmiş güvenlik sunmak için tasarlanmış bir ara/geçiş çözümü.

**MIFARE DESFire EV3** — kurumsal erişimde en yaygın modern seçeneklerden biri. AES tabanlı güvenlik mekanizmaları, çoklu uygulama desteği, dosya tabanlı yapı ve gelişmiş kimlik doğrulama sunuyor. Veri merkezleri ve kritik altyapılarda sık tercih ediliyor.

**HID iCLASS** — özellikle Kuzey Amerika'da yaygın. Yıllar içinde birçok farklı versiyonu çıktı, bu yüzden "iCLASS kullanıyoruz" demek tek başına güvenlik seviyesi hakkında yeterli bilgi vermiyor.

**HID SEOS** — günümüzün en modern örneklerinden biri. Plastik kartla sınırlı değil; kimlik bilgileri telefonlarda, dijital cüzdanlarda, giyilebilir cihazlarda da güvenli şekilde kullanılabiliyor. Mobil kimlik çözümlerinin yaygınlaşmasıyla SEOS tabanlı sistemlerin kullanımı da artıyor.

Buradan çıkarılacak ders şu: güvenliği sadece kart modeline bakarak değerlendirmek yanıltıcı. Güvenlik seviyesi; kart teknolojisi, haberleşme protokolleri, kimlik yönetimi, merkezi politikalar, olay izleme ve düzenli değerlendirmelerin toplamı. Aynı kart ailesini kullanan iki kurum, mimari ve yapılandırma farkı yüzünden tamamen farklı risk seviyelerinde olabiliyor.

---

## Haberleşme Sürecinin İçine Bir Bakış

Kart okuyucuya değdiğinde şu sıra işliyor:

```
RF Alanı Oluşturulur → Kart Enerji Kazanır → Kart Algılanır
   → Anti-Collision (Kart Seçimi) → Kimlik Doğrulama
   → Veri Alışverişi → Erişim Kararı
```

Bunların hepsi birkaç yüz milisaniye içinde bitiyor ama her adımı biraz açmak lazım, çünkü çoğu güvenlik yanılgısı buradan doğuyor.

**Kartın algılanması ve anti-collision.** Okuyucunun kapsama alanında aynı anda birden fazla kart bulunabilir — cüzdanınızda personel kartı ile ulaşım kartı birlikte olabilir mesela. Birden fazla kart aynı anda cevap verirse sinyaller üst üste biner ve iletişim mümkün olmaz. ISO/IEC 14443 bu problemi çözmek için anti-collision algoritmasını tanımlıyor: okuyucu kartları tek tek ayırt edip yalnızca seçtiğiyle iletişime devam ediyor. Bu süreç tamamen otomatik ve kullanıcı tarafından hiç fark edilmiyor.

**UID tek başına kimlik doğrulama değildir.** Her kartın üretimde verilen benzersiz bir UID'si var (4, 7 ya da 10 byte uzunluğunda olabiliyor). Bu sadece kartın seri numarası. Sistem sadece UID'ye güveniyorsa, o UID'yi kopyalamak (bazı eski/ucuz kart tiplerinde bu hiç zor değil) kartın kendisini kopyalamakla neredeyse eşdeğer hâle geliyor. Modern sistemler bu yüzden kriptografik doğrulama katmanı ekliyor — gerçek güvenlik, kartın "gerçekten yetkili olduğunu kanıtlayabilmesine" dayanıyor.

**ATS (Answer To Select).** Kart seçildikten sonra okuyucu, kartın teknik özelliklerini öğrenmek için ATS adında bir bilgi paketi alıyor. İçinde desteklenen protokol sürümü, zamanlama bilgileri ve veri aktarım parametreleri gibi bilgiler yer alabiliyor — okuyucu bu sayede kartla nasıl konuşacağına karar veriyor.

**APDU yapısı.** ISO/IEC 14443 Part 4 sonrasında kart ile okuyucu arasında APDU (Application Protocol Data Unit) adı verilen paketler kullanılıyor — akıllı kart dünyasının standart haberleşme biçimi. İki tür var: **Command APDU** okuyucudan karta giden komutları taşıyor (uygulama seçme, veri okuma/yazma, kimlik doğrulama isteği gibi); **Response APDU** ise kartın buna verdiği cevap — veri, durum kodu veya hata bilgisi içerebiliyor.

**Mutual authentication (karşılıklı doğrulama).** Modern sistemlerde tek yönlü değil: okuyucu kartı doğruluyor, kart da okuyucunun gerçek/yetkili olduğunu doğruluyor. Bu, sahte okuyucularla ya da doğrulanmamış terminallerle iletişim kurulmasını zorlaştırıyor ve günümüz erişim kartlarının temel güvenlik özelliklerinden biri hâline geldi.

**Nonce ve session key.** Nonce, her oturumda üretilen ve bir daha kullanılmayan rastgele bir değer — replay saldırılarını (kaydedilmiş bir haberleşmenin tekrar oynatılması) engellemenin temel yöntemlerinden biri. Kimlik doğrulama başarılı olduktan sonra taraflar kalıcı anahtarları doğrudan kullanmaya devam etmiyor; bunun yerine sadece o oturuma özel bir session key üretiliyor. Böylece her oturum bağımsız korunuyor ve bir oturumun ele geçirilmesi diğerlerini etkilemiyor.

**Secure messaging ve AES.** Kimlik doğrulama tamamlandıktan sonra veri alışverişi başlıyor ve modern sistemlerde bu veri gizlilik, bütünlük ve kimlik doğrulama ilkeleri doğrultusunda korunuyor — yani sadece "okunmaması" değil "değiştirilmemesi" de amaçlanıyor. Yeni nesil kartların büyük kısmı bunu AES üzerinden yapıyor (kurumsal ortamlarda özellikle AES-128 desteği aranıyor); yaygın donanım desteği ve uluslararası standartlara uygunluğu bu tercihte etkili.

Ama şunu vurgulamak gerekiyor: kart-okuyucu haberleşmesi ne kadar güvenli olursa olsun, zincir orada bitmiyor. Kimlik doğrulaması tamamlandıktan sonra bilgi; controller'a, merkezi yönetim sunucusuna, kimlik yönetim sistemlerine ve olay kayıt altyapısına akıyor. Gerçek güvenlik seviyesi, bu zincirin tamamına bakılarak anlaşılabilir — sadece RF haberleşmesine değil.

---

## PACS Mimarisi: Kart Sadece Başlangıç

Bir kurumsal Physical Access Control System aslında donanım, yazılım, ağ ve kimlik yönetiminin birlikte çalıştığı dağıtık bir sistem. Katmanlar şöyle:

**Credential** — kart, key fob, telefon, akıllı saat, dijital cüzdan. Artık sadece sabit bir numara taşıyan pasif bir nesne değil; kullanıcının rolü, departmanı, erişim bölgesi ve zaman kısıtlamalarıyla ilişkilendirilen bir kimlik temsili. Kartın yaşam döngüsü, kullanıcı hesabının yaşam döngüsünden bağımsız düşünülmemeli.

**Okuyucu** — fiziksel erişim zincirinin ilk aktif bileşeni. Sadece RFID okumakla kalmıyor; çoğu kurumsal okuyucu aynı zamanda NFC, BLE, mobil kimlik, QR kod ve PIN doğrulama gibi birden fazla yöntemi destekliyor. Bazı gelişmiş modeller biyometrik doğrulama sistemleriyle de birlikte çalışabiliyor.

**Access Controller** — kapının açılıp açılmayacağına asıl karar veren bileşen. Okuyucudan gelen bilgiyi kullanıcının yetkisi, erişim saatleri, erişim bölgesi ve sistem politikalarıyla değerlendiriyor. Birçok kurumsal panel, ağ bağlantısı kesildiğinde bile yerel kurallarla çalışabilen bir mekanizmaya sahip — bu özellikle kritik tesislerde süreklilik için önemli.

**Access Control Server** — kullanıcı kayıtları, erişim politikaları, kart bilgileri, alarm kuralları, zaman çizelgeleri ve olay kayıtları burada tutuluyor. Büyük kurumlarda tek sunucu yerine yüksek erişilebilirlik sağlayan kümeli (cluster) mimari tercih ediliyor, böylece tek bir sunucudaki arıza erişim sürecini kesintiye uğratmıyor.

### Kurumsal Entegrasyonlar

**AD / Microsoft Entra ID entegrasyonu.** İşe giriş-çıkışlarda kart otomatik oluşturulup kaldırılabiliyor, departman değişiklikleri erişim haklarına otomatik yansıyabiliyor. Bu insan hatasını ciddi şekilde azaltıyor — çünkü işten ayrılan bir kullanıcının kartının haftalarca sistemde aktif kalması, sahada karşılaşılan tipik ve önlenebilir sorunlardan biri. Microsoft ekosistemi kullanan kurumlarda kullanıcı grupları (Sistem Yöneticileri, Ağ Ekibi, İK, Muhasebe, Veri Merkezi Personeli gibi) doğrudan fiziksel erişim politikalarına yansıtılabiliyor — bu da rol tabanlı erişim kontrolünü (RBAC) fiziksel güvenliğe taşıyor.

**LDAP / IAM.** AD kullanmayan kurumlarda benzer rolü LDAP tabanlı dizin servisleri veya farklı IAM çözümleri üstleniyor; kullanıcı hesapları, organizasyon yapısı, rol bilgileri ve yetkilendirme politikaları merkezi olarak yönetiliyor.

**VMS entegrasyonu.** Erişim olayı ile aynı zaman damgasına ait kamera görüntüsü otomatik olarak eşleştirilebiliyor. Bu, olay incelemelerini hızlandırıyor, adli analiz süreçlerini kolaylaştırıyor ve yanlış alarmların değerlendirilmesini destekliyor.

**SIEM entegrasyonu.** PACS sistemleri Sentinel, Splunk, QRadar, Elastic, ArcSight gibi platformlara olay kayıtları gönderebiliyor. Kullanıcı fiziksel olarak binaya girmeden şirket ağından oturum açıyorsa, ya da aynı kullanıcı kısa sürede iki farklı lokasyonda "görünüyorsa", bu tür anomaliler korelasyon kurallarıyla yakalanabiliyor. Fiziksel ve dijital güvenlik ekipleri bu sayede ortak bir görünürlük kazanıyor.

Ağ tarafında dikkat edilmesi gereken en temel şey **segmentasyon**: PACS altyapısı kullanıcı bilgisayarları, misafir ağı, IoT cihazları veya yazıcılarla aynı segmentte olmamalı. Bunun yerine ayrı VLAN'larda konumlandırılıp sadece gerekli servislerle iletişimine izin verilmeli — saldırı yüzeyini ciddi şekilde küçültüyor.

**Yüksek erişilebilirlik.** Veri merkezleri, sağlık kuruluşları ve kritik altyapılar gibi kesintiye toleransı olmayan ortamlarda; yedek güç kaynakları, redundant ağ bağlantıları, failover sunucular ve yedek kontrol panelleri gibi önlemlerle tek bir donanım arızasının fiziksel erişimi durdurması engelleniyor.

Geçmişte PACS kapalı devre çalışan bağımsız bir altyapıydı. Bugün AD, LDAP, IAM, SIEM, VMS, bulut servisleri ve mobil kimlik platformlarıyla sürekli veri alışverişi yapıyor. Bu yüzden bir PACS değerlendirmesi artık sadece okuyucuları değil, tüm kimlik yönetimi ve ağ ekosistemini kapsayan bütüncül bir analiz gerektiriyor.

---

## OSDP: Wiegand'dan Sonraki Adım

Okuyucu ile controller arasındaki bağlantı uzun yıllar Wiegand üzerinden yapıldı — bu protokolde şifreleme yok, mesafe kısıtlı, tek yönlü haberleşme. Sektör bugün Security Industry Association (SIA)'nın geliştirdiği **OSDP**'ye (Open Supervised Device Protocol) geçiyor. Bu protokol sadece veri aktarımını standartlaştırmıyor; cihaz yönetimi ve denetlenebilirlik açısından da önemli avantajlar sunuyor.

Secure Channel özelliği etkinleştirildiğinde okuyucu ile controller arasında karşılıklı kimlik doğrulama gerçekleşiyor ve iletişim şifrelenmiş bir oturum üzerinden yürütülüyor. Başlıca avantajları: AES tabanlı güvenli haberleşme, karşılıklı cihaz doğrulaması, veri bütünlüğünün korunması, yetkisiz cihazların tespiti, merkezi cihaz yönetimi ve denetlenebilir bir haberleşme altyapısı. Yeni kurulumlarda OSDP Secure Channel artık neredeyse standart bir gereksinim olarak görülüyor; hâlâ sadece Wiegand üzerinden çalışan bir sistem, bir değerlendirmede genelde öncelikli bulgulardan biri olarak öne çıkar.

---

## Zero Trust Fiziksel Erişime Nasıl Uygulanıyor?

Zero Trust denince akla hep ağ güvenliği gelir ama aynı mantık fiziksel erişime de taşınıyor. Temel fikir basit: hiçbir kullanıcı ya da cihaz, sadece "binanın içinde bulunduğu için" güvenilir sayılmıyor.

Modern sistemlerde erişim kararı sadece kart bilgisine göre verilmiyor; kullanıcının rolü, erişilmek istenen alan, günün saati, cihaz durumu, kimlik doğrulama geçmişi ve kurumsal güvenlik politikaları birlikte değerlendirilebiliyor. Bu yaklaşım fiziksel güvenliği statik kurallardan çıkarıp bağlama duyarlı hale getiriyor.

Buna paralel olarak **en az ayrıcalık ilkesi** de fiziksel dünyaya uygulanmalı: her kullanıcı yalnızca görevini yerine getirmek için gerekli alanlara erişebilmeli. Muhasebe personelinin veri merkezine, ziyaretçilerin operasyon ofislerine, dış yüklenicilerin yönetim katına erişebilmesi normal şartlarda beklenmiyor. Rol tabanlı erişim kontrolü ve düzenli yetki gözden geçirmeleri bu yaklaşımın temelini oluşturuyor.

Fiziksel erişim sistemleri uzun ömürlü altyapılar olduğu için yıllarca değişmeden kalabiliyor, ama tehdit ortamı sürekli değişiyor. Bu yüzden kart teknolojilerinin güncelliği, haberleşme protokollerinin güvenliği, kimlik yaşam döngüsü süreçleri, olay kayıtlarının izlenmesi, ağ segmentasyonu, donanım/yazılım güncellemeleri ve yedekleme/felaket kurtarma planlarının düzenli aralıklarla gözden geçirilmesi gerekiyor.

---

## Bulut Tabanlı PACS (PACSaaS)

Şirket içi sistemlerden bulut tabanlı servislere geçiş, fiziksel erişim kontrolünde de yaşanıyor. Physical Access Control as a Service (PACSaaS), erişim kontrol altyapısının tamamının veya belirli bileşenlerinin bulut üzerinden yönetilmesi anlamına geliyor — erişim politikaları, kullanıcı kayıtları, cihaz konfigürasyonları ve olay kayıtları merkezi bir bulut platformu üzerinden yönetilebiliyor.

Geleneksel mimaride sunucular kurum veri merkezindeyken, PACSaaS'ta yönetim katmanı hizmet sağlayıcının altyapısında çalışıyor. Bu özellikle çok lokasyonlu şirketlerde, zincir mağazalarda, üniversitelerde, hastanelerde ve kampüs yapılarında ciddi bir operasyonel kolaylık sağlıyor: merkezi politika yönetimi, otomatik yazılım güncellemeleri, yüksek erişilebilirlik, ölçeklenebilirlik, uzaktan cihaz yönetimi, merkezi log toplama ve felaket kurtarma kolaylığı gibi avantajlar geliyor. Yeni bir ofisin sisteme eklenmesi çoğunlukla sadece yeni cihazların tanımlanmasıyla mümkün oluyor, yerel sunucu kurulumu ihtiyacı büyük ölçüde azalıyor.

Ama bu geçiş yeni güvenlik gereksinimlerini de beraberinde getiriyor: API güvenliği, kimlik federasyonu, çok faktörlü kimlik doğrulama, sertifika yönetimi, anahtar yönetimi, yetkilendirme politikaları ve bulut günlüklerinin izlenmesi kritik hale geliyor. Modern PACS çözümlerinin büyük kısmı REST tabanlı API'ler üzerinden diğer kurumsal sistemlerle konuşuyor — yani PACS artık klasik bir bina otomasyonu değil, kurumsal BT altyapısının aktif bir parçası.

---

## Mobil Kimlik ve Biyometri

Fiziksel kartlar uzun yıllardır erişim kontrolünün temel bileşeni ama mobil kimlik çözümleri hızla yaygınlaşıyor. Kullanıcı bilgileri güvenli donanım bileşenlerinde saklanabiliyor ve biyometrik doğrulama mekanizmalarıyla korunabiliyor — bu hem kullanıcı deneyimini iyileştiriyor hem kart kaybı gibi operasyonel sorunları azaltıyor. Yaygın platformlar arasında Apple Wallet, Google Wallet, HID Mobile Access, HID SEOS, STid Mobile ID ve Suprema Mobile Access sayılabilir.

Kimlik bilgileri genelde işletim sisteminin güvenli donanım alanlarında saklanıyor — Apple Secure Enclave, Android StrongBox, Trusted Execution Environment (TEE) gibi teknolojiler hassas kriptografik anahtarların korunmasını sağlıyor. Bu, kimlik bilgilerinin sadece uygulama seviyesinde değil donanım destekli şekilde korunması anlamına geliyor.

Biyometrik doğrulama (parmak izi, yüz tanıma, iris) mobil erişim çözümleriyle sıkça birlikte kullanılıyor. Burada önemli olan nokta: biyometrik veri genelde doğrudan erişim sistemine gönderilmiyor. Çoğu modern mimaride doğrulama cihaz üzerinde gerçekleşiyor ve erişim sistemi sadece "doğrulandı/doğrulanmadı" sonucunu alıyor — bu hem güvenlik hem de kişisel verilerin korunması (KVKK/GDPR) açısından önemli bir tasarım tercihi.

FIDO Alliance'ın geliştirdiği parolasız kimlik doğrulama standartları doğrudan fiziksel erişim için tasarlanmamış olsa da, dijital kimlik doğrulamadaki bu dönüşüm fiziksel güvenlik çözümlerini de etkiliyor. Gelecekte fiziksel ve dijital kimliklerin aynı güven modeli içinde değerlendirilmesi bekleniyor — bina girişleri, VPN erişimleri, bulut servisleri, ayrıcalıklı hesaplar ve fiziksel erişim izinlerinin tek bir kimlik yaşam döngüsü içinde yönetildiği bir yöne doğru gidiliyor.

---

## Davranış Analitiği (UEBA)

Büyük kurumlarda fiziksel erişim sistemleri günde milyonlarca olay kaydı üretebiliyor ve bunu insan gözüyle taramak mümkün değil. Bu yüzden birçok SOC, User and Entity Behavior Analytics (UEBA) çözümlerinden yararlanıyor. Bu sistemler kullanıcıların normal davranışlarını zaman içinde öğrenip olağan dışı hareketleri belirleyebiliyor: mesai saatleri dışında erişim talepleri, alışılmadık lokasyonlardan girişler, beklenmeyen güvenlik bölgelerine yönelim, olağan dışı erişim yoğunluğu gibi davranışlar risk puanını artırabiliyor. Klasik kural tabanlı alarm mekanizmalarına göre çok daha bağlamsal bir değerlendirme sunuyor.

---

## Sonuç

RFID tabanlı erişim sistemleri uzun süre "kapıyı açan elektronik kutu" olarak görüldü. Ama artık öyle değil — kurumsal siber güvenlik mimarisinin gerçek bir parçası. Bir kartın okutulmasıyla başlayan süreç; kart-okuyucu haberleşmesi, controller'ın yetkilendirme kararı, merkezi sunucunun politika değerlendirmesi, olay kaydı ve çoğu zaman AD/IAM/SIEM entegrasyonunu içine alan uzun bir zincir.

Bu yüzden "gelişmiş kart kullanıyoruz" cümlesi tek başına hiçbir şey garanti etmiyor. Kart teknolojisi kadar; haberleşme protokolü (Wiegand mı OSDP mi), anahtar yönetimi, kimlik yaşam döngüsü, ağ segmentasyonu, merkezi izleme ve operasyonel süreçler de güvenlik seviyesini belirliyor. Fiziksel ve dijital güvenliği artık ayrı kutularda değerlendirmek gerçekçi değil; fiziksel erişim kayıtları dijital olaylarla birlikte analiz ediliyor, kullanıcı davranışları bağlamsal olarak değerlendiriliyor, risk temelli kararlar uygulanıyor. Zero Trust yaklaşımı ağ erişimi kadar fiziksel erişim için de giderek daha fazla benimseniyor.

Önümüzdeki yıllarda mobil kimlik teknolojilerinin, bulut tabanlı PACS çözümlerinin, davranış analitiğinin ve yapay zekâ destekli güvenlik platformlarının daha da yaygınlaşması bekleniyor. Ama teknolojinin gelişmesi tek başına yeterli değil — güvenli bir fiziksel erişim altyapısı doğru teknoloji seçimi, güvenli yapılandırma, düzenli değerlendirme ve etkin operasyonel süreçlerin birlikte uygulanmasını gerektiriyor.

Bir pentester gözüyle bakıldığında kapıdaki okuyucu, sadece duvara vidalı bir kutu değil — kablosuz haberleşme, gömülü sistem güvenliği, kriptografi, kimlik yönetimi ve ağ güvenliğinin kesiştiği bir güven zincirinin ilk halkası. Zincirin herhangi bir yerindeki zayıflık, kurumun hem fiziksel hem dijital güvenliğini aynı anda etkileyebiliyor. Ve genellikle en zayıf halka kart teknolojisinden çok, o kartın yaşam döngüsünü kimin, nasıl yönettiği oluyor.

---

## Kaynakça

**Standartlar ve resmî dokümanlar**
- National Institute of Standards and Technology (2023). *NIST Special Publication 800-116 Rev. 1 — Guidelines for the Use of PIV Credentials in Facility Access.*
- National Institute of Standards and Technology (2023). *NIST Special Publication 800-63 — Digital Identity Guidelines.*
- ISO/IEC. *ISO/IEC 14443 — Identification Cards — Contactless Integrated Circuit Cards — Proximity Cards.*
- ISO/IEC. *ISO/IEC 15693 — Identification Cards — Contactless Integrated Circuit Cards — Vicinity Cards.*
- Security Industry Association (SIA). *Open Supervised Device Protocol (OSDP) Specification.*

**Akademik çalışmalar**
- Garcia, F. D., Koning Gans, G., Muijrers, R., van Rossum, P., Verdult, R., Schreur, R., & Jacobs, B. (2008). *Dismantling MIFARE Classic.* European Symposium on Research in Computer Security (ESORICS).
- Nohl, K., Evans, D., Starbug, H., & Plotz, H. (2008). *Reverse Engineering a Cryptographic RFID Tag.*

**Üretici dokümanları**
- NXP Semiconductors. *MIFARE DESFire EV3 Product Short Data Sheet.*
- NXP Semiconductors. *AN12757 — MIFARE DESFire EV3 Features and Security Overview.*
- HID Global. *Security Best Practices for Physical Access Control Systems.*
- HID Global. *HID Mobile Access White Paper.*

**Güvenlik rehberleri**
- European Union Agency for Cybersecurity (ENISA). *Good Practices for Security of Internet of Things and Smart Infrastructure.*
- OWASP Foundation. *Internet of Things Security Guidance.*
- MITRE Corporation. *MITRE ATT&CK Framework — Enterprise Matrix.*
- MITRE Corporation. *MITRE ATT&CK for ICS.*
- FIDO Alliance. *FIDO2: Moving the World Beyond Passwords.*

**Ek okuma önerileri**
- Ross Anderson. *Security Engineering (3rd Edition).*
- Charles Pfleeger, Shari Lawrence Pfleeger & Jonathan Margulies. *Security in Computing.*
- Eric Cole. *Advanced Persistent Threat: Understanding the Danger and How to Protect Your Organization.*
