<img width="925" height="622" alt="TOPOLOJİ" src="https://github.com/user-attachments/assets/d6a360ce-cead-4d9e-8f69-106278199f09" />

🛡️ Network Segmentation and Service Configuration Lab with pfSense (Windows, Kali, Ubuntu)

This document covers the setup of a virtual lab environment using pfSense, Windows, Kali Linux, and Ubuntu Server to implement network segmentation, configure DHCP, DNS, and FTP services, and apply firewall rules. Each step is documented with relevant screenshots for clarity.

🌐 pfSense Installation and Initial Configuration
🖥️ Installation Steps

Download the pfSense ISO image.
Launch the installation and complete the disk partitioning.

  <img width="871" height="771" alt="pfsense kurulum" src="https://github.com/user-attachments/assets/c6cd7f5b-a3c0-4018-8bf8-a2bb1741d512" />

 Important: Before rebooting, go to Devices > Optical Drives and unmount the ISO file. Otherwise, the installation process will restart.
 After a successful installation, you'll see the pfSense console interface.
  
  <img width="686" height="362" alt="3" src="https://github.com/user-attachments/assets/9dace262-0342-4237-9536-93a26b4d86b4" />
  
  Change the LAN IP address.
  Default pfSense LAN is typically set to 192.168.1.1, but you must adjust it according to your VirtualBox Host-Only Adapter subnet (e.g., 192.168.56.1) to gain web interface access.

  
  <img width="739" height="43" alt="Ekran görüntüsü 2025-07-16 124036" src="https://github.com/user-attachments/assets/14c42f67-67a1-40b5-8e12-f3d42d57851f" />
  
  <img width="606" height="292" alt="a" src="https://github.com/user-attachments/assets/41aa74f9-74b0-4d12-91c2-909b2960b1a9" />

  <img width="573" height="184" alt="b" src="https://github.com/user-attachments/assets/d7a01df5-5ce6-4228-85ee-58beb10b8d5b" />

  <img width="726" height="87" alt="c" src="https://github.com/user-attachments/assets/d7ab2c4f-bcd4-4111-8fec-38b3ae08b790" />

  <img width="728" height="71" alt="d" src="https://github.com/user-attachments/assets/cc7fd98b-5b6c-4d92-8e4a-f04025fc6617" />

---

🧱 LAN Segmentation & Topology Overview
Three additional VMs are installed:

🪟 Windows 10

🐱 Kali Linux

🐧 Ubuntu Server

Each VM is attached to a separate Host-Only Adapter for network segmentation.

<img width="1022" height="617" alt="vb host only 2 3 4" src="https://github.com/user-attachments/assets/b857fb29-113e-4b7c-8fc1-421ce52ce922" />

<img width="1041" height="568" alt="win0" src="https://github.com/user-attachments/assets/67bb2e2b-704b-40be-af4a-aacd0cde83cf" />

<img width="1047" height="558" alt="kali0" src="https://github.com/user-attachments/assets/79868d15-8bf1-4cd7-a4a9-b677a41ea3d1" />

<img width="848" height="492" alt="ubuntuvm" src="https://github.com/user-attachments/assets/91effd04-4bae-4cfc-a8d3-29fe1a2e9ce1" />

<img width="848" height="488" alt="ubuntuvm1" src="https://github.com/user-attachments/assets/ae45f16a-b921-4ace-b16d-39ae6ec0fdb2" />

<img width="862" height="492" alt="pfsense1" src="https://github.com/user-attachments/assets/b5e8d5fc-7b09-49c5-87f3-3d19825b1178" />

<img width="1027" height="582" alt="pfsense2" src="https://github.com/user-attachments/assets/e1de2df0-c690-4e8b-8444-366eef5677c8" />

<img width="1015" height="573" alt="pfsense3" src="https://github.com/user-attachments/assets/fa7c99ef-616e-4d03-a700-232bf0880041" />

<img width="1028" height="572" alt="pfsense4" src="https://github.com/user-attachments/assets/a2cf0325-5973-441b-86ae-cb8582ea2f4e" />

Start the pfSense VM and configure the newly added interfaces

<img width="717" height="390" alt="shell" src="https://github.com/user-attachments/assets/35dc8a0c-2c2f-4d6c-89f6-3429b8d081f3" />

🔌 VirtualBox Network Configuration
Navigate to File > Preferences > Network > Host-Only Networks

Create 3 new Host-Only Adapters (one per VM)

Assign each adapter to a pfSense OPT interface

Start the pfSense VM and configure the newly added interfaces

🌍 Interface Definitions

| Arayüz | Tanım  | IP Adresi       |
| ------ | ------ | --------------- |
| WAN    | NAT    | Otomatik (DHCP) |
| LAN    | HOST-ONLY |  10.10.10.1  |

* Access the pfSense web interface at https://10.10.10.1
* Default credentials: Username: admin, Password: pfsense.

<img width="1020" height="840" alt="ekran" src="https://github.com/user-attachments/assets/2e690c0e-43ae-4a49-ba9e-2501698f8d92" />

🧰 Ubuntu Server: DHCP, DNS, and FTP Configuration
🖥️ Set a Static IP (via Netplan)

```bash
sudo nano /etc/netplan/00-installer-config.yaml
```

Sample configuration (adjust interface name accordingly):

<img width="881" height="384" alt="statik 1" src="https://github.com/user-attachments/assets/fab49815-63dc-46ef-bc7e-2432d54d8884" />

❗You should replace enp0s8 with your own network graph name. Using the 'ip a' command:

```bash
sudo netplan apply
```

### 📍 Ubuntu IP: `30.30.30.101/24` (Statik)

🔄 Configure DHCP Server

