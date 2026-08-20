Bu odada elimizde DarkInjector adlı bir saldırganın kurduğu sahte bir Cmail giriş sayfası var. Amacımız bu phishing sitesinin arkasındaki altyapıyı inceleyip, varsa mağdur kullanıcıların bilgilerine ulaşmak.

## Siteye İlk Bakış

Verilen linke gidiyoruz:

<img width="1918" height="783" alt="site" src="https://github.com/user-attachments/assets/1916c930-a1bd-49a6-9831-56f7e1bb7999" />

Karşımıza klasik bir Cmail login sayfası çıkıyor. İlk yaptığım şey her zaman olduğu gibi sayfa kaynağına (view-source) bakmak oldu. Kaynak kodu incelerken bu satırı görüyoruz:

<img width="761" height="277" alt="kaynakod" src="https://github.com/user-attachments/assets/b085e2ec-17a5-4ac5-a98f-34b5e7d09770" />

```
Forgot your password? Reset it here (/reset-password)
```

Bu linke gittiğimde beklediğim gibi bir sayfa yerine S3'e özgü bir hata mesajıyla karşılaştım:

<img width="1020" height="369" alt="reset" src="https://github.com/user-attachments/assets/31f5d2c8-4f13-4710-b040-369b7586b33a" />


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
<img width="513" height="86" alt="aws" src="https://github.com/user-attachments/assets/6d7473ba-58c2-45d0-98c1-c3572e26ec9c" />

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

<img width="447" height="128" alt="captured" src="https://github.com/user-attachments/assets/5cda314d-7867-49b8-991d-2c93e9047416" />

```
THM{this_is_not_what_i_meant_by_public}
```
