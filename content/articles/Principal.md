## Giriş

Principal, ilk bakışta klasik bir web login sayfasıyla karşılıyor ama işin özü aslında kimlik doğrulama mantığındaki bir tasarım hatasında gizli. Makine boyunca iki kez aynı temayla karşılaşıyoruz: sistem, gelen verinin *şifrelenmiş/imzalı olup olmadığını* kontrol ediyor ama içindeki *kimlik iddiasının doğru olup olmadığını* hiç sorgulamıyor. Bu mantık hatası hem web tarafındaki JWT doğrulamasında hem de sunucudaki SSH sertifika yapılandırmasında karşımıza çıkıyor. Aşağıda adım adım nasıl root olduğumu anlatıyorum.

---

## 1. Keşif

İlk iş her zaman olduğu gibi tam port taraması:

```bash
nmap -sS -A -T4 -Pn -p- 10.129.79.220
```
<img width="858" height="546" alt="nmap" src="https://github.com/user-attachments/assets/98876e42-8f11-4889-8265-a09846bac228" />

Sadece 2 port açık: SSH ve üzerinde bir Jetty web servisi çalışan 8080. En dikkat çekici detay `X-Powered-By: pac4j-jwt/6.0.3` header'ı — bunu not ediyorum, ileride işime yarayacak.

---

## 2. Web Uygulamasını Keşfetme

<img width="953" height="813" alt="login" src="https://github.com/user-attachments/assets/9ef20555-9810-483a-98e6-e7bf55028c0a" />

`http://10.129.79.220:8080/login` adresine gittiğimde beni bir giriş ekranı karşılıyor.

Önce klasik bir refleksle SQLi bypass denedim ama dönen hata mesajlarından bir şey çıkmayacağını anladım. Bunun yerine sayfanın kaynak koduna bakmaya karar verdim. Kaynak kodda iki önemli yol dikkatimi çekti:

- `/reset-password`
- `/static/js/app.js`

`app.js` dosyasını inceleyince uygulamanın kullandığı API endpoint'lerini gördüm:

<img width="758" height="595" alt="app js" src="https://github.com/user-attachments/assets/03ddf2f4-7ffe-4111-b8c4-9d59112cc498" />

Bu endpoint'lerden ilk olarak JWKS (JSON Web Key Set) uç noktasını kontrol ettim:

```
http://10.129.79.220:8080/api/auth/jwks
```

<img width="1919" height="174" alt="jwks" src="https://github.com/user-attachments/assets/2015ce60-1421-4911-a787-46df719ca0d1" />

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

<img width="987" height="552" alt="exploitpy" src="https://github.com/user-attachments/assets/1aef1ffc-ac3a-43aa-a907-9a6a68e0ca3b" />


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

<img width="711" height="298" alt="şifre" src="https://github.com/user-attachments/assets/f1944bf6-a22c-43ea-8a40-9ed7cda25cb5" />

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
<img width="717" height="355" alt="ssh1" src="https://github.com/user-attachments/assets/1c525954-9317-4ee6-bdb4-9c681f78645b" />

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

<img width="607" height="290" alt="ssh2" src="https://github.com/user-attachments/assets/58f1d136-ef1d-4f89-8af6-4595f12df550" />

<img width="607" height="290" alt="ssh2" src="https://github.com/user-attachments/assets/4a85605c-5b90-4299-835b-51ab9d29b57f" />

---

## 7. Root Flag

```bash
cat /root/root.txt
```

```
root.txt: 49ebb99ec7f2fc42176f5d90e6ebb47e
```
