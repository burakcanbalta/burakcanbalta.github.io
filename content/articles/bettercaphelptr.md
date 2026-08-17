# BettercapHelpTR 🇹🇷

🔍 **Bettercap modül ve komutlarının detaylı Türkçe açıklaması**  
Bu belge, Bettercap’in `help` komutuyla listelenen tüm modüllerini ve temel komutlarını sade, anlaşılır ve profesyonel biçimde açıklar.

---

## 📌 GENEL KOMUTLAR

### 🟡 `help`
- **Açıklama:** Tüm komutları ve modülleri listeler.  
- **Kullanım:** `help` veya `help net.probe`

### 🟡 `active`
- **Açıklama:** Aktif çalışan modülleri listeler.

### 🟡 `quit`
- **Açıklama:** Bettercap oturumunu sonlandırır.

### 🟡 `sleep SECONDS`
- **Açıklama:** Belirtilen süre kadar bekler.  
- **Kullanım:** `sleep 5`

### 🟡 `set NAME VALUE`
- **Açıklama:** Bir modül değişkenini ayarlar.  
- **Kullanım:** `set net.sniff.verbose true`

### 🟡 `read VARIABLE PROMPT`
- **Açıklama:** Kullanıcıdan veri almak için prompt oluşturur.

### 🟡 `clear`
- **Açıklama:** Ekranı temizler.

### 🟡 `include CAPLET`
- **Açıklama:** Caplet (betik) dosyasını yükler.

### 🟡 `! COMMAND`
- **Açıklama:** Shell komutu çalıştırır.  
- **Kullanım:** `! ls`

### 🟡 `alias MAC NAME`
- **Açıklama:** Belirtilen MAC adresine takma ad tanımlar.

---

## ⚙️ MODÜLLERİN DETAYLI AÇIKLAMALARI

### 🟡 `any.proxy`
- **Açıklama:** Bilinmeyen protokoller dahil tüm TCP/UDP trafiğini yönlendirir.
- **Kullanım:** `any.proxy on`
- **Senaryo:** Özel ağ protokollerini analiz etmek için.

### 🟡 `api.rest`
- **Açıklama:** Bettercap'i REST API üzerinden kontrol etmeyi sağlar.
- **Kullanım:** `api.rest on`
- **Senaryo:** Uzaktan otomasyon ve entegrasyon işlemleri.

### 🟡 `arp.spoof`
- **Açıklama:** Ağ MITM saldırısı için ARP spoofing yapar.
- **Kullanım:** `arp.spoof on`
- **Senaryo:** Ağ trafiğini dinleme ve yönlendirme.

### 🟡 `ble.recon`
- **Açıklama:** Bluetooth Low Energy cihazları tarar.
- **Kullanım:** `ble.recon on`
- **Senaryo:** BLE cihaz keşfi, takip ve analiz.

### 🟡 `c2`
- **Açıklama:** Bettercap’i C2 sunucusuna çevirir.
- **Kullanım:** `c2 on`
- **Senaryo:** Ajan tabanlı uzaktan kontrol.

### 🟡 `caplets`
- **Açıklama:** Otomasyon için Bettercap betikleridir.
- **Kullanım:** `caplets.update`, `caplets.show`
- **Senaryo:** Hızlı yapılandırma ve görev otomasyonu.

### 🟡 `dhcp6.spoof`
- **Açıklama:** IPv6 istemcilere sahte DHCPv6 yanıtları gönderir.
- **Kullanım:** `dhcp6.spoof on`
- **Senaryo:** IPv6 MITM öncesi trafik yönlendirme.

### 🟡 `dns.spoof`
- **Açıklama:** DNS taleplerini sahte IP adreslerine yönlendirir.
- **Kullanım:** `dns.spoof on`
- **Senaryo:** Phishing, sahte site yönlendirme.

### 🟡 `events.stream`
- **Açıklama:** Modül olaylarını canlı olarak terminalde gösterir.
- **Kullanım:** `events.stream on`
- **Senaryo:** Gerçek zamanlı sistem gözlemi.

### 🟡 `gps`
- **Açıklama:** GPS verisi desteği varsa konum alır.
- **Kullanım:** `gps on`
- **Senaryo:** Mobil cihaz izleme, lokasyon tespiti.

### 🟡 `hid`
- **Açıklama:** Klavye gibi davranarak HID saldırıları yapar.
- **Kullanım:** `hid on`
- **Senaryo:** Tuş simülasyonu ve exploit girişleri.

