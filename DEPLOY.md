# Deploy Aplikasi Sertifikat ke Ubuntu Server via Tailscale

Panduan ini menjalankan aplikasi dengan Docker di Ubuntu Server dan membatasi akses ke IP Tailscale `100.66.177.8`.

## Ringkasan Keputusan

- Akses aplikasi: `http://100.66.177.8:8081`
- Port host: `8081`
- Port container: `3000`
- Data permanen: `/opt/aplikasi-sertifikat/data`
- Metadata sertifikat: `/opt/aplikasi-sertifikat/data/certificates.json`
- File PDF upload: `/opt/aplikasi-sertifikat/data/uploads`
- Auto start setelah restart server: aktif lewat `restart: unless-stopped`

## 1. Siapkan Tailscale untuk Istri

Di perangkat istri, install Tailscale lalu login ke tailnet yang sama dengan akun kamu atau undangan dari akun Tailscale kamu.

Setelah berhasil, perangkat istri bisa membuka aplikasi lewat browser:

```text
http://100.66.177.8:8081
```

## 2. Install Docker di Ubuntu Server

Jalankan di server:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

Supaya user kamu bisa menjalankan Docker tanpa `sudo`:

```bash
sudo usermod -aG docker $USER
```

Logout lalu login lagi ke SSH setelah menjalankan perintah di atas.

## 3. Upload Project ke Server

Contoh lokasi project:

```bash
sudo mkdir -p /opt/aplikasi-sertifikat
sudo chown -R $USER:$USER /opt/aplikasi-sertifikat
```

Upload isi repo ini ke:

```text
/opt/aplikasi-sertifikat/app
```

Kalau memakai Git:

```bash
cd /opt/aplikasi-sertifikat
git clone URL_REPOSITORY_KAMU app
cd app
```

## 4. Buat Folder Data Permanen

Jalankan:

```bash
sudo mkdir -p /opt/aplikasi-sertifikat/data/uploads
sudo chown -R 1000:1000 /opt/aplikasi-sertifikat/data
sudo chmod -R u+rwX,g+rwX /opt/aplikasi-sertifikat/data
```

## 5. Buat Konfigurasi Rahasia

Di folder project server:

```bash
cd /opt/aplikasi-sertifikat/app
cp .env.deploy.example .env
```

Edit `.env`:

```bash
nano .env
```

Isi minimal:

```env
TAILSCALE_IP=100.66.177.8
APP_PORT=8081
LOCAL_ADMIN_EMAIL=email-admin-istri@example.com
LOCAL_ADMIN_PASSWORD=password-yang-kuat
TOKEN_SECRET=hasil-openssl-rand
```

Buat `TOKEN_SECRET` dengan:

```bash
openssl rand -hex 32
```

## 6. Jalankan Aplikasi

```bash
cd /opt/aplikasi-sertifikat/app
docker compose up -d --build
```

Cek status:

```bash
docker compose ps
docker compose logs --tail=100 aplikasi-sertifikat
```

Buka dari perangkat yang sudah masuk Tailscale:

```text
http://100.66.177.8:8081
```

## 7. Update Aplikasi

Kalau project di server berasal dari Git:

```bash
cd /opt/aplikasi-sertifikat/app
git pull
docker compose up -d --build
```

Data di `/opt/aplikasi-sertifikat/data` tidak ikut terhapus saat container di-build ulang.

## 8. Backup Bulanan ke Komputer

Karena tujuan backup adalah komputer kamu, cara paling sederhana adalah menarik backup dari komputer memakai `scp`.

Di komputer kamu, jalankan:

```bash
scp -r USER_SERVER@100.66.177.8:/opt/aplikasi-sertifikat/data ./backup-aplikasi-sertifikat-$(date +%Y-%m)
```

Ganti `USER_SERVER` dengan username SSH server Ubuntu kamu.

Alternatif: buat arsip dulu di server:

```bash
cd /opt/aplikasi-sertifikat
tar -czf backup-aplikasi-sertifikat-$(date +%Y-%m).tar.gz data
```

Lalu ambil dari komputer:

```bash
scp USER_SERVER@100.66.177.8:/opt/aplikasi-sertifikat/backup-aplikasi-sertifikat-$(date +%Y-%m).tar.gz .
```

## 9. Perintah Operasional

Stop aplikasi:

```bash
cd /opt/aplikasi-sertifikat/app
docker compose down
```

Restart aplikasi:

```bash
cd /opt/aplikasi-sertifikat/app
docker compose restart
```

Lihat log:

```bash
cd /opt/aplikasi-sertifikat/app
docker compose logs -f aplikasi-sertifikat
```

## Catatan Keamanan

- Jangan gunakan password contoh.
- Jangan upload file `.env` ke GitHub.
- Karena data sensitif, akses lewat Tailscale saja dulu sudah pilihan yang aman.
- Jangan membuka port `8081` di router internet publik.
- Backup folder `/opt/aplikasi-sertifikat/data` minimal setiap bulan.
