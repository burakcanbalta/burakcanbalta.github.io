# HackTheBox — Ignition Writeup

**Zorluk:** Very Easy
**İşletim Sistemi:** Linux
**Hedef IP:** 10.129.1.27

---

## 1. Keşif (Reconnaissance)

Her zamanki gibi işe kapsamlı bir Nmap taramasıyla başlıyorum:

```bash
nmap -sS -A -p- -T5 10.129.1.27
```

**Çıktı:**

```
PORT   STATE SERVICE VERSION
80/tcp open  http    nginx 1.14.2
|_http-title: Did not follow redirect to http://ignition.htb/
|_http-server-header: nginx/1.14.2
Device type: general purpose|router
Running: Linux 5.X, MikroTik RouterOS 7.X
OS CPE: cpe:/o:linux:linux_kernel:5 cpe:/o:mikrotik:routeros:7 cpe:/o:linux:linux_kernel:5.6.3
OS details: Linux 5.0 - 5.14, MikroTik RouterOS 7.2 - 7.5 (Linux 5.6.3)
```

Taramada tek bir port karşıma çıkıyor: **80/tcp (HTTP)**, üzerinde **nginx 1.14.2** çalışıyor. Nmap'in çıktısında dikkat çeken önemli bir detay var:

```
Did not follow redirect to http://ignition.htb/
```

Yani sunucu, IP adresi üzerinden gelen istekleri `ignition.htb` isimli bir **virtual host (sanal sunucu)** adına yönlendirmeye çalışıyor ama Nmap bu yönlendirmeyi takip etmiyor. Bu, klasik bir **name-based virtual hosting** yapılandırması; sunucuya doğru erişebilmek için önce bu domaini çözümleyebilmem gerekiyor.

Tarayıcıdan doğrudan `http://10.129.1.27/` adresine gittiğimde ise 3 haneli bir **HTTP 301 (Moved Permanently)** durum kodu ile karşılaşıyorum — sunucu beni `http://ignition.htb/` adresine yönlendirmeye çalışıyor ancak bu domain benim makinemde henüz tanımlı olmadığı için tarayıcı adresi çözemiyor.

---

## 2. Sanal Host'un Tanımlanması

Bu sorunu çözmek için Linux'ta yerel alan adı çözümlemesi için kullanılan `/etc/hosts` dosyasına hedefin IP-domain eşleşmesini ekliyorum:

```bash
echo "10.129.1.27 ignition.htb" | sudo tee -a /etc/hosts
```

Dosyanın içeriği şu şekilde olmalı:

```
10.129.1.27 ignition.htb
```

Artık tarayıcıdan `http://ignition.htb` adresine gidebiliyorum ve site düzgün bir şekilde yükleniyor.

---

## 3. Web Sitesinin İncelenmesi

Siteye göz attığımda ilk bakışta pek fazla bir şey göze çarpmıyor — basit bir e-ticaret ön yüzü gibi görünüyor, gizli fonksiyonellik veya bariz bir input alanı yok. Bu noktada klasik **dizin/dosya brute-force** tekniğine başvuruyorum.

```bash
ffuf -u http://ignition.htb//FUZZ -w /usr/share/wordlists/dirb/common.txt
```

**Sonuç:**

```
admin                   [Status: 200, Size: 7095, Words: 1551, Lines: 149, Duration: 9259ms]
```

`http://ignition.htb/admin` adresinde bir giriş paneli buluyorum. Sayfanın görünümünden ve URL yapısından bunun bir **Magento admin login sayfası** olduğunu anlıyorum.

---

## 4. Kimlik Doğrulama — Zayıf Parola ile Erişim

Magento admin paneline karşı doğrudan bir SQLi veya exploit denemeden önce, göreve verilen ipucuna uyarak biraz araştırma yapıyorum: Magento'nun parola politikası ve 2023 yılının en yaygın kullanılan parolaları.

Kısa bir aramanın ardından şu kaynağa ulaşıyorum:

> https://community.spiceworks.com/t/most-common-passwords-of-2023-the-top-10/963430

Listelenen en yaygın 10 parola şunlar:

```
1. 123456
2. 123456789
3. qwerty
4. password
5. 12345
6. qwerty123
7. 1q2w3e
8. 12345678
9. 111111
10. 1234567890
```

Magento admin panelinin varsayılan kullanıcı adı genellikle `admin` olduğu için, bu listedeki parolaları sırasıyla `admin` kullanıcı adıyla deniyorum. Liste kısa olduğu için manuel deneme bile hızlı sonuç veriyor.

**Başarılı kombinasyon:**

```
Kullanıcı adı: admin
Parola:        qwerty123
```

Bu, Magento'nun minimum parola karmaşıklığı gereksinimini (en az 7 karakter, en az bir harf ve bir rakam) teknik olarak karşıladığı için politika tarafından reddedilmemiş, ama yine de son derece zayıf ve tahmin edilebilir bir parola — klasik bir **weak credentials** zafiyeti.

---

## 5. Panel Erişimi ve Flag

`admin:qwerty123` bilgileriyle giriş yaptığımda doğrudan Magento admin paneline erişim sağlıyorum. Panelin ana sayfasında/dashboard'unda flag doğrudan karşımıza çıkıyor:

```
Congratulations, your flag is: 797d6c988d9dc5865e010b9410f247e0
```

Flag başarıyla elde edildi. 🎉

---

## 6. Özet — Atak Zinciri

1. Nmap taramasıyla yalnızca 80/tcp (nginx 1.14.2) portunun açık olduğu ve sunucunun `ignition.htb` domainine yönlendirme yaptığı tespit edildi.
2. `/etc/hosts` dosyasına IP-domain eşleşmesi eklenerek sanal host'a erişim sağlandı.
3. `ffuf` ile yapılan dizin taramasında `/admin` altında bir **Magento** giriş paneli keşfedildi.
4. Magento'nun parola politikası ve 2023'ün en popüler parolaları araştırıldı.
5. `admin:qwerty123` kimlik bilgileriyle giriş denemesi başarılı oldu.
6. Panelde bulunan flag doğrudan okundu.

---

## 7. Görev Soruları ve Cevapları

**Görev 1 — 80 numaralı portta hangi servis sürümünün çalıştığı tespit edildi?**
nginx 1.14.2

**Görev 2 — http://{makine IP adresi}/ adresini ziyaret ettiğinizde döndürülen 3 haneli HTTP durum kodu nedir?**
301

**Görev 3 — Web sayfasının hangi sanal sunucu adı ile erişilmesi bekleniyor?**
ignition.htb

**Görev 4 — Linux bilgisayarda alan adı ile IP adresi çiftlerinin yerel listesini içeren dosyanın tam yolu nedir?**
`/etc/hosts`

**Görev 5 — Web sunucusundaki dizinlere kaba kuvvet yöntemiyle erişmek için bir araç kullanın. Magento giriş sayfasının tam URL'si nedir?**
`http://ignition.htb/admin`

**Görev 6 — Magento için parola gereksinimlerini araştırın ve ayrıca 2023'ün en yaygın parolalarını da aramayı deneyin. Hangi parola yönetici hesabına erişim sağlar?**
qwerty123

**Tek Bayrak Gönder — Web sayfasında bulunan bayrağı gönderin.**
`797d6c988d9dc5865e010b9410f247e0`

---

*Not: Bu writeup eğitim/CTF amaçlıdır. Tüm işlemler yalnızca HackTheBox'ın izin verdiği laboratuvar ortamında gerçekleştirilmiştir.*
