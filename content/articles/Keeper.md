<img width="1200" height="909" alt="1_IY_ujNqJvy0TU5fXXgAU6A" src="https://github.com/user-attachments/assets/1c4822e0-b0b3-47b6-b4ef-6073405c1f4b" />

#### About

Keeper is an easy-difficulty Linux machine that features a support ticketing system that uses default credentials. Enumerating the service, we are able to see clear text credentials that lead to SSH access. With `SSH` access, we can gain access to a KeePass database dump file, which we can leverage to retrieve the master password. With access to the `Keepass` database, we can access the root `SSH` keys, which are used to gain a privileged shell on the host.


## 1. Genel Bakış

Keeper, HTB'nin "easy" seviye Linux kutularından biri. Zafiyet zinciri üç adımdan oluşuyor:

1. Bir **Request Tracker (RT)** destek biletleme sisteminde varsayılan kimlik bilgileriyle admin paneline giriş.
2. Panelde açık şekilde görünen bir kullanıcı hesabının SSH parolasıyla ilk erişim (foothold).
3. Ele geçirilen bir KeePass memory dump dosyasından, **CVE-2023-32784** zafiyeti kullanılarak master parolanın kurtarılması ve veritabanı içinde saklanan root SSH private key'i ile root'a yükselme.

Kısacası: **varsayılan credential → SSH foothold → KeePass memory dump zafiyeti → sızdırılmış private key → root**.


## 2. Keşif

Her zamanki gibi kapsamlı bir nmap taramasıyla başladım, tüm portları tarayıp servis/versiyon tespiti ve varsayılan scriptleri de dahil ettim:

```
nmap -sS -A -T5 -p- 10.129.229.41
```

<img width="676" height="395" alt="nmap" src="https://github.com/user-attachments/assets/7bd1b5ed-9384-48bd-83d5-29e70a6a4fdb" />


## 3. Web Sitesine İlk Bakış ve Yönlendirme

<img width="546" height="171" alt="site1" src="https://github.com/user-attachments/assets/d9a0d86b-5c90-49dc-a2ce-8b5668a590b8" />

ana sayfa  beni **`tickets.keeper.htb`** adında ayrı bir subdomain'e yönlendiriyordu. **`/etc/hosts`** dosyama bu subdomain'i hedef IP'ye eşleyen bir satır ekledim:

```
10.129.229.41   tickets.keeper.htb
```

<img width="546" height="171" alt="site1" src="https://github.com/user-attachments/assets/0cd16f8f-13b2-430a-8542-199fc8b9ac07" />


## 4. Request Tracker (RT) — Varsayılan Kimlik Bilgileri Arayışı


<img width="471" height="214" alt="site2" src="https://github.com/user-attachments/assets/580e2c5f-7cb3-4e4e-8461-8c391c91775b" />

Login ekranını gördüğümde önce bunun hangi yazılım olduğunu netleştirmek istedim, çünkü hangi ürün olduğunu bilirsem bilinen zafiyetlerini ya da varsayılan kimlik bilgilerini arayabilirim. Bunun için isteği `curl -v` ile detaylı şekilde attım:

```
curl -v http://tickets.keeper.htb/rt/
```

<img width="813" height="462" alt="curl" src="https://github.com/user-attachments/assets/2cf9293d-23c7-4255-a8e1-751c7d7deb23" />

Response header'larına baktığımda `Set-Cookie: RT_SID_tickets.keeper.htb.80=...` satırını gördüm. `RT_SID` cookie ismi bana doğrudan **Request Tracker (RT)** yazılımını işaret ediyordu

<img width="323" height="93" alt="site3" src="https://github.com/user-attachments/assets/f31e02c6-147b-4838-a0f9-617b42adf8f8" />

Ürünü tanıdıktan sonra ilk aklıma gelen şey **varsayılan kimlik bilgileri** oldu, google ile kısa bir araştırma sonucunda:

<img width="729" height="275" alt="defaultcredentials" src="https://github.com/user-attachments/assets/0340561e-ac5b-42f6-9b9e-bd8b8c16907e" />

Bu bilgiyle login ekranına geri döndüm ve giriş denedim

<img width="1283" height="735" alt="login" src="https://github.com/user-attachments/assets/032aec7f-d515-439d-bd49-1082cee01fa8" />


## 5. Panel İçi Enumerasyon — Sızmış Kullanıcı Parolası

Admin paneline girdikten sonra amacım daha fazla bilgi toplamaktı — kullanıcı listesi, açık ticket'lar, yapılandırma kayıtları gibi. Panelde gezinirken kullanıcı yönetim ekranına gittim ve URL'yi manuel olarak değiştirerek farklı kullanıcı ID'lerini incelemeye başladım:

```
http://tickets.keeper.htb/rt/Admin/Users/Modify.html?id=27
```

Bu sayfada `lnorgaard` adlı bir kullanıcının kaydını buldum. Sayfanın üst kısmında sistemin kendi ürettiği bir bilgilendirme notu vardı:

