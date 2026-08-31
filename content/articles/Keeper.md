# HTB Keeper — Writeup

**Zorluk:** Easy
**OS:** Linux (Ubuntu 22.04)
**Hedef IP:** 10.129.229.41

---

#### About

Keeper is an easy-difficulty Linux machine that features a support ticketing system that uses default credentials. Enumerating the service, we are able to see clear text credentials that lead to SSH access. With `SSH` access, we can gain access to a KeePass database dump file, which we can leverage to retrieve the master password. With access to the `Keepass` database, we can access the root `SSH` keys, which are used to gain a privileged shell on the host.

---

## 1. Genel Bakış

Keeper, HTB'nin "easy" seviye Linux kutularından biri. Zafiyet zinciri üç adımdan oluşuyor:

1. Bir **Request Tracker (RT)** destek biletleme sisteminde varsayılan kimlik bilgileriyle admin paneline giriş.
2. Panelde açık şekilde görünen bir kullanıcı hesabının SSH parolasıyla ilk erişim (foothold).
3. Ele geçirilen bir KeePass memory dump dosyasından, **CVE-2023-32784** zafiyeti kullanılarak master parolanın kurtarılması ve veritabanı içinde saklanan root SSH private key'i ile root'a yükselme.

Kısacası: **varsayılan credential → SSH foothold → KeePass memory dump zafiyeti → sızdırılmış private key → root**.

---

## 2. Keşif

```
nmap -sS -A -T5 -p- 10.129.229.41
```

| Port | Servis | Not |
|------|--------|-----|
| 22 | SSH (OpenSSH 8.9p1, Ubuntu) | |
| 80 | HTTP (nginx 1.18.0, Ubuntu) | Başlıksız boş bir sayfa |

Siteye gidince sayfa içeriği neredeyse boştu, tek bilgi şuydu:

> To raise an IT support ticket, please visit tickets.keeper.htb/rt/

Bu, bize yeni bir subdomain veriyor. `/etc/hosts` dosyama `tickets.keeper.htb` girdisini ekledim ve tekrar denedim.

---

## 3. Request Tracker (RT) — Varsayılan Kimlik Bilgileri

`http://tickets.keeper.htb/rt/` adresine gidince bir login ekranıyla karşılaştım. `curl -v` ile isteği incelediğimde response header'larında `RT_SID_...` cookie'sini ve genel yapıyı gördüm — bu **Request Tracker (RT)**, açık kaynaklı bir destek/ticket yönetim sistemi.

RT'nin bilinen varsayılan kimlik bilgilerini denedim:

```
Username: root
Password: password
```

Giriş başarılı oldu. Bu, klasik bir **varsayılan kimlik bilgisi (default credentials)** zafiyeti — kurulumdan sonra admin şifresinin değiştirilmemesi.

Panelde gezinirken kullanıcı yönetim sayfasına gittim:

```
http://tickets.keeper.htb/rt/Admin/Users/Modify.html?id=27
```

Bu sayfada yeni bir kullanıcı kaydı gördüm — `lnorgaard` adlı kullanıcı için:

> New user. Initial password set to `Welcome2023!`

Bu, RT admin panelinin kullanıcı oluşturma geçmişinde **düz metin (plaintext) olarak bırakılmış bir ilk parola** kaydı. Normalde bu bilgi audit/log amaçlı tutuluyor olabilir ama admin paneline erişimi olan biri için doğrudan bir credential sızıntısı.

---

## 4. SSH ile İlk Erişim

Bulduğum credential'ı SSH üzerinde denedim:

```
ssh lnorgaard@10.129.229.41
Password: Welcome2023!
```

Giriş başarılı oldu:

```
lnorgaard@keeper:~$ ls
RT30000.zip  user.txt
lnorgaard@keeper:~$ cat user.txt
b24b75503fa550b1978b83928535f0a9
```

İlk flag alındı. Ev dizininde `RT30000.zip` adlı, muhtemelen bir eski RT ticket'ından kalma bir arşiv dosyası vardı. Dosyayı kendi makineme çektim:

```
scp lnorgaard@keeper.htb:/home/lnorgaard/RT30000.zip .
```

Arşivi açtığımda içinden iki dosya çıktı:

```
KeePassDumpFull.dmp
passcodes.kdbx
```

`.kdbx` uzantısı **KeePass** şifre yöneticisinin veritabanı dosyası formatı. `.dmp` ise muhtemelen KeePass uygulamasının process'inden alınmış bir **memory dump** (bellek görüntüsü).

---

## 5. Zafiyet Analizi — CVE-2023-32784 (KeePass Master Password Bellek Sızıntısı)

### 5.1 Arka Plan