### 🟡 `http.proxy`
- **Açıklama:** HTTP trafiğini yönlendirip analiz eder.
- **Kullanım:** `http.proxy on`
- **Senaryo:** Web isteklerini izleme, değiştirme.

### 🟡 `http.server`
- **Açıklama:** Yerel HTTP sunucusu açar.
- **Kullanım:** `http.server on`
- **Senaryo:** Sahte web sayfası barındırmak.

### 🟡 `https.proxy`
- **Açıklama:** HTTPS trafiğini intercept eden proxy.
- **Kullanım:** `https.proxy on`
- **Senaryo:** SSL trafiğini analiz etmek (sertifika ile).

### 🟡 `https.server`
- **Açıklama:** HTTPS sunucusu çalıştırır.
- **Kullanım:** `https.server on`
- **Senaryo:** Güvenli sahte sayfa servis etmek.

### 🟡 `mac.changer`
- **Açıklama:** MAC adresini rastgele veya özel olarak değiştirir.
- **Kullanım:** `mac.changer on`
- **Senaryo:** İz gizleme, kimlik değişimi.

### 🟡 `mdns.server`
- **Açıklama:** mDNS yanıtları sağlar/simüle eder.
- **Kullanım:** `mdns.server on`
- **Senaryo:** Multicast DNS manipülasyonu.

### 🟡 `mysql.server`
- **Açıklama:** Sahte MySQL sunucusu çalıştırır.
- **Kullanım:** `mysql.server on`
- **Senaryo:** Kimlik bilgisi toplama tuzağı.

### 🟡 `ndp.spoof`
- **Açıklama:** IPv6 için ARP eşdeğeri NDP spoofing yapar.
- **Kullanım:** `ndp.spoof on`
- **Senaryo:** IPv6 MITM saldırısı.

### 🟡 `net.probe`
- **Açıklama:** Ağda aktif cihazları sorgular (ARP, DNS, mDNS).
- **Kullanım:** `net.probe on`
- **Senaryo:** Ağ keşfi, gizli cihazları bulma.

### 🟡 `net.recon`
- **Açıklama:** Ağı sürekli tarar ve cihazları algılar.
- **Kullanım:** `net.recon on`
- **Senaryo:** Ağ haritalama ve hedef tanıma.

### 🟡 `net.sniff`
- **Açıklama:** Ağ paketlerini yakalar, içerik analiz eder.
- **Kullanım:** `net.sniff on`
- **Senaryo:** Şifre, veri, oturum çalma.

### 🟡 `packet.proxy`
- **Açıklama:** Paketleri alıp proxy üzerinden geçirir.
- **Kullanım:** `packet.proxy on`
- **Senaryo:** Uygulama protokol trafiğini analiz etmek.

### 🟡 `syn.scan`
- **Açıklama:** Hedef portları SYN paketleriyle tarar.
- **Kullanım:** `syn.scan on`
- **Senaryo:** Açık servisleri belirlemek (stealth scan).

### 🟡 `tcp.proxy`
- **Açıklama:** TCP bağlantılarını proxy üzerinden yönlendirir.
- **Kullanım:** `tcp.proxy on`
- **Senaryo:** Trafik izleme ve müdahale.

### 🟡 `ticker`
- **Açıklama:** Belirli aralıklarla bilgi verir.
- **Kullanım:** `ticker on`
- **Senaryo:** Sürekli durum güncellemesi.

### 🟡 `ui`
- **Açıklama:** Web arayüzünü başlatır (GUI).
- **Kullanım:** `ui on`
- **Senaryo:** Görsel Bettercap yönetimi.

### 🟡 `update`
- **Açıklama:** Modül ve caplet güncellemelerini yapar.
- **Kullanım:** `update`
- **Senaryo:** En son içeriklere erişim.

### 🟡 `wifi`
- **Açıklama:** Kablosuz ağları tarar ve analiz eder.
- **Kullanım:** `wifi.recon on`, `wifi.assoc`
- **Senaryo:** WPA handshake yakalama, kablosuz ağ izleme.

### 🟡 `wol`
- **Açıklama:** Wake-on-LAN paketi gönderir.
- **Kullanım:** `wol <MAC>`
- **Senaryo:** Uzak sistemleri ağdan uyandırma.

---

## 📄 Lisans

MIT Lisansı ile sunulmuştur.  
Sadece test ve eğitim amaçlı, izinli sistemlerde kullanılmalıdır.  
Kötüye kullanım **yasal sonuçlara** yol açabilir.

---

💡 GitHub'da yıldız ver → [burakcanbalta/bettercaphelptr](https://github.com/burakcanbalta/bettercaphelptr)
