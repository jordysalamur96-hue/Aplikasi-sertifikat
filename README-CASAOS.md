# Deploy Aplikasi Sertifikat di CasaOS

Aplikasi ini sudah bisa berjalan sebagai aplikasi lokal di Mini PC/CasaOS tanpa Netlify, Supabase, atau Google Drive.

## Ringkasan

- Server: Node.js built-in HTTP server (`server.js`)
- Port default: `3000`
- Data metadata: `data/certificates.json`
- File PDF: `data/uploads/`
- Login lokal: dikonfigurasi lewat environment variable

## Jalankan lokal tanpa Docker

1. Salin konfigurasi contoh menjadi `.env`:

```bash
cp .env.example .env
```

2. Edit `.env`, terutama nilai berikut:

```bash
LOCAL_ADMIN_EMAIL=admin@example.com
LOCAL_ADMIN_PASSWORD='ganti-password-ini'
TOKEN_SECRET='isi-token-secret-panjang-dan-acak'
```

3. Jalankan server:

```bash
node server.js
```

Buka:

```text
http://localhost:3000/
```

## Jalankan dengan Docker Compose

1. Edit `docker-compose.yml`.
2. Ganti nilai berikut:

```yaml
LOCAL_ADMIN_EMAIL: admin@example.com
LOCAL_ADMIN_PASSWORD: ganti-password-ini
TOKEN_SECRET: ganti-token-secret-panjang-dan-acak
```

3. Jalankan:

```bash
docker compose up -d --build
```

4. Buka dari jaringan lokal:

```text
http://IP-MINI-PC:3000/
```

## Deploy di CasaOS

Cara paling mudah:

1. Buka CasaOS.
2. Pilih menu aplikasi/custom install Docker Compose.
3. Pakai isi `docker-compose.yml`.
4. Pastikan volume ini tetap dipasang:

```yaml
volumes:
  - ./data:/app/data
```

Volume tersebut penting supaya data dan PDF tidak hilang saat container dihapus/update.

## Backup

Backup folder berikut secara rutin:

```text
data/
```

Isi pentingnya:

```text
data/certificates.json
data/uploads/*.pdf
```

Contoh backup manual:

```bash
zip -r backup-aplikasi-sertifikat-$(date +%F).zip data
```

## Akses publik yang disarankan

Untuk data sertifikat yang sensitif, jangan langsung buka port router jika belum perlu.

Rekomendasi:

```text
Cloudflare Tunnel + Cloudflare Access
```

Arahkan tunnel ke:

```text
http://localhost:3000
```

Lalu batasi akses hanya ke email admin tertentu melalui Cloudflare Access.

## Catatan keamanan

- Ganti password default sebelum dipakai.
- Gunakan `TOKEN_SECRET` yang panjang dan acak.
- Jangan commit file `.env` berisi password.
- Batasi akses publik dengan Cloudflare Access/VPN.
- Backup `data/` secara berkala.
