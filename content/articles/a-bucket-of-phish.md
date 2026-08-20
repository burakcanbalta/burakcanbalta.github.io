# A Bucket of Phish - Writeup

Bu odada elimizde DarkInjector adlı bir saldırganın kurduğu sahte bir Cmail giriş sayfası var. Amacımız bu phishing sitesinin arkasındaki altyapıyı inceleyip, varsa mağdur kullanıcıların bilgilerine ulaşmak.

## Siteye İlk Bakış

Verilen linke gidiyoruz:

```
http://darkinjector-phish.s3-website-us-west-2.amazonaws.com
```

Karşımıza klasik bir Cmail login sayfası çıkıyor. İlk yaptığım şey her zaman olduğu gibi sayfa kaynağına (view-source) bakmak oldu. Kaynak kodu incelerken dikkatimi şu satır çekti:

```
Forgot your password? Reset it here (/reset-password)
```

Bu linke gittiğimde beklediğim gibi bir sayfa yerine S3'e özgü bir hata mesajıyla karşılaştım:

```
404 Not Found
Code: NoSuchKey
Message: The specified key does not exist.
Key: reset-password
```

Bu hata mesajı çok değerli bir bilgi veriyor aslında: site normal bir web sunucusunda değil, doğrudan **Amazon S3 static website hosting** üzerinde barınıyor. URL'nin yapısına bakınca da bu zaten netleşiyor:

```
http://darkinjector-phish.s3-website-us-west-2.amazonaws.com
```

Bu formattan, bucket adının `darkinjector-phish` olduğunu çıkarabiliyoruz.

## Bucket'ı Kimlik Doğrulamasız Listeleme

S3 bucket'larında sık karşılaşılan bir yanlış yapılandırma, bucket'ın public olarak listelenebilir bırakılması. Bunu doğrulamak için AWS CLI ile kimlik doğrulama yapmadan (`--no-sign-request`) listeleme deniyorum:

```bash
aws s3 ls s3://darkinjector-phish --no-sign-request
```

Ve bingo, bucket gerçekten public listelenebiliyormuş:

```
2025-03-17 02:46:17        132 captured-logins-093582390
2025-03-17 02:25:33       2300 index.html
```

`index.html` zaten sitenin kendisi, ama `captured-logins-093582390` ismi kulağa oldukça ilgi çekici geliyor. DarkInjector muhtemelen phishing sayfasından yakaladığı bilgileri buraya düşürüyor.

## Dosyaları İndirme

İki objeyi de yine kimlik doğrulamasız şekilde indiriyorum:

```bash
aws s3 cp s3://darkinjector-phish/index.html . --no-sign-request
aws s3 cp s3://darkinjector-phish/captured-logins-093582390 . --no-sign-request
```

`captured-logins-093582390` dosyasını açtığımda içeride flag'i buluyorum:

```
THM{this_is_not_what_i_meant_by_public}
```

## Sonuç

Flag'in adı da aslında olayı özetliyor: "bu public olsun demek bunu kastetmemiştim". DarkInjector, phishing altyapısını S3 üzerinde barındırırken bucket permission'larını doğru yapılandırmayı unutmuş ve topladığı bilgileri (muhtemelen çaldığı kimlik bilgilerini) kimliksiz erişime açık bırakmış. Kendi ağına kendi düşmüş yani.

**Çıkarılacak ders:** S3 bucket policy ve ACL ayarlarını her zaman "least privilege" prensibiyle yapılandırmak gerekiyor. `aws s3 ls --no-sign-request` gibi basit bir komut bile, yanlış yapılandırılmış bir bucket'ın tüm içeriğini ifşa edebiliyor. Bu sadece saldırganlar için değil, kurumsal ortamlarda da sıkça karşılaşılan gerçek bir zafiyet türü.
