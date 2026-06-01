# 📘 PRD — Sistem Arsip Sertifikat Hak Pakai  
## Pemerintah Kabupaten Tuban

---

# 🌟 Gambaran Umum

Website ini dibuat untuk membantu pengelolaan data sertifikat hak pakai dan arsip scan PDF milik Pemerintah Kabupaten Tuban agar lebih:

- 📂 Rapi
- ⚡ Cepat dicari
- ☁️ Aman tersimpan di cloud
- 👥 Bisa diakses multi-user
- 🔎 Mudah dipantau dan dikelompokkan

Sistem dirancang modern namun tetap ringan dan mudah digunakan oleh pegawai.

---

# 🎯 Tujuan Aplikasi

Membuat sistem digital terpusat untuk:

- Menyimpan data sertifikat hak pakai
- Mengelompokkan arsip berdasarkan kategori tertentu
- Mengupload dan melihat scan PDF sertifikat
- Mempermudah pencarian data
- Mengurangi risiko kehilangan arsip fisik
- Mempermudah akses data antar perangkat/kantor

---

# 👥 Target Pengguna

| Role | Fungsi |
|---|---|
| 👨‍💼 Admin | Mengelola seluruh data dan user |
| 🧾 Operator | Input dan edit data sertifikat |
| 👀 Pimpinan | Melihat data dan laporan |

---

# 🧩 Fitur Utama

## 📋 Manajemen Data Sertifikat

User dapat:
- Menambah data sertifikat
- Mengedit data
- Menghapus data
- Melihat detail data

Field utama:
- Nomor Sertifikat
- Nama Barang/Tanah
- Lokasi
- Luas
- Tahun
- Status
- Keterangan

---

## 🔎 Pencarian Cepat

Pencarian berdasarkan:
- Nomor sertifikat
- Lokasi
- Kecamatan
- Kelurahan
- Status
- Kata kunci tertentu

---

## 🗂️ Pengelompokan Data

Data dapat difilter berdasarkan:
- Kecamatan
- Kelurahan
- Status aset
- Tahun
- Jenis aset

---

## 📄 Upload Scan PDF

User dapat:
- Upload file PDF sertifikat
- Melihat preview PDF langsung di website
- Membuka file PDF penuh
- Download file jika diperlukan

---

## 👀 Preview PDF Langsung

PDF ditampilkan langsung di halaman website menggunakan preview Google Drive.

Contoh:
- Tidak perlu download file terlebih dahulu
- Bisa langsung dibaca di browser

---

## 🔐 Login & Hak Akses

Fitur:
- Login user
- Role management
- Pembatasan akses fitur berdasarkan jabatan

---

# ☁️ Arsitektur Sistem

```text
VS Code
↓
GitHub
↓
Netlify
↓
Website React
↓
Supabase
↓
Google Drive
```

---

# ⚙️ Teknologi yang Digunakan

| Teknologi | Fungsi |
|---|---|
| React | Frontend website |
| Netlify | Hosting website |
| Supabase | Database & backend |
| Google Drive | Penyimpanan PDF |
| GitHub | Penyimpanan source code |

---

# 🗃️ Penyimpanan Data

## Supabase
Digunakan untuk:
- Data sertifikat
- User login
- Metadata file
- Histori data

## Google Drive
Digunakan untuk:
- Penyimpanan scan PDF
- Preview file
- Arsip cloud 15GB+

---

# 🔄 Alur Upload File

```text
User Upload PDF
↓
Website React
↓
Supabase Edge Function
↓
Google Drive
↓
Link file disimpan ke Supabase
↓
Preview tampil di website
```

---

# 🎨 Konsep Desain UI

Tema:
- Ceria
- Modern
- Bersih
- Mudah dipahami

Warna utama:
- Biru muda
- Putih
- Hijau lembut

Konsep:
- Dashboard simpel
- Icon jelas
- Navigasi mudah
- Responsive desktop & mobile

---

# 📊 Dashboard

Dashboard menampilkan:
- Total sertifikat
- Total file PDF
- Jumlah per kecamatan
- Status aset
- Aktivitas terbaru

---

# 🔒 Keamanan Dasar

- Login authentication
- Role user
- Database cloud
- Backup cloud
- File tersimpan online
- Source code tersimpan di GitHub

---

# 🚀 Target Pengembangan

## Tahap 1
- CRUD data sertifikat
- Upload PDF
- Preview PDF
- Login user

## Tahap 2
- Dashboard statistik
- Filter lanjutan
- Export Excel/PDF

## Tahap 3
- Realtime update
- Audit log aktivitas
- Notifikasi perubahan data

---

# 💡 Tujuan Jangka Panjang

Menjadikan sistem arsip sertifikat:
- Lebih modern
- Mudah diakses
- Aman
- Terpusat
- Mengurangi arsip manual
- Mempermudah pekerjaan pengelolaan barang milik daerah

---

# 🏁 Kesimpulan

Aplikasi ini merupakan sistem arsip sertifikat berbasis cloud modern yang menggabungkan:

- ⚛️ React
- ☁️ Supabase
- 📄 Google Drive
- 🌐 Netlify
- 🐙 GitHub

dengan tujuan membantu pengelolaan aset dan arsip sertifikat Pemerintah Kabupaten Tuban secara lebih efektif, cepat, dan aman.
