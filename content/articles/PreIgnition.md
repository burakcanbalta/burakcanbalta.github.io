## Nmap Taraması

```
nmap -sS -A -p- 10.129.184.20 -T5
```
<img width="251" height="41" alt="nmap" src="https://github.com/user-attachments/assets/dd88e631-814c-404a-be05-e253b840a837" />

## Dizin Taraması

Sayfada görünür bir şey olmadığına göre gizli dosya/dizinleri bulmak için brute-force denemesi yaptım. Ben bu iş için ffuf kullanmayı tercih ediyorum:

```
ffuf -u http://10.129.184.20/FUZZ -w /usr/share/wordlists/dirb/common.txt
```

Sonuç net çıktı:

```
admin.php [Status: 200, Size: 999, Words: 132, Lines: 32, Duration: 61ms]
```

`admin.php` diye bir sayfa var ve 200 dönüyor, yani erişilebilir. Bunu görünce direkt tarayıcıdan `/admin.php` adresine gittim.

<img width="655" height="368" alt="admin" src="https://github.com/user-attachments/assets/40b621db-c736-49f8-a7b6-a674d3d53d6d" />

## Giriş Sayfası ve Flag

Karşıma bir login formu çıktı. İlk aklıma gelen klasik zayıf kimlik bilgilerini denemek oldu — böyle basit boxlarda varsayılan bilgileri basit bırakırlar `admin:admin` ile giriş yaptım ve içeri girdim.

Giriş başarılı olur olmaz flag zaten ekranda karşıma çıktı, ekstra bir işlem yapmama gerek kalmadı.

<img width="637" height="108" alt="flag" src="https://github.com/user-attachments/assets/50c32969-ae53-4b3c-a238-3c455fd057f9" />

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
