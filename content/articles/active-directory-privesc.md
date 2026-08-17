## Giriş

Active Directory (AD) ortamları, kurumsal ağların omurgasını oluşturur ve bu yüzden red team operasyonlarında en sık hedeflenen alanlardan biridir. Bu yazıda sık karşılaşılan yetki yükseltme (privilege escalation) tekniklerini özetliyorum.

## 1. Kerberoasting

Service Principal Name (SPN) tanımlı hesapların Kerberos servis biletlerini talep edip, offline olarak kırmaya çalışma tekniğidir.

```bash
GetUserSPNs.py DOMAIN/user:password -dc-ip 10.10.10.10 -request
```

Elde edilen hash'ler `hashcat` ile kırılmaya çalışılır:

```bash
hashcat -m 13100 hashes.txt rockyou.txt
```

**Tespit:** Anormal TGS taleplerini ve RC4 şifreleme kullanan biletleri izleyin (Event ID 4769).

## 2. ACL Abuse

Yanlış yapılandırılmış Access Control List (ACL) izinleri (örn. `GenericAll`, `WriteDACL`) üzerinden kullanıcı veya bilgisayar nesnelerinin ele geçirilmesi.

```bash
bloodhound-python -u user -p pass -d domain.local -ns 10.10.10.10 -c All
```

BloodHound ile saldırı yollarını görselleştirip en kısa yolu bulabilirsiniz.

## 3. GPO Abuse

Group Policy Object'lere yazma izni olan bir kullanıcı, hedef bilgisayarlarda kod çalıştırabilir (örn. scheduled task enjeksiyonu).

## Genel Tespit ve Sertleştirme Önerileri

- Tiering modeli (Tier 0/1/2) uygulayın.
- LAPS ile yerel yönetici parolalarını rotasyona sokun.
- Kerberoasting'e karşı servis hesaplarında güçlü, rastgele parolalar / gMSA kullanın.
- BloodHound'u savunma tarafında da düzenli çalıştırıp saldırı yollarını kapatın.

## Kapanış

AD privesc teknikleri sürekli evriliyor; düzenli attack path review ve minimum yetki prensibi en etkili savunma katmanlarından biri.