CVE-2023-32784, KeePass 2.x serisinde (2.54'ten önceki sürümlerde) bulunan bir bellek güvenliği zafiyetidir. Sorun, KeePass'in kendi arayüzünde master parola girişi için kullandığı özel bir metin kutusu bileşeninde (`SecureTextBoxEx`) ortaya çıkıyor.

KeePass, kullanıcı arayüzünde şifreyi ekranda "●●●●●" şeklinde gizli göstermek için .NET'in standart `TextBox` kontrolünü değil, kendi özelleştirdiği bir bileşeni kullanır. Ancak bu bileşenin iç implementasyonu, kullanıcı her karakter yazdığında/sildiğinde .NET'in çalışma zamanında (managed heap üzerinde) **karakterlerin eski kopyalarını tam olarak temizlemiyordu**. Yani parola ekranda görünmese de, uygulamanın kullandığı bellek alanında parolanın büyük kısmının "hayalet" kopyaları kalıyordu.

### 5.2 Neden Sadece İlk Karakter Eksik?

Zafiyetin ilginç bir detayı var: bellek dump'ından parolanın **son karakteri hariç hemen hemen tamamı** çıkarılabiliyor, ama **ilk karakter kayboluyor**. Bunun sebebi, `SecureTextBoxEx` bileşeninin dahili olarak her yeni karakter girildiğinde metni yeniden oluşturma (rebuild) mantığı — bu süreçte ilk karakterin bellekteki izi diğerlerinden farklı şekilde üzerine yazılıyor ve kurtarılamıyor. Bu yüzden araç bize "ilk karakter bilinmiyor, ama olası adaylar şunlar" diyerek bir liste sunuyor, geri kalan karakterleri ise büyük ölçüde kesin olarak veriyor.

### 5.3 Pratikte İstismar

Bu zafiyeti istismar eden hazır bir araç var: [vdohney/keepass-password-dumper](https://github.com/vdohney/keepass-password-dumper). Araç, verilen bir process memory dump dosyasını tarayıp bu "hayalet" karakter izlerini analiz ederek olası parolayı yeniden inşa ediyor.

```
dotnet run -- KeePassDumpFull.dmp
```

Çıktı, her karakter pozisyonu için olası adayları listeliyor:

```
1.: ●
2.: ø, Ï, ,, l, `, -, ', ], §, A, I, :, =, _, c, M
3.: d
4.: g
5.: r
6.: ø
7.: d
8.: [boşluk]
9.: m
10.: e
11.: d
12.: [boşluk]
13.: f
14.: l
15.: ø
16.: d
17.: e

Combined: ●{ø, Ï, ,, l, `, -, ', ], §, A, I, :, =, _, c, M}dgrød med fløde
```

İlk karakter belirsiz, ikinci karakter için birkaç aday var, geri kalanı ise net. `dgrød med fløde` kısmı Danca bir tatlının adına (rødgrød med fløde) çok benziyor — bu bağlamsal ipucuyla ilk iki karakteri tamamlayınca parola:

```
rødgrød med fløde
```

olarak ortaya çıkıyor. Bu parolayla veritabanını açtım:

```
keepassxc passcodes.kdbx
```

Master parola doğru çıktı ve veritabanının içine erişebildim.

---

## 6. KeePass Veritabanı İçeriği — PuTTY Private Key (.ppk) Sızıntısı

Veritabanı içinde bir root şifresi (`F4><3K0nd!`) buldum ama bu şifreyle doğrudan SSH bağlantısı başarısız oldu — muhtemelen SSH üzerinde parola girişi devre dışı bırakılmış ya da şifre farklı bir amaç için tutuluyor. Ancak bir kaydın **Notes** (notlar) alanında şu formatta bir metin vardı:

```
PuTTY-User-Key-File-3: ssh-rsa
Encryption: none
Comment: rsa-key-20230519
Public-Lines: 6
...
Private-Lines: 14
...
Private-MAC: ...
```

### 6.1 PPK Formatı Nedir ve Neden Burada Bir Risk Var?

`.ppk` (PuTTY Private Key), Windows dünyasında yaygın kullanılan **PuTTY** SSH istemcisinin kendi özel private key formatıdır. OpenSSH dünyasının standart PEM/OpenSSH formatlarından farklı bir yapıya sahiptir — Windows kullanıcıları genelde OpenSSH ile üretilen `id_rsa` gibi anahtarları `puttygen` aracıyla `.ppk` formatına çevirip PuTTY/WinSCP gibi araçlarda kullanır.

Formatın kendisinde bir "zafiyet" yok; PPK v3 (bu writeup'taki format), önceki PPK v2'ye göre parola türetme fonksiyonunu Argon2'ye yükselterek aslında **daha güvenli** hale getirilmiş bir versiyondur (bu değişiklik 2021'de PuTTY 0.75 ile geldi, çünkü PPK v2'nin kullandığı eski anahtar türetme fonksiyonu modern brute-force saldırılarına karşı yetersiz kalıyordu).

**Buradaki gerçek sorun format değil, saklama şekli:** Bu writeup'taki key `Encryption: none` ile, yani **şifrelenmemiş** olarak bir KeePass notu içine düz metin şeklinde yapıştırılmış. Normalde bir private key ya disk üzerinde parola korumalı tutulur ya da hiç KeePass gibi bir "notes" alanına gömülmez — KeePass'in asıl amacı yapılandırılmış credential (kullanıcı adı/şifre/URL) saklamaktır, keyfi metin notları için tasarlanmış olsa da bir private key'in ham haliyle burada durması, veritabanına erişen herkesin doğrudan root'un SSH anahtarını ele geçirmesi anlamına geliyor. Yani bu bir **hatalı credential/secret yönetimi** pratiği — teknik bir CVE değil, operasyonel bir güvenlik zafiyeti.

### 6.2 Anahtarı Kullanılabilir Hale Getirme

Bu notu `keeper.ppk` olarak kaydettim. Ancak makinemdeki `ssh` istemcisi (OpenSSH) doğrudan `.ppk` formatını okuyamıyor — bu format sadece PuTTY ailesi araçlarınca native olarak destekleniyor. Bu yüzden `puttygen` ile OpenSSH formatına çevirdim:

```
puttygen keeper.ppk -O private-openssh-new -o keeper
chmod 600 keeper
```

Bu komut, PPK v3 içindeki public/private key verisini alıp standart OpenSSH private key formatına (PEM benzeri) dönüştürüyor — artık bu dosyayı normal bir `id_rsa` gibi `ssh -i` ile kullanabiliyorum. `chmod 600` ise SSH'nin private key dosyaları için zorunlu kıldığı izin kuralı (dosya sadece sahibi tarafından okunabilir/yazılabilir olmalı, yoksa SSH dosyayı reddeder).

---

## 7. Root Flag

```
ssh -i keeper root@10.129.229.41
```

```
root@keeper:~# ls
root.txt  RT30000.zip  SQL
root@keeper:~# cat root.txt
514c3e8c1aeadeb7611ac1e8991082e9
```

Kutu tamamlandı.

---

## 8. Sonuç ve Kök Neden Analizi

| Bulgu | Kök Neden | Etki |
|-------|-----------|------|
| RT panelinde `root:password` | Varsayılan kimlik bilgilerinin kurulum sonrası değiştirilmemesi | Admin paneline yetkisiz erişim |
| Kullanıcı oluşturma geçmişinde plaintext ilk parola | RT'nin kullanıcı işlemlerini audit amacıyla düz metin loglaması, bu bilginin admin dışı erişime karşı korunmaması | SSH credential sızıntısı |
| CVE-2023-32784 (KeePass bellek sızıntısı) | KeePass 2.54 öncesi sürümlerde `SecureTextBoxEx` bileşeninin bellek temizleme hatası | Master parolanın process dump'ından kurtarılabilmesi |
| Şifrelenmemiş private key'in KeePass notunda saklanması | Hatalı secret yönetimi — anahtarın parola korumasız ve amacı dışı bir alanda tutulması | Veritabanına erişen herkesin root SSH anahtarını ele geçirmesi |

**Düzeltme önerileri (remediation):**

1. Her türlü yönetim panelinde (RT dahil) kurulum sonrası varsayılan kimlik bilgileri derhal değiştirilmeli.
2. Kullanıcı oluşturma/parola sıfırlama işlemlerinde geçici parolalar loglara veya panel geçmişine düz metin olarak yazılmamalı.
3. KeePass **2.54 veya üzeri** bir sürüme güncellenmeli — bu sürümde `SecureTextBoxEx` belleği doğru şekilde temizleyecek şekilde yamalandı.
4. Private key'ler asla şifrelenmemiş halde bir parola yöneticisinin "not" alanına gömülmemeli; anahtarlar kendi native şifreleme mekanizmalarıyla (passphrase korumalı) ve amacına uygun bir secret store'da (ör. HashiCorp Vault, dosya sistemi + katı izinler) saklanmalı.
5. Root için SSH key-based authentication kullanılıyorsa bile, anahtarın kendisi mutlaka bir passphrase ile korunmalı.

---

## 9. Zaman Çizelgesi (Timeline)

1. Nmap taraması → SSH ve HTTP tespiti
2. Web sitesinde `tickets.keeper.htb` subdomain ipucu bulundu, `/etc/hosts`'a eklendi
3. Request Tracker (RT) panelinde `root:password` varsayılan credential ile giriş
4. Kullanıcı yönetim sayfasında `lnorgaard` kullanıcısına ait plaintext ilk parola bulundu
5. SSH ile `lnorgaard` olarak giriş yapıldı, `user.txt` okundu
6. Ev dizinindeki `RT30000.zip` indirildi, içinden `.dmp` ve `.kdbx` dosyaları çıktı
7. `keepass-password-dumper` ile CVE-2023-32784 istismar edilerek KeePass master parolası kurtarıldı
8. Veritabanı açıldı, içinde root'a ait şifrelenmemiş bir PuTTY private key (.ppk) notu bulundu
9. `puttygen` ile anahtar OpenSSH formatına çevrildi
10. Root olarak SSH ile bağlanıldı, `root.txt` okunarak kutu tamamlandı

---

*Bu writeup eğitim ve kişisel referans amaçlıdır; HTB kullanım şartlarına uygun şekilde, yalnızca izinli/yasal lab ortamı olan Hack The Box üzerinde gerçekleştirilmiştir.*
