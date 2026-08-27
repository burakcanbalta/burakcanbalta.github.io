## Nmap Taraması
İlk olarak nmap taraması ile başlıyorum

```
nmap -sS -A -p- -T5 10.129.228.37
```

<img width="530" height="221" alt="nmap" src="https://github.com/user-attachments/assets/5fba24a7-334b-4d80-8cc0-41705f1ad0ac" />


Tarama sonucu oldukça sade: tek açık port var, 873/tcp, ve üzerinde rsync servisi çalışıyor (protocol version 31). Diğer tüm portlar kapalı olduğu için buradaki tek saldırı yüzeyi rsync servisi. Bu servisin genelde dosya senkronizasyonu için kullanıldığını biliyorum, bazen de yanlış yapılandırıldığında kimlik doğrulama olmadan paylaşımlara (share) erişim izni verebiliyor. Bunu test etmeye karar verdim.

## Rsync Paylaşımlarını Listeleme

rsync'te modül/paylaşım listesini görmek için `--list-only` parametresini ve hedefin sonuna çift iki nokta (`::`) ekleyerek deniyorum:

```
rsync --list-only 10.129.228.37::
```

`public` isimli bir paylaşım var ve açıklamasında "Anonymous Share" yazıyor, yani kimlik doğrulaması olmadan erişilebilir gibi görünüyor. Bu paylaşımın içeriğini görmek için aynı komutu paylaşım adını da ekleyerek tekrar çalıştırdım:

```
rsync --list-only 10.129.228.37::public
```

<img width="453" height="145" alt="dosya" src="https://github.com/user-attachments/assets/95cae2db-be6b-4172-8566-f93edb5e8a6f" />


`flag.txt` isimli bir dosya doğrudan görünüyor. Herhangi bir kullanıcı adı/parola girmeden buraya kadar geldiğime göre paylaşım gerçekten anonim erişime açık.

## Flag Dosyasını İndirme

Dosyayı yerel makineme çekmek için:

```
rsync 10.129.228.37::public/flag.txt ./flag.txt
```

<img width="427" height="49" alt="indir" src="https://github.com/user-attachments/assets/639a70f6-0057-4e5e-ad68-9a9ebd2a6ec8" />


İndirme sorunsuz tamamlandı, ardından içeriğe baktım:

```
cat flag.txt
```

```
72eaf5344ebb84908ae543a719830519
```

<img width="293" height="64" alt="flag" src="https://github.com/user-attachments/assets/ee61a28e-4ba6-48cc-9109-e3edd8a40205" />


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
