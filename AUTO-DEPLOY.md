# Auto Deploy GitHub ke Server via Tailscale

File ini menjelaskan setup auto-sync untuk repo:

```text
https://github.com/jordysalamur96-hue/Aplikasi-sertifikat.git
```

Target server:

```text
jordy@100.66.177.8
```

Target folder aplikasi di server, sesuai `DEPLOY.md` repo ini:

```text
/opt/aplikasi-sertifikat/app
```

Setelah setup selesai, setiap `push` ke branch `main` akan:

1. menjalankan test di GitHub Actions,
2. masuk ke jaringan Tailscale,
3. SSH ke server,
4. menjalankan `deploy.sh`,
5. `git pull`,
6. `docker compose up -d --build`,
7. cek website `http://100.66.177.8:8081/`.

## 1. Pastikan server sudah punya repo

Login ke server:

```bash
ssh jordy@100.66.177.8
```

Cek folder aplikasi:

```bash
cd /opt/aplikasi-sertifikat/app
git remote -v
git branch --show-current
```

Kalau folder belum ada, jalankan:

```bash
sudo mkdir -p /opt/aplikasi-sertifikat
sudo chown -R jordy:jordy /opt/aplikasi-sertifikat
cd /opt/aplikasi-sertifikat
git clone https://github.com/jordysalamur96-hue/Aplikasi-sertifikat.git app
cd app
cp .env.deploy.example .env
nano .env
```

Pastikan `.env` berisi nilai asli:

```env
TAILSCALE_IP=100.66.177.8
APP_PORT=8081
LOCAL_ADMIN_EMAIL=...
LOCAL_ADMIN_PASSWORD=...
TOKEN_SECRET=...
```

Buat `TOKEN_SECRET` dengan:

```bash
openssl rand -hex 32
```

## 2. Jalankan deploy manual sekali

Di server:

```bash
cd /opt/aplikasi-sertifikat/app
chmod +x deploy.sh
./deploy.sh
```

Jangan lanjut auto deploy sebelum deploy manual berhasil.

## 3. Buat SSH key khusus GitHub Actions

Di server atau laptop:

```bash
ssh-keygen -t ed25519 -C "github-actions-aplikasi-sertifikat" -f github-actions-aplikasi-sertifikat
```

Tambahkan public key ke server user `jordy`:

```bash
mkdir -p ~/.ssh
cat github-actions-aplikasi-sertifikat.pub >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

Simpan isi private key `github-actions-aplikasi-sertifikat` ke GitHub Secret:

```text
SERVER_SSH_KEY
```

## 4. Buat Tailscale OAuth Client

Di admin Tailscale:

1. Buka Settings/Admin Console Tailscale.
2. Buat OAuth client untuk GitHub Actions.
3. Gunakan tag misalnya:

```text
tag:ci
```

Masukkan credential ke GitHub Secrets:

```text
TS_OAUTH_CLIENT_ID
TS_OAUTH_SECRET
```

Pastikan ACL Tailscale mengizinkan device bertag `tag:ci` mengakses server `100.66.177.8:22`.

## 5. Isi GitHub Secrets

Di GitHub repo:

```text
Settings > Secrets and variables > Actions > New repository secret
```

Isi:

```text
SERVER_HOST=100.66.177.8
SERVER_USER=jordy
SERVER_SSH_KEY=<isi private key deploy>
TS_OAUTH_CLIENT_ID=<client id Tailscale>
TS_OAUTH_SECRET=<secret Tailscale>
```

## 6. Push file workflow

Pastikan file ini sudah ada di repo:

```text
.github/workflows/deploy.yml
deploy.sh
```

Lalu push:

```bash
git add deploy.sh .github/workflows/deploy.yml AUTO-DEPLOY.md
git commit -m "ci: add automatic deployment via Tailscale"
git push origin main
```

## 7. Verifikasi

Cek tab GitHub:

```text
Actions > Deploy aplikasi-sertifikat
```

Jika sukses, website tetap bisa dibuka di:

```text
http://100.66.177.8:8081/
```

Cek server:

```bash
docker ps --filter name=aplikasi-sertifikat
```

## Catatan penting

- Jangan commit `.env`.
- Data PDF dan metadata aman karena volume Docker memakai:

```text
/opt/aplikasi-sertifikat/data:/app/data
```

- Folder penting untuk backup:

```text
/opt/aplikasi-sertifikat/data
```
