# Backend Setup - Sistem Arsip Sertifikat Tuban

Backend dibuat memakai:

- Netlify Functions sebagai API serverless
- Supabase untuk database dan login
- Google Drive untuk penyimpanan PDF, opsional untuk tahap berikutnya

## 1. Supabase

1. Buat project Supabase.
2. Buka SQL Editor.
3. Jalankan file `supabase/schema.sql`.
4. Buat user login di menu Authentication > Users.
5. Ambil nilai berikut dari Project Settings > API:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## 2. Netlify

1. Deploy repository ini ke Netlify.
2. Di Site Configuration > Environment Variables, isi:

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

3. Deploy ulang site.

Pada tahap ini, data sertifikat dan metadata PDF sudah masuk Supabase. File PDF fisik belum tersimpan ke Google Drive sampai variabel Google Drive ditambahkan.

## 3. Google Drive, menyusul

1. Buat Google Cloud Project.
2. Aktifkan Google Drive API.
3. Buat Service Account.
4. Buat key JSON untuk Service Account.
5. Buat folder Google Drive untuk arsip PDF.
6. Share folder tersebut ke email service account sebagai Editor.
7. Tambahkan env berikut di Netlify:

```env
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=...
PUBLIC_GOOGLE_DRIVE_FILES=true
```

8. Deploy ulang site.

## Endpoint API

Login:

```text
POST /api/login
```

List sertifikat:

```text
GET /api/certificates
```

Tambah sertifikat dan upload PDF:

```text
POST /api/certificates
```

Update sertifikat:

```text
PUT /api/certificates
```

Hapus sertifikat:

```text
DELETE /api/certificates?id=<uuid>
```

## Catatan

Jika environment Netlify belum diisi, frontend tetap bisa dicoba dalam mode demo lokal menggunakan `localStorage`.
