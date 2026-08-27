# HTB - PreIgnition Box Writeup

**Hedef:** 10.129.184.20
**Tarih:** 27.08.2026

## Giriş

PreIgnition'a başlarken de her zamanki rutini uyguladım: önce ne var ne yok görmek için tam kapsamlı bir nmap taraması. IP dışında elimde hiçbir bilgi yoktu, o yüzden ilk adım her zaman aynı.

## Nmap Taraması

```
nmap -sS -A -p- 10.129.184.20 -T5
```

Çıktı şu şekildeydi:

```
PORT   STATE SERVICE VERSION
80/tcp open  http    nginx 1.14.2
|_http-title: Welcome to nginx!
|_http-server-header: nginx/1.14.2
Device type: general purpose|router
Running: Linux 5.X, MikroTik RouterOS 7.X
OS CPE: cpe:/o:linux:linux_kernel:5 cpe:/o:mikrotik:routeros:7 cpe:/o:linux:linux_kernel:5.6.3
OS details: Linux 5.0 - 5.14, MikroTik RouterOS 7.2 - 7.5 (Linux 5.6.3)
Network Distance: 2 hops
```

Burada tablo çok basit aslında: tek açık port 80/tcp, üzerinde de nginx 1.14.2 çalışıyor. Diğer portlar kapalı olduğu için saldırı yüzeyi de otomatik olarak tek noktaya indirgeniyor — web servisine. OS tespiti MikroTik/Linux gibi bir şeyler söylüyor ama bu aşamada beni asıl ilgilendiren web tarafı, ona odaklandım.

Tarayıcıdan siteye gittiğimde varsayılan nginx karşılama sayfasını gördüm, yani içerik anlamında elle gezilebilecek bir şey yok. Bu durumda sırada klasik bir adım var: dizin/dosya keşfi.

## Dizin Taraması (Directory Brute-Forcing)

Sayfada görünür bir şey olmadığına göre gizli dosya/dizinleri bulmak için brute-force denemesi yaptım. Ben bu iş için ffuf kullanmayı tercih ediyorum:

```
ffuf -u http://10.129.184.20/FUZZ -w /usr/share/wordlists/dirb/common.txt
```

Sonuç net çıktı:

```
admin.php [Status: 200, Size: 999, Words: 132, Lines: 32, Duration: 61ms]
```

`admin.php` diye bir sayfa var ve 200 dönüyor, yani erişilebilir. Bunu görünce direkt tarayıcıdan `/admin.php` adresine gittim.

## Giriş Sayfası ve Flag

Karşıma bir login formu çıktı. İlk aklıma gelen klasik zayıf kimlik bilgilerini denemek oldu — çoğu zaman böyle basit boxlarda geliştiricinin varsayılan bilgileri değiştirmeyi unutması yaygın bir hata. `admin:admin` ile giriş yaptım ve içeri girdim.

Giriş başarılı olur olmaz flag zaten ekranda karşıma çıktı, ekstra bir işlem yapmama gerek kalmadı.

## Sonuç

PreIgnition, temel keşif adımlarının önemini gösteren güzel bir örnek: tek açık portu bulmak, o portun arkasındaki servisi anlamak, görünürde bir şey yoksa dizin taraması yapmak ve son olarak zayıf/varsayılan kimlik bilgilerini denemek. Karmaşık bir exploit gerekmedi, sadece metodik ilerlemek yeterli oldu.

Gerçek bir ortamda bu tarz bir bulguyu raporlarken şunları vurgulardım:

- Yönetim panelleri asla tahmin edilebilir/varsayılan bir yol üzerinden (`/admin.php` gibi) yayınlanmamalı, en azından ek bir erişim kontrolü (IP whitelist, VPN vs.) olmalı
- Varsayılan kullanıcı adı/parola kombinasyonları (`admin:admin`) production ortamına asla taşınmamalı
- Dizin listeleme ve gizli sayfa keşfine karşı sunucu tarafında rate-limiting veya WAF benzeri bir önlem düşünülebilir

---

## Görev Soruları ve Cevapları

**Task 1 — Directory Brute-forcing is a technique used to check a lot of paths on a web server to find hidden pages. Which is another name for this?**
(ii) dir busting

**Task 2 — What switch do we use for nmap's scan to specify that we want to perform version detection?**
`-sV` (bizim kullandığımız `-A` de içine versiyon tespitini otomatik olarak dahil ediyor)

**Task 3 — What does Nmap report is the service identified as running on port 80/tcp?**
http

**Task 4 — What server name and version of service is running on port 80/tcp?**
nginx 1.14.2

**Task 5 — What switch do we use to specify to Gobuster we want to perform dir busting specifically?**
`dir` (örneğin: `gobuster dir -u <hedef> -w <wordlist>`)

**Task 6 — When using gobuster to dir bust, what switch do we add to make sure it finds PHP pages?**
`-x php`

**Task 7 — What page is found during our dir busting activities?**
admin.php

**Task 8 — What is the HTTP status code reported by Gobuster for the discovered page?**
200

**Submit Root Flag — Submit root flag**
`6483bee07c1c1d57f14e5b0717503c73`
