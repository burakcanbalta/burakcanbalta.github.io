## 🎯 Hedef Tanımlama ve Ping Taramaları

| Komut | Açıklama |
|-------|----------|
| `-iL` | IP listesi kullanarak tarama |
| `--exclude` | Belirli IP veya IP aralıklarını taramadan çıkarma |
| `-Pn` | Ping atmadan tarama (host up varsayılır) |
| `-sP` | Sadece ping taraması (host discovery) |
| `-PA`, `-PU`, `-PY`, `-PE`, `-PR` | Farklı ping teknikleri: TCP ACK, UDP, SCTP INIT, ICMP Echo, ARP |
| `--traceroute` | Hedefe giden yolu görselleştirme |
| `-R` | Ters DNS çözümlemesi |

## 🔍 Tarama Teknikleri

| Komut | Açıklama |
|-------|----------|
| `-sS` | TCP SYN (yarı açık) tarama |
| `-sT` | TCP Connect taraması (root gerekmez) |
| `-sU` | UDP taraması |
| `-sN`, `-sF`, `-sA` | Güvenlik duvarını kandırmak için TCP bayrak varyasyonları |
| `-sO` | IP protokol taraması |
| `-sV` | Servis sürüm bilgisi bulma |
| `-sV --version-trace` | Servis taramasında detaylı bilgi elde etme |
| `-sR` | RPC hizmetleri taraması |
| `-O` | İşletim sistemi tanımlama |
| `--osscan-guess`, `--fuzzy` | Belirsiz OS tahminlerini etkinleştirme |

## 🚀 Performans Ayarları

| Komut | Açıklama |
|-------|----------|
| `-T0` ~ `-T5` | Zamanlama ayarları (T0 en yavaş, T5 en hızlı) |
| `--min-parallelism`, `--min-hostgroup` | Paralel iş parçacığı ve host grup sayısı |
| `--max-retries`, `--host-timeout` | Maksimum tekrar ve zaman aşımı süresi |
| `--min-rate` | Saniyede minimum paket gönderimi |
| `--randomize-hosts` | Tarama sırasını rastgeleleştirme |

## 🧱 Firewall Atlatma Teknikleri

| Komut | Açıklama |
|-------|----------|
| `-f` | Paketleri parçalara ayırarak gönderme |
| `--mtu 16` | MTU ayarıyla dikkat dağıtma |
| `-D RND:10` | 10 farklı decoy (yem) adresiyle tarama |
| `-sI` | Idle/zombi scan (gizli tarama) |
| `--source-port`, `-g` | Kaynak port spoofing |
| `--data-length 25` | Rastgele veri ekleyerek gönderim |
| `--spoof-mac` | MAC adres spoofing |
| `--badsum` | Hatalı sağlama ile firewall test etme |

## 📤 Çıktı Alma

| Komut | Açıklama |
|-------|----------|
| `-oN`, `-oX`, `-oG`, `-oA`, `-oS` | Normal, XML, Grepable, Tüm formatlar, 1337 stil |
| `--stats-every 5s` | Tarama ilerleme durumunu gösterir |
| `--packet-trace` | Paket detaylarını gösterir |

## 🧰 Ekstra Araçlar & Betikler

| Komut | Açıklama |
|-------|----------|
| `--script whois-domain.nse` | Domain bilgilerini gösterir |
| `--script whois-ip.nse` | IP whois bilgisi |
| `--script vuln` | Hedefteki zafiyetleri tarar |

---

## 🧪 Faydalı Nmap Komutu

```bash
sudo nmap -sS -sV -O -Pn --script vuln <hedef_ip>
```