<img width="346" height="595" alt="sshşifre" src="https://github.com/user-attachments/assets/b333aae9-2bb0-480d-a64c-b460d3470932" />


## 6. SSH ile İlk Erişim (Foothold)

Elimde artık bir kullanıcı adı (`lnorgaard`) ve muhtemel bir parola (`Welcome2023!`) vardı. Nmap taramasında SSH'nin açık olduğunu zaten görmüştüm, o yüzden doğrudan bu bilgilerle SSH bağlantısı denedim:

```
ssh lnorgaard@10.129.229.41
```

Parola sorulduğunda `Welcome2023!` girdim ve bağlantı başarılı oldu:

<img width="480" height="84" alt="userflag" src="https://github.com/user-attachments/assets/b7fa02b8-130e-484b-ab1f-8641051bf2fe" />


İlk flag (`user.txt`) elde edildi. Aynı dizinde dikkatimi çeken başka bir dosya daha vardı: **`RT30000.zip`**. İsimlendirmesinden (`RT` öneki) bunun eski bir Request Tracker ticket'ına ait.

Bu dosyayı analiz edebilmek için kendi Kali makineme çektim:

```
scp lnorgaard@keeper.htb:/home/lnorgaard/RT30000.zip .
```

<img width="1158" height="206" alt="scp" src="https://github.com/user-attachments/assets/c68e90a1-9a23-4046-9eb3-08b3f4fd46e5" />

Arşivi açtığımda (`unzip`) içinden iki dosya çıktı:

```
KeePassDumpFull.dmp
passcodes.kdbx
```

`.kdbx` uzantısını hemen tanıdım — bu, **KeePass** şifre yöneticisinin veritabanı dosya formatı. `.dmp` uzantısı ise bana bir **process memory dump** (çalışan bir uygulamanın bellek görüntüsü) olduğunu düşündürdü; isminden (`KeePassDumpFull`) muhtemelen KeePass uygulamasının kendisinin çalışırken alınmış bir bellek dökümü olduğu belliydi.

Bu noktada elimde iki dosya vardı ama `.kdbx` dosyasını açabilmek için bir **master parolaya** ihtiyacım vardı, ki bu parolayı bilmiyordum. Ancak elimdeki `.dmp` dosyası tam olarak bu ihtiyacı karşılayabilirdi — çünkü KeePass'in geçmişte master parola girişiyle ilgili bilinen bir bellek güvenliği zafiyeti var.

---

## 7. Zafiyet Analizi — CVE-2023-32784 (KeePass Master Password Bellek Sızıntısı)

### 7.1 Arka Plan

