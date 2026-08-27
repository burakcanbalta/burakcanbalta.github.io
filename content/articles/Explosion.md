## Nmap Taraması

İlk olarak nmap taraması atıyoruz

```
nmap -sS -A -p- -T5 10.129.1.13
```

<img width="844" height="365" alt="nmap" src="https://github.com/user-attachments/assets/049e468b-1ef9-48d0-ad64-1bdf0816b10d" />

135, 139, 445 klasik Windows üçlüsü, yani karşımda bir Windows makine olduğu belli. Beni asıl ilgilendiren 3389/tcp — `ms-wbt-server`, yani RDP. `rdp-ntlm-info` sayesinde makine adının **EXPLOSION** olduğunu ve Windows Server 2019 (build 17763) çalıştığını da öğrenmiş oldum, bunu not aldım çünkü ileride işime yarayabilir.

5985 ve 47001 WinRM'e işaret ediyor ama şu an için RDP daha kestirme bir yol gibi göründüğü için oradan devam etme kararı aldım.

## RDP Bağlantısı Denemesi

RDP açık olduğuna göre klasik bir deneme yapmadan geçemezdim: bazen sistemlerde yönetici hesabı parolasız bırakılmış oluyor, özellikle test/lab ortamlarında bu sık karşılaşılan bir hata. Denemeye değerdi.

```
xfreerdp3 /v:10.129.1.13 /u:administrator /cert:ignore
```

- `/v:` hedef IP
- `/u:` kullanıcı adı
- `/cert:ignore` sertifika uyarısını atlamak için (self-signed sertifika olduğu için Kali sürekli soruyor, bununla susturuyorum)

Parola sorulduğunda hiçbir şey yazmadan enter'a bastım. Ve inanmayacaksınız ama bağlandı. `administrator` hesabının parolası boştu.

Bu tarz bir açık gerçek ortamda pek görülmez ama var olduğu yerlerde de bilgisayar korsanları için en kısa yoldur. Elle deneme yapmasaydım muhtemelen bu kadar kolay atlatabileceğimi fark etmezdim.

<img width="479" height="43" alt="rdp" src="https://github.com/user-attachments/assets/6d1fa11f-f921-49b1-a3cb-f7fcac21245d" />

## Flag'i Bulma

Masaüstüne bağlandığımda ilk gördüğüm şey `flag` isimli bir metin belgesiydi. Notepad ile açtım:

```
951fa96d7830c451b536be5a6be008a0
```

<img width="1028" height="469" alt="flag" src="https://github.com/user-attachments/assets/6d4b6745-1666-44ba-a4c3-195d1129f190" />

## Görev Soruları ve Cevapları

**Görev 1 — Üç harfli RDP kısaltması ne anlama geliyor?**
Remote Desktop Protocol

**Görev 2 — Komut satırı arayüzü aracılığıyla sunucuyla etkileşimi ifade eden 3 harfli kısaltma nedir?**
CLI (Command Line Interface)

**Görev 3 — Grafiksel kullanıcı arayüzü etkileşimleri hakkında ne düşünüyorsunuz?**
GUI (Graphical User Interface)

**Görev 4 — Varsayılan olarak şifreleme içermeyen ve TCP 23 numaralı bağlantı noktasında dinleme yapan eski bir uzaktan erişim aracının adı nedir?**
Telnet

**Görev 5 — 3389 TCP portunda çalışan servisin adı nedir?**
RDP (ms-wbt-server / Terminal Services)

**Görev 6 — xfreerdp kullanılırken hedef sunucunun IP adresini belirtmek için hangi anahtar kullanılır?**
`/v:`

**Task 7 — What username successfully returns a desktop projection to us with a blank password?**
administrator

**Submit Single Flag — Submit the flag located on the administrator's desktop.**
`951fa96d7830c451b536be5a6be008a0`
