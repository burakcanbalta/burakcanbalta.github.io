## 1. Keşif

Her zamanki gibi işe kapsamlı bir Nmap taramasıyla başlıyorum:

```bash
nmap -sS -A -p- -T5 10.129.1.27
```

<img width="767" height="248" alt="nmap" src="https://github.com/user-attachments/assets/990d0069-b2bb-4d32-9743-09fc14dbc0ea" />

Taramada tek bir port karşıma çıkıyor: **80/tcp (HTTP)**, üzerinde **nginx 1.14.2** çalışıyor. Nmap'in çıktısında bir detay var:

```
Did not follow redirect to http://ignition.htb/
```

Yani sunucu, IP adresi üzerinden gelen istekleri `ignition.htb` isimli bir **virtual host (sanal sunucu)** adına yönlendirmeye çalışıyor ama Nmap bu yönlendirmeyi takip etmiyor. Bu, klasik bir **name-based virtual hosting** yapılandırması; sunucuya doğru erişebilmek için önce bu domaini çözümleyebilmem gerekiyor.

Tarayıcıdan doğrudan `http://10.129.1.27/` adresine gittiğimde ise 3 haneli bir **HTTP 302** durum kodu ile karşılaşıyorum — sunucu beni `http://ignition.htb/` adresine yönlendirmeye çalışıyor ancak bu domain benim makinemde henüz tanımlı olmadığı için tarayıcı adresi çözemiyor.

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

Siteye göz attığımda ilk bakışta pek fazla bir şey göze çarpmıyor. Bu noktada klasik **dizin/dosya brute-force** tekniğine başvuruyorum.

```bash
ffuf -u http://ignition.htb//FUZZ -w /usr/share/wordlists/dirb/common.txt
```

<img width="763" height="581" alt="ffuf" src="https://github.com/user-attachments/assets/c4ac2e92-8d1a-43a4-8330-9f0e06bb2bf0" />


`http://ignition.htb/admin` adresinde bir giriş paneli buluyorum. Sayfanın görünümünden ve URL yapısından bunun bir **Magento admin login sayfası** olduğunu anlıyorum.

---

<img width="449" height="549" alt="adminlogin" src="https://github.com/user-attachments/assets/eae46f24-7cff-48eb-b60a-c2dc34a8186c" />

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

## 5. Panel Erişimi ve Flag

`admin:qwerty123` bilgileriyle giriş yaptığımda doğrudan Magento admin paneline erişim sağlıyorum. Panelin ana sayfasında/dashboard'unda flag doğrudan karşımıza çıkıyor:

```
Congratulations, your flag is: 797d6c988d9dc5865e010b9410f247e0
```

<img width="1150" height="425" alt="flag" src="https://github.com/user-attachments/assets/ff43ae32-fd8a-40af-ac92-1659ab6f8c78" />

Flag başarıyla elde edildi. 🎉

---

## 7. Görev Soruları ve Cevapları

**Görev 1 — 80 numaralı portta hangi servis sürümünün çalıştığı tespit edildi?**
`nginx 1.14.2`

**Görev 2 — http://{makine IP adresi}/ adresini ziyaret ettiğinizde döndürülen 3 haneli HTTP durum kodu nedir?**
`302`

**Görev 3 — Web sayfasının hangi sanal sunucu adı ile erişilmesi bekleniyor?**
`ignition.htb`

**Görev 4 — Linux bilgisayarda alan adı ile IP adresi çiftlerinin yerel listesini içeren dosyanın tam yolu nedir?**
`/etc/hosts`

**Görev 5 — Web sunucusundaki dizinlere kaba kuvvet yöntemiyle erişmek için bir araç kullanın. Magento giriş sayfasının tam URL'si nedir?**
`http://ignition.htb/admin`

**Görev 6 — Magento için parola gereksinimlerini araştırın ve ayrıca 2023'ün en yaygın parolalarını da aramayı deneyin. Hangi parola yönetici hesabına erişim sağlar?**
`qwerty123`

**Tek Bayrak Gönder — Web sayfasında bulunan bayrağı gönderin.**
`797d6c988d9dc5865e010b9410f247e0`