CVE-2023-32784, KeePass 2.x serisinde (2.54'ten önceki sürümlerde) bulunan bir bellek güvenliği zafiyetidir. Sorun, KeePass'in kendi arayüzünde master parola girişi için kullandığı özel bir metin kutusu bileşeninde (`SecureTextBoxEx`) ortaya çıkıyor.

KeePass, kullanıcı arayüzünde şifreyi ekranda "●●●●●" şeklinde gizli göstermek için .NET'in standart `TextBox` kontrolünü değil, kendi özelleştirdiği bir bileşeni kullanır. Ancak bu bileşenin iç implementasyonu, kullanıcı her karakter yazdığında/sildiğinde .NET'in çalışma zamanında (managed heap üzerinde) **karakterlerin eski kopyalarını tam olarak temizlemiyordu**. Yani parola ekranda görünmese de, uygulamanın kullandığı bellek alanında parolanın büyük kısmının "hayalet" kopyaları kalıyordu.

### 7.2 Neden Sadece İlk Karakter Eksik?

Zafiyetin ilginç bir detayı var: bellek dump'ından parolanın **son karakteri hariç hemen hemen tamamı** çıkarılabiliyor, ama **ilk karakter kayboluyor**. Bunun sebebi, `SecureTextBoxEx` bileşeninin dahili olarak her yeni karakter girildiğinde metni yeniden oluşturma (rebuild) mantığı — bu süreçte ilk karakterin bellekteki izi diğerlerinden farklı şekilde üzerine yazılıyor ve kurtarılamıyor. Bu yüzden araç bize "ilk karakter bilinmiyor, ama olası adaylar şunlar" diyerek bir liste sunuyor, geri kalan karakterleri ise büyük ölçüde kesin olarak veriyor.

### 7.3 Pratikte İstismar

Bu zafiyeti istismar eden hazır bir araç var: [vdohney/keepass-password-dumper](https://github.com/vdohney/keepass-password-dumper). Aracı Kali'ma indirdim, derledim ve elimdeki `.dmp` dosyasını verdim:

```
dotnet run -- KeePassDumpFull.dmp
```

Çıktı, her karakter pozisyonu için olası adayları listeledi:

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

İlk karakter belirsizdi, ikinci karakter için birkaç aday vardı, ama geri kalan tüm karakterler nettti. `dgrød med fløde` kısmı bana Danca bir tatlı adına (**rødgrød med fløde**) çok benziyor geldi — bu bağlamsal ipucuyla ilk iki karakteri tamamladığımda parolanın şu olması gerektiğini düşündüm:

```
rødgrød med fløde
```

<img width="625" height="385" alt="şifre" src="https://github.com/user-attachments/assets/c9d74078-0d07-448b-9cec-d6bd7b652e0b" />


Bu tahminle veritabanını açmayı denedim:

```
keepassxc passcodes.kdbx
```

## 8. KeePass Veritabanı İçeriği — PuTTY Private Key (.ppk) Sızıntısı

Veritabanına eriştikten sonra içindeki kayıtları incelemeye başladım. Bir kayıtta root'a ait olduğu belirtilen bir şifre gördüm: `F4><3K0nd!`. Bu şifreyle SSH üzerinden `root` kullanıcısı olarak bağlanmayı denedim ama bağlantı reddedildi

**Notes**  alanında uzun bir metin bloğu var. Bu blok bana tanıdık geldi:

<img width="965" height="872" alt="passcode" src="https://github.com/user-attachments/assets/a0857bc6-457c-4c15-b42d-6aee2bb70e4e" />

### 8.1 PPK Formatı Nedir ve Neden Burada Bir Risk Var?

`.ppk` (PuTTY Private Key), Windows dünyasında yaygın kullanılan **PuTTY** SSH istemcisinin kendi özel private key formatıdır. OpenSSH dünyasının standart PEM/OpenSSH formatlarından farklı bir yapıya sahiptir — Windows kullanıcıları genelde OpenSSH ile üretilen `id_rsa` gibi anahtarları `puttygen` aracıyla `.ppk` formatına çevirip PuTTY/WinSCP gibi araçlarda kullanır.

Formatın kendisinde bir "zafiyet" yok; PPK v3 (bu writeup'taki format), önceki PPK v2'ye göre parola türetme fonksiyonunu Argon2'ye yükselterek aslında **daha güvenli** hale getirilmiş bir versiyondur (bu değişiklik 2021'de PuTTY 0.75 ile geldi, çünkü PPK v2'nin kullandığı eski anahtar türetme fonksiyonu modern brute-force saldırılarına karşı yetersiz kalıyordu).

**Buradaki gerçek sorun format değil, saklama şekli:** Bu writeup'taki key `Encryption: none` ile, yani **şifrelenmemiş** olarak bir KeePass notu içine düz metin şeklinde yapıştırılmış. Normalde bir private key ya disk üzerinde parola korumalı tutulur ya da hiç KeePass gibi bir "notes" alanına gömülmez — KeePass'in asıl amacı yapılandırılmış credential (kullanıcı adı/şifre/URL) saklamaktır, keyfi metin notları için tasarlanmış olsa da bir private key'in ham haliyle burada durması, veritabanına erişen herkesin doğrudan root'un SSH anahtarını ele geçirmesi anlamına geliyor. Yani bu bir **hatalı credential/secret yönetimi** pratiği — teknik bir CVE değil, operasyonel bir güvenlik zafiyeti.

### 8.2 Anahtarı Kullanılabilir Hale Getirme

Bu notu olduğu gibi kopyaladım ve `keeper.ppk` adıyla bir dosyaya kaydettim. Ancak makinemdeki `ssh` istemcisi (OpenSSH) doğrudan `.ppk` formatını okuyamıyor — bu format sadece PuTTY ailesi araçlarınca native olarak destekleniyor. Bu yüzden `puttygen` aracıyla anahtarı OpenSSH formatına çevirdim:

```
puttygen keeper.ppk -O private-openssh-new -o keeper
chmod 600 keeper
```

Bu komut, PPK v3 içindeki public/private key verisini alıp standart OpenSSH private key formatına (PEM benzeri) dönüştürüyor — artık bu dosyayı normal bir `id_rsa` gibi `ssh -i` ile kullanabiliyorum. `chmod 600` ise SSH'nin private key dosyaları için zorunlu kıldığı izin kuralı (dosya sadece sahibi tarafından okunabilir/yazılabilir olmalı, aksi halde SSH dosyayı "izinler çok açık" diyerek reddeder).

---

## 9. Root Flag

Elimde artık kullanılabilir bir private key vardı. Bunu kullanarak `root` olarak SSH bağlantısı denedim:

```
ssh -i keeper root@10.129.229.41
```

Bağlantı **başarılı** oldu:

```
Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.15.0-78-generic x86_64)
...
root@keeper:~#
```

Ev dizinine baktım:

```
root@keeper:~# ls
root.txt  RT30000.zip  SQL
root@keeper:~# cat root.txt
514c3e8c1aeadeb7611ac1e8991082e9
```

<img width="940" height="533" alt="rootflag" src="https://github.com/user-attachments/assets/faf2e275-4949-4e5e-96ef-b264b2dbade8" />