```bash
sudo apt update
sudo apt install isc-dhcp-server
sudo nano /etc/dhcp/dhcpd.conf
```

Edit DHCP configuration:

<img width="972" height="560" alt="dhcp conf" src="https://github.com/user-attachments/assets/73fef553-e9d4-4eeb-ad73-55a9ad82e87d" />

Set interface in:

```bash
sudo nano /etc/default/isc-dhcp-server
```
We check the DHCP service distribution and enter the interface names.
INTERFACESv4="enp0s3"
And we restart the DHCP service:

```bash
sudo systemctl restart isc-dhcp-server
sudo systemctl status isc-dhcp-server
```

<img width="810" height="435" alt="dhcp status " src="https://github.com/user-attachments/assets/14834bc5-992d-4927-a65c-c5e66b0b3650" />


🌐 Configure DNS (BIND9)

```bash
sudo apt install bind9
```

```bash
sudo nano /etc/bind/named.conf.options
```

<img width="1025" height="711" alt="namedconf" src="https://github.com/user-attachments/assets/ae427c51-3f67-4f96-9ae1-16df8b7f3c10" />


Restart service:
  
```bash
sudo systemctl restart bind9
```

<img width="864" height="193" alt="bind9" src="https://github.com/user-attachments/assets/b1e78d67-9874-4b9c-ba7e-ae98a9bae61a" />


### 📁 FTP SERVER

```bash
sudo apt install vsftpd -y
sudo systemctl enable vsftpd
sudo adduser ftpuser (We create a username and password)
```

📄 Edit FTP configuration:

```bash
 sudo nano /etc/vsftpd.conf
```

<img width="1155" height="781" alt="vsftpset" src="https://github.com/user-attachments/assets/d73b6d1c-e36f-4954-a3f6-15e5a4d340d3" />


Restart the service:
`sudo systemctl restart vsftpd`


<img width="865" height="176" alt="vsftpd" src="https://github.com/user-attachments/assets/d50d4fea-461e-4591-b4d6-cf0b7e2abf33" />

* FTP access is defined for users.
  
 ``` bash
 ftp localhost 
```

<img width="1045" height="303" alt="FTPLOCAL" src="https://github.com/user-attachments/assets/97138512-f646-4676-9c60-48a9fc32068d" />


---

## 🔒 Firewall Rules and Access Controls

🔒 Firewall Rules and Access Controls

| Rule                    | Status |
| ------------------------| ------ |
| LAN1 → OPT1             | ❌  Block |
| OPT1 -> LAN1            | ❌  Block |
| OPT1 → FTP(30.30.30.101)| ❌  Block |
| LAN1 → FTP(30.30.30.101)| ✅ Allow  |
| All LANs → WAN          | ✅ Allow  |

✅ Only specific traffic is allowed to ensure segmented and secure communication.
DHCP will automatically provide the ability to run and maintain the external network!


***Client Systems

* 🪟 Windows: Connected to LAN1

<img width="1021" height="766" alt="windows" src="https://github.com/user-attachments/assets/c114b6ab-fde0-4bc0-861b-baab1f9c57bf" />


<img width="757" height="436" alt="win lan1 opt2" src="https://github.com/user-attachments/assets/016b650b-86af-49d8-8783-0868203a9b2a" />


* 🩻 Kali Linux: Connected to OPT1

<img width="795" height="669" alt="kali " src="https://github.com/user-attachments/assets/6d9d0a27-baa7-4486-9e20-3b166a7217e6" />


* 🐧 Ubuntu Server: Connected to OP2

<img width="731" height="294" alt="ubuntu" src="https://github.com/user-attachments/assets/96c67996-a12f-4143-a3ca-2394ca6932ae" />


# 🛡️ pfSense

<img width="1020" height="840" alt="ekran" src="https://github.com/user-attachments/assets/e3e2b62e-00b9-4cc4-a131-cff358d056d1" />

* LAN interface connects to the internet via WAN.

<img width="1017" height="722" alt="googlegidiyo" src="https://github.com/user-attachments/assets/e4d076ff-764f-4ea1-bab4-6c0927c2fc47" />

FIREWALL RULES :

<img width="974" height="669" alt="WAN" src="https://github.com/user-attachments/assets/3d08a413-6331-432c-b54a-6ce8a04d9af7" />

<img width="952" height="608" alt="lan1" src="https://github.com/user-attachments/assets/c7538c2c-dad7-4085-bd81-513d19cb2bce" />

<img width="964" height="589" alt="lan2" src="https://github.com/user-attachments/assets/a64f8abc-f5ca-48e8-9485-1b9ac533c43b" />

<img width="945" height="577" alt="lan3" src="https://github.com/user-attachments/assets/bb18b88c-1f4c-4979-8434-95533347b32b" />


SETTİNG DHCP RELAY: 

<img width="926" height="481" alt="dhcprelay" src="https://github.com/user-attachments/assets/117d6b9c-b7ef-4242-bfce-be4b7d3ebfc3" />

Set the target interface and specify the DHCP server IP (e.g., Ubuntu DHCP IP)


📚 References

https://www.networkreverse.com/2020/06/how-to-build-linux-router-with-ubuntu.html

https://medium.com/@sydasif78/setting-up-a-dhcp-server-on-ubuntu-a-guide-for-network-engineer-d620c5d7afb2

https://medium.com/@sydasif78/setting-up-a-dns-server-on-ubuntu-a-guide-for-network-engineer-8890e634aab3

https://medium.com/@haticeadiguzel/pfsense-4b9092e71ced

https://www.freecodecamp.org/news/setting-a-static-ip-in-ubuntu-linux-ip-address-tutorial/

https://medium.com/@akardev/dual-boot-ubuntu-22-04-lts-kurulumu-1217ed7bf2fe






