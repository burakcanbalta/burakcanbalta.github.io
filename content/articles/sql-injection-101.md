## Giriş

SQL Injection (SQLi), bir uygulamanın kullanıcıdan aldığı girdiyi doğrudan SQL sorgusuna eklemesi sonucu ortaya çıkan, hâlâ OWASP Top 10 listesinde yer alan klasik ama tehlikeli bir zafiyet sınıfıdır. Bu yazıda temel mantığı, tespit yöntemlerini ve önleme stratejilerini ele alıyorum.

> Not: Bu içerik yalnızca eğitim amaçlıdır. Yalnızca izin verilen (authorized) ortamlarda test yapın.

## Zafiyetin Mantığı

Aşağıdaki gibi bir sorgu düşünelim:

```sql
SELECT * FROM users WHERE username = '$input' AND password = '$pass'
```

Eğer `$input` değeri doğrulanmadan sorguya ekleniyorsa, bir saldırgan şu girdiyi kullanabilir:

```
' OR '1'='1
```

Sonuç sorgu şu hale gelir:

```sql
SELECT * FROM users WHERE username = '' OR '1'='1' AND password = ''
```

Bu, `WHERE` koşulunu her zaman doğru yaparak kimlik doğrulamayı atlatabilir.

## Tespit Teknikleri

| Teknik | Açıklama |
|---|---|
| Error-based | Veritabanı hata mesajlarından bilgi sızdırma |
| Union-based | `UNION SELECT` ile ek veri çekme |
| Blind (boolean) | Doğru/yanlış davranış farkına göre çıkarım |
| Time-based | `SLEEP()` gibi fonksiyonlarla gecikme ölçümü |

## Önleme

- **Parametreli sorgular (prepared statements)** kullanın — asla string concatenation yapmayın.
- Girdi doğrulama (allow-list) uygulayın.
- En az yetki prensibiyle veritabanı kullanıcıları tanımlayın.
- WAF katmanını ek savunma olarak kullanın, tek başına yeterli görmeyin.

## Kapanış

SQLi hâlâ gerçek dünyada en çok karşılaşılan zafiyetlerden biri. Kod inceleme süreçlerine parametreli sorgu kontrolünü eklemek, çoğu vakayı en baştan engeller.
