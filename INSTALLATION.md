# Panduan Lengkap Pemasangan & Konfigurasi GelombangMaya
### (Community Edition & Internal Enterprise Edition)

Dokumen ini menyediakan panduan langkah demi langkah yang lengkap untuk memasang, mengkonfigurasi pangkalan data (MySQL/MariaDB), menjalankan server SIEM GelombangMaya, dan mengaktifkan ejen telemetri keselamatan di pelbagai sistem operasi.

---

## 📋 Isi Kandungan

1. [Keperluan Sistem (Prerequisites)](#1-keperluan-sistem-prerequisites)
2. [Pemasangan & Konfigurasi Pangkalan Data (MySQL / MariaDB)](#2-pemasangan--konfigurasi-pangkalan-data-mysql--mariadb)
   * [Arch Linux / CachyOS / Manjaro](#a-arch-linux--cachyos--manjaro)
   * [Ubuntu / Debian / Kali Linux / Parrot OS](#b-ubuntu--debian--kali-linux--parrot-os)
   * [RHEL / Fedora / Rocky Linux / AlmaLinux](#c-rhel--fedora--rocky-linux--almalinux)
   * [Docker / Docker Compose (Kaedah Paling Pantas)](#d-docker--docker-compose-kaedah-paling-pantas)
3. [Cipta Pangkalan Data & Akaun Pengguna (SQL 1-Liner)](#3-cipta-pangkalan-data--akaun-pengguna-sql-1-liner)
4. [Pemasangan Server SIEM GelombangMaya](#4-pemasangan-server-siem-gelombangmaya)
   * [Konfigurasi Fail `.env`](#konfigurasi-fail-env)
   * [Mod Pembangunan (Development Mode)](#mod-pembangunan-development-mode)
   * [Mod Pengeluaran (Production Build)](#mod-pengeluaran-production-build)
5. [Pemasangan Ejen Telemetri Endpoint (`gm-forwarder.py`)](#5-pemasangan-ejen-telemetri-endpoint-gm-forwarderpy)
   * [Jalankan Secara Standalone](#a-jalankan-secara-standalone-terminal)
   * [Pasang Sebagai Servis Latar Belakang 24/7 (Systemd Daemon)](#b-pasang-sebagai-servis-latar-belakang-247-systemd-daemon)
6. [Integrasi Rangkaian Syslog UDP (Port 1514)](#6-integrasi-rangkaian-syslog-udp-port-1514)
7. [Panduan Penyelesaian Masalah (Troubleshooting FAQ)](#7-panduan-penyelesaian-masalah-troubleshooting-faq)

---

## 1. Keperluan Sistem (Prerequisites)

* **Node.js:** Versi `v20.0.0` atau terkini (`node -v`)
* **NPM:** Versi `v10.0.0` atau terkini (`npm -v`)
* **Python:** Versi `3.8+` (Hanya Standard Library — **tiada `pip install` diperlukan**)
* **Pangkalan Data:** MariaDB `10.5+` ATAU MySQL `8.0+` ATAU Docker Engine

---

## 2. Pemasangan & Konfigurasi Pangkalan Data (MySQL / MariaDB)

Pangkalan data relational diperlukan untuk menyimpan rekod acara telemetri (`events`), amaran ancaman (`alerts`), senarai indikator (`iocs`), maklumat nod (`agents`), dan peraturan pengesanan (`rules`).

Pilih arahan pemasangan mengikut sistem operasi anda:

### A. Arch Linux / CachyOS / Manjaro
```bash
# 1. Pasang pakej MariaDB
sudo pacman -S --noconfirm mariadb

# 2. Inisialisasi direktori data kali pertama
sudo mariadb-install-db --user=mysql --basedir=/usr --datadir=/var/lib/mysql

# 3. Hidupkan servis MariaDB
sudo systemctl enable --now mariadb
```

### B. Ubuntu / Debian / Kali Linux / Parrot OS
```bash
# 1. Pasang MariaDB Server
sudo apt update && sudo apt install -y mariadb-server

# 2. Hidupkan servis MariaDB
sudo systemctl enable --now mariadb
```

### C. RHEL / Fedora / Rocky Linux / AlmaLinux
```bash
# 1. Pasang MariaDB Server
sudo dnf install -y mariadb-server

# 2. Hidupkan servis MariaDB
sudo systemctl enable --now mariadb
```

### D. Docker / Docker Compose (Kaedah Paling Pantas)
Jika anda menggunakan Docker, anda **tidak perlu memasang MySQL secara manual pada OS**. Jalankan terus:
```bash
docker compose up -d
```
Container MariaDB dan server GelombangMaya akan dimulakan secara automatik!

---

## 3. Cipta Pangkalan Data & Akaun Pengguna (SQL 1-Liner)

Selepas servis MariaDB/MySQL berjalan, laksanakan arahan SQL ini di terminal untuk mencipta pangkalan data dan memberi kebenaran akses kepada GelombangMaya:

```bash
sudo mysql -e "CREATE DATABASE IF NOT EXISTS gelombang_maya; CREATE USER IF NOT EXISTS 'gelombangmaya'@'localhost' IDENTIFIED BY 'secretpassword'; CREATE USER IF NOT EXISTS 'gelombangmaya'@'127.0.0.1' IDENTIFIED BY 'secretpassword'; GRANT ALL PRIVILEGES ON gelombang_maya.* TO 'gelombangmaya'@'localhost'; GRANT ALL PRIVILEGES ON gelombang_maya.* TO 'gelombangmaya'@'127.0.0.1'; FLUSH PRIVILEGES;"
```

> **Nota Keselamatan:** Dalam persekitaran produksi korporat, gantikan `secretpassword` dengan kata laluan rawak yang kukuh.

---

## 4. Pemasangan Server SIEM GelombangMaya

### Konfigurasi Fail `.env`
Di dalam folder utama projek, cipta fail `.env` (atau salin daripada `.env.example`):

```bash
cp .env.example .env
```

Pastikan tetapan dalam fail `.env` sepadan dengan pangkalan data anda:

```env
PORT=3000
DATABASE_URL="mysql://gelombangmaya:secretpassword@127.0.0.1:3306/gelombang_maya"
DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_USER="gelombangmaya"
DB_PASSWORD="secretpassword"
DB_NAME="gelombang_maya"
```

### Pasang Dependencies
```bash
npm install
```

### Mod Pembangunan (Development Mode)
Untuk menjalankan server bagi tujuan pembangunan dan ujian langsung:
```bash
npm run dev
```
Buka pelayar web anda di: **`http://localhost:3000`**

### Mod Pengeluaran (Production Build)
Untuk membinakan pakej produksi yang dioptimumkan:
```bash
# 1. Bina bundle frontend & backend
npm run build

# 2. Jalankan perkhidmatan produksi
npm start
```

---

## 5. Pemasangan Ejen Telemetri Endpoint (`gm-forwarder.py`)

Ejen `gm-forwarder.py` berfungsi mengutip log sistem secara masa nyata (*real-time*) dan menghantarnya ke server GelombangMaya untuk analisis heuristik.

Ejen ini menyokong pengesanan automatik (*auto-adaptation*):
* **Linux moden (systemd):** Membaca terus daripada `journalctl` (termasuk proses `sshd-session`).
* **Linux klasik & BSD:** Menjejak fail log fizikal (`/var/log/auth.log`, `/var/log/secure`).
* **macOS & Windows:** Menjejak fail log yang ditentukan.

### A. Jalankan Secara Standalone (Terminal)
```bash
sudo python3 scripts/gm-forwarder.py --server http://localhost:3000
```

### B. Pasang Sebagai Servis Latar Belakang 24/7 (Systemd Daemon)
Untuk memastikan ejen berjalan secara kekal di latar belakang server:

```bash
sudo python3 scripts/gm-forwarder.py --server http://localhost:3000 --install-service
```

Untuk menyemak status servis:
```bash
# Semak status servis
sudo systemctl status gm-forwarder

# Lihat log siaran langsung ejen
sudo journalctl -u gm-forwarder -f
```

---

## 6. Integrasi Rangkaian Syslog UDP (Port 1514)

Server GelombangMaya dilengkapi penerima log standard **RFC 3164 / RFC 5424 UDP Syslog** pada port `1514`. 

Anda boleh menghalakan log daripada pelbagai peranti rangkaian tanpa perlu memasang sebarang perisian tambahan:

### Contoh Konfigurasi Router & Firewall:
* **MikroTik RouterOS:**
  ```routeros
  /system logging action add name=gelombangmaya target=remote remote=192.168.1.100 remote-port=1514 src-address=0.0.0.0
  /system logging add action=gelombangmaya topics=account,critical,error,warning
  ```
* **pfSense / OPNsense Firewall:**
  1. Pergi ke **Status** > **System Logs** > **Settings**.
  2. Tandakan **Enable Remote Logging**.
  3. Masukkan IP Server GelombangMaya dan port **`1514`**.
* **Linux rsyslog (`/etc/rsyslog.d/99-gelombangmaya.conf`):**
  ```text
  *.* @127.0.0.1:1514
  ```

---

## 7. Panduan Penyelesaian Masalah (Troubleshooting FAQ)

### Q1: Keluar ralat `ER_ACCESS_DENIED_NO_PASSWORD_ERROR: Access denied for user 'root'@'localhost'`
* **Sebab:** MariaDB secara lalai menyekat pengguna `root` daripada menyambung melalui TCP tanpa kata laluan.
* **Penyelesaian:** Jalankan arahan SQL di [Bahagian 3](#3-cipta-pangkalan-data--akaun-pengguna-sql-1-liner) untuk mencipta pengguna `gelombangmaya` dan pastikan fail `.env` mengandungi `DATABASE_URL="mysql://gelombangmaya:secretpassword@127.0.0.1:3306/gelombang_maya"`.

### Q2: Keluar ralat `ECONNREFUSED 127.0.0.1:3306`
* **Sebab:** Servis MariaDB atau MySQL belum dihidupkan pada port 3306.
* **Penyelesaian:** Jalankan `sudo systemctl enable --now mariadb` (atau `mysql`).

### Q3: Serangan Hydra SSH tidak dikesan atau keluar ralat `drop connection penalty`
* **Sebab:** OpenSSH 9.8+ mempunyai ciri keselamatan `PerSourcePenalties` yang menyekat IP jika diserang terlalu laju.
* **Penyelesaian:** Gunakan parameter concurrency `-t 1 -W 1` semasa ujian serangan:
  ```bash
  hydra -l lazarus -P /tmp/pass100.txt ssh://127.0.0.1 -t 1 -W 1 -V
  ```

### Q4: Bagaimana cara membersihkan data ujian dan rekod lama?
* **Penyelesaian:** Tekan butang **`RESET DATA`** berwarna merah di sudut kanan atas bar status papan pemuka web untuk mengosongkan log dan amaran lama secara 1-klik.

---

> **GelombangMaya Security Operations Platform**  
> *Autonomous Threat Telemetry & SecOps Defense*
