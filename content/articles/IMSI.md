# IMSI 
## Özet

Bu makale, IMSI Catcher saldırılarının teknik detaylarını, Türkiye’deki MIT çetesinin operasyonlarını ve KEC cihazları ile entegrasyon senaryolarını ele almaktadır. SDR tabanlı RF manipülasyonları, baseband açıkları ve 2G downgrade saldırıları üzerinden veri sızdırma mekanizmaları detaylı olarak incelenmektedir. Ayrıca, pasif ve aktif tespit yöntemleri ile hukuki ve etik çerçeveye dair bilgiler sunulmaktadır.

---

## 1. Giriş

IMSI (International Mobile Subscriber Identity) Catcher’lar, mobil ağlarda sahte baz istasyonu işlevi görerek; kullanıcıların IMSI/IMEI verilerini toplar, konum takibi yapar ve GSM/3G/4G iletişimini manipüle edebilir. Modern saldırı senaryolarında, IMSI catcher’lar yalnızca sinyal bozmakla kalmaz, aynı zamanda **baseband işlemci açıklarını**, **2G downgrade saldırılarını** ve **KEC cihazları gibi kritik altyapıları** hedef alabilir.

Türkiye’de 2022’de MIT tarafından çökertilen organize çete, yargı mensupları ve kritik kurum personeli hedef alınarak **IMSI sızıntısı ve konum takibi** yapmış, operasyonel olarak RF ve KEC cihazlarını entegre şekilde kullanmıştır.

<img width="833" height="522" alt="Ekran görüntüsü 2025-08-15 145719" src="https://github.com/user-attachments/assets/0f53b561-27d6-4bf2-b8b0-27a4e385b12a" />


---

## 2. IMSI Catcher Çalışma Prensibi ve RF Mekanizmaları

### 2.1 Sinyal Manipülasyonu

- **Sinyal bastırma (Jamming):** Kurbanın mobil cihazını gerçek baz istasyonundan kopartır.
- **Güçlü sahte baz yayını:** Cihaz sahte istasyona bağlanır.
- **Downgrade ve şifre çözme:** 2G’ye düşürülen cihazlar A5/1, A5/2 gibi zayıf algoritmalar üzerinden veri sızdırır.

### 2.2 Baseband ve Protokol Açıkları

- IMSI catcher’lar RFC 3588 (AAA) ve GSM/LTE kimlik doğrulama protokollerini manipüle eder.
- Türkiye’deki MIT çetesi, **KEC cihazları üzerinden APDU komutlarını** kullanarak IMSI bilgisini sızdırmıştır.

![abdu1](https://github.com/user-attachments/assets/f9886f19-09d3-49cd-a481-439e29890001)

![abdu](https://github.com/user-attachments/assets/2d25a581-2a59-4436-a824-0208ce4cf806)

## 3. Türkiye’de RF Güvenlik Mitlerinin Çöküşü

### 3.1 “Şifreleme Yeterlidir” Yanılgısı

- GSM A5/1 ve A5/2 şifrelemeleri 2003’te kırılmıştır (Karsten Nohl).
- OsmocomBB ile 2G downgrade saldırıları yaygınlaşmıştır.
- Türkiye’de tespit edilen 15 farklı IMSI catcher modeli (Krackin, StingRay varyantları) ile aktif testler yapılmıştır.

### 3.2 Fiziksel Erişim Gerekir Yanılgısı

- SDR tabanlı sistemler (HackRF One, BladeRF) ile 5 km’ye kadar erişim.
- UAV üzerine monte edilmiş IMSI catcher’lar (2021 İstanbul örneği).

### 3.3 Yasal Dinleme Dışında Mümkün Değil Yanılgısı

- KEC cihazları ve NFC üzerinden IMSI sızıntısı.
- Baseband backdoor’lar (Qualcomm CVE-2018-11279) ile operatör içi veri sızması.

---

## 4. MIT Çetesi Operasyonunun Teknik Analizi

### Saldırı Mimari Yapısı

1. **KEC cihazları:** NFC/APDU ile IMSI sızıntısı.
2. **IMSI Catcher:** Sahte baz istasyonu ile cihazları zorla bağlatma.
3. **RF Spektrum Analizi:** SDR ile gerçek zamanlı RF tarama.

### Kullanılan Açıklar

- TS 13583 acil durum modu kötüye kullanımı.
- Baseband backdoor’lar (Qualcomm, MediaTek).
- KEC cihazı sürücü zafiyetleri (PC/SC imzasız komut işleme).

### Operasyon Adımları

1. Hedef belirleme (yargı mensupları, kritik personel)
2. RF ortam keşfi ve sinyal bastırma
3. Sahte baz istasyonu ile downgrade + IMSI toplama
4. KEC cihazlarından APDU komutları ile veri sızıntısı
5. Elde edilen verilerin merkezi sunucuda toplanması

![thumbs_b_c_aeaa0a54d65dee1611ad55bb0be3fd67](https://github.com/user-attachments/assets/26b35600-1fc2-433c-b2cb-bae67dbae2d8)


##  Yapısal ve Görsel Geliştirmeler

### IMSI Catcher Sinyal Manipülasyonu

```
Gerçek Baz İstasyonu  --->  RF Sinyal Bastırma
                           |
                           v
                     Sahte Baz İstasyonu
                           |
                           v
                   IMSI ve Konum Toplama
                           |
                           v
                    Merkezi Veri Sunucusu
```
![baba](https://github.com/user-attachments/assets/12fd6940-0e30-4ee0-91f8-3a00eb6ab540)

![ana](https://github.com/user-attachments/assets/f43c7624-cf0b-4539-b771-c7a527143618)

### SDR Laboratuvar Simülasyonu

- **Donanım:** HackRF One + LNA + Bandpass filtre (880-915 MHz)
- **Sinyal Yakalama Komutları:**

```bash
grsgem_scanner -b GSM900 -v
grsm_livemon -f 942.6M -g 40 -v
```

## Tespit ve Savunma Mekanizmaları

### Pasif Tespit

- Timing Advance analizi
- MCC/MNC çakışması kontrolü
- Ciphering indicator analizi (Android: ##4636## → "Ciphering: Off")

### Aktif Savunma

- SDR tabanlı spektrum taraması (GQRX + GNU Radio)
- Secure Element sertifika zorunluluğu (TS 13584)
- AIMSICD ve benzeri açık kaynaklı IMSI catcher detektörleri

### Politik Önlemler

- 2G şebekelerin kapatılması
- Lawful Interception şifreleme standartlarının güncellenmesi (TS 101 671)


## Hukuki ve Etik Boyut

- **TCK 245:** Yetkisiz elektronik iletişim dinlemesi (3-7 yıl)
- **BTK 2013/5:** RF spektrumunun izinsiz kullanımı (500.000 TL’ye kadar ceza)
- **KVKK 12:** Kişisel verilerin güvenliğinin ihlali
  

## Referanslar

1. Karsten Nohl, GSM Security Research (2003-2022)
2. TS 13583 / TS 13584 / TS 13585
3. Qualcomm CVE-2018-11279
4. Türkiye MIT operasyon raporları (kamuya açık özetler)
5. AIMSICD ve GR-GSM dokümantasyonu
