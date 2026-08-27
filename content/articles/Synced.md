# HTB - Synced Box Writeup

**Hedef:** 10.129.228.37
**Tarih:** 27.08.2026

## Nmap Taraması

```
nmap -sS -A -p- -T5 10.129.228.37
```

```
PORT    STATE SERVICE VERSION
873/tcp open  rsync   (protocol version 31)
Device type: general purpose
Running: Linux 5.X
OS CPE: cpe:/o:linux:linux_kernel:5
OS details: Linux 5.0 - 5.14
Network Distance: 2 hops
```

Tarama sonucu oldukça sade: tek açık port var, 873/tcp, ve üzerinde rsync servisi çalışıyor (protocol version 31). Diğer tüm portlar kapalı olduğu için buradaki tek saldırı yüzeyi rsync servisi. Bu servisin genelde dosya senkronizasyonu için kullanıldığını biliyorum, bazen de yanlış yapılandırıldığında kimlik doğrulama olmadan paylaşımlara (share) erişim izni verebiliyor. Bunu test etmeye karar verdim.

## Rsync Paylaşımlarını Listeleme

rsync'te modül/paylaşım listesini görmek için `--list-only` parametresini ve hedefin sonuna çift iki nokta (`::`) ekleyerek deniyorum:

```
rsync --list-only 10.129.228.37::
```

Çıktı:

```
public          Anonymous Share
```

`public` isimli bir paylaşım var ve açıklamasında "Anonymous Share" yazıyor, yani kimlik doğrulaması olmadan erişilebilir gibi görünüyor. Bu paylaşımın içeriğini görmek için aynı komutu paylaşım adını da ekleyerek tekrar çalıştırdım:

```
rsync --list-only 10.129.228.37::public
```

```
drwxr-xr-x          4,096 2022/10/24 18:02:23 .
-rw-r--r--             33 2022/10/24 17:32:03 flag.txt
```

`flag.txt` isimli bir dosya doğrudan görünüyor. Herhangi bir kullanıcı adı/parola girmeden buraya kadar geldiğime göre paylaşım gerçekten anonim erişime açık.

## Flag Dosyasını İndirme

Dosyayı yerel makineme çekmek için:

```
rsync 10.129.228.37::public/flag.txt ./flag.txt
```

İndirme sorunsuz tamamlandı, ardından içeriğe baktım:

```
cat flag.txt
```

```
72eaf5344ebb84908ae543a719830519
```

## Sonuç

Synced box'ı, rsync servisinin yanlış yapılandırıldığında ne kadar basit bir bilgi ifşasına yol açabileceğini gösteren güzel bir örnek. Herhangi bir exploit, parola kırma veya karmaşık bir teknik gerekmedi — servis zaten anonim erişime izin verdiği için doğrudan dosya listeleme ve indirme yapılabildi.

Gerçek bir ortamda böyle bir bulguyu raporlarken şunları vurgulardım:

- rsync daemon'ları (`rsyncd.conf`) üzerinde anonim erişime izin veren paylaşımlar, özellikle hassas veri içeriyorsa asla açık bırakılmamalı
- Modül bazında `auth users` ve `secrets file` direktifleriyle kimlik doğrulama zorunlu kılınmalı
- Servis mümkünse doğrudan internete açılmamalı, erişim IP bazlı kısıtlanmalı (`hosts allow` / firewall)
- Paylaşılan dizinlerde hassas dosya bulundurulmamalı; gerekiyorsa şifrelenmiş şekilde tutulmalı

---

## Görev Soruları ve Cevapları

**Task 1 — What is the default port for rsync?**
873

**Task 2 — How many TCP ports are open on the remote host?**
1

**Task 3 — What is the protocol version used by rsync on the remote machine?**
31

**Task 4 — What is the most common command name on Linux to interact with rsync?**
`rsync`

**Task 5 — What credentials do you have to pass to rsync in order to use anonymous authentication?**
None

**Task 6 — What is the option to only list shares and files on rsync? (no leading -- characters)**
list-only

**Submit Single Flag — Submit the flag located on the share.**
`72eaf5344ebb84908ae543a719830519`
