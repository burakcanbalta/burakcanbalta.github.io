# HTB - Explosion Box Writeup

**Hedef:** 10.129.1.13
**Tarih:** 27.08.2026

## Giriş

Bu box'a başlarken elimde sadece bir IP vardı: 10.129.1.13. Her zaman yaptığım gibi ilk iş tam kapsamlı bir nmap taramasıyla başladım, çünkü hangi servislerin ayakta olduğunu bilmeden ilerlemek zaman kaybı oluyor.

## Nmap Taraması

```
nmap -sS -A -p- -T5 10.129.1.13
```

Burada `-p-` ile tüm portları taradım, `-A` ile de OS/servis versiyon tespiti ve script taramasını dahil ettim. `-T5` biraz agresif ama box'ın zaman baskısı yoktu, hız kazanmak istedim.

Sonuç şöyle çıktı:

```
PORT      STATE SERVICE           VERSION
135/tcp   open  msrpc             Microsoft Windows RPC
139/tcp   open  netbios-ssn       Microsoft Windows netbios-ssn
445/tcp   open  microsoft-ds?
3389/tcp  open  ms-wbt-server     Microsoft Terminal Services
| rdp-ntlm-info:
|   Target_Name:        EXPLOSION
|   NetBIOS_Domain_Name: EXPLOSION
|   NetBIOS_Computer_Name: EXPLOSION
|   DNS_Domain_Name:    Explosion
|   DNS_Computer_Name:  Explosion
|   Product_Version:    10.0.17763
|_  System_Time:        2026-08-27T11:45:41+00:00
5985/tcp  open  http    Microsoft HTTPAPI httpd 2.0
47001/tcp open  http    Microsoft HTTPAPI httpd 2.0
```

135, 139, 445 klasik Windows üçlüsü, yani karşımda bir Windows makine olduğu belli. Beni asıl ilgilendiren 3389/tcp — `ms-wbt-server`, yani RDP. `rdp-ntlm-info` sayesinde makine adının **EXPLOSION** olduğunu ve Windows Server 2019 (build 17763) çalıştığını da öğrenmiş oldum, bunu not aldım çünkü ileride işime yarayabilir.

5985 ve 47001 WinRM'e işaret ediyor ama şu an için RDP daha kestirme bir yol gibi göründüğü için oradan devam etme kararı aldım.

## RDP Bağlantısı Denemesi

RDP açık olduğuna göre klasik bir deneme yapmadan geçemezdim: bazen sistemlerde yönetici hesabı parolasız bırakılmış oluyor, özellikle test/lab ortamlarında bu sık karşılaşılan bir hata. Denemeye değerdi.

```
xfreerdp3 /v:10.129.1.13 /u:administrator /cert:ignore
```

- `/v:` hedef IP
- `/u:` kullanıcı adı
- `/cert:ignore` sertifika uyarısını atlamak için (self-signed sertifika olduğu için Kali sürekli soruyor, bununla susturuyorum)

Parola sorulduğunda hiçbir şey yazmadan enter'a bastım. Ve inanmayacaksınız ama bağlandı. `administrator` hesabının parolası boştu.

Bu tarz bir açık gerçek ortamda pek görülmez ama var olduğu yerlerde de bilgisayar korsanları için en kısa yoldur. Elle deneme yapmasaydım muhtemelen bu kadar kolay atlatabileceğimi fark etmezdim.

## Flag'i Bulma

Masaüstüne bağlandığımda ilk gördüğüm şey `flag` isimli bir metin belgesiydi. Notepad ile açtım:

```
951fa96d7830c451b536be5a6be008a0
```

Flag bu.

## Kısa Notlar / Görev Cevapları

Box üzerindeki soruları kendi cümlelerimle toparladım:

- **RDP** = Remote Desktop Protocol
- Komut satırı üzerinden sunucuyla etkileşim → **CLI**
- Grafik arayüz üzerinden etkileşim → **GUI**
- Şifrelemesiz, TCP 23'te dinleyen eski araç → **Telnet**
- TCP 3389'daki servis → **RDP (ms-wbt-server / Terminal Services)**
- xfreerdp'de hedef IP anahtarı → **/v:**
- Boş parolayla masaüstü veren kullanıcı → **administrator**

## Sonuç

Aslında bu box teknik anlamda çok derin bir şey öğretmedi ama önemli bir gerçeği hatırlattı: bazen en gelişmiş açık değil, en temel hatalar (boş parola, yönetici hesabının dışarı açık olması) en büyük riski oluşturuyor. Nmap ile RDP'yi görüp direkt boş parola denemek gibi basit bir adım bile bazen işi bitiriyor.

Gerçek bir ortamda böyle bir durumla karşılaşsam raporda mutlaka şunları vurgulardım:

- Administrator hesabı asla boş/zayıf parolayla bırakılmamalı
- RDP dışarıya doğrudan açık olmamalı, VPN arkasında olmalı
- NLA (Network Level Authentication) aktif edilmeli
- Başarısız girişimler için lockout policy şart

Box burada bitti, flag teslim edildi.
