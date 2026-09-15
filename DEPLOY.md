# DEPLOY.md — Panduan Deploy untuk Pengelola VPS

Panduan ini ditulis langkah-demi-langkah agar dapat diikuti tanpa latar belakang teknis.
Ikuti berurutan, jangan lewati langkah verifikasi.

## Peran

| Peran | Siapa | Tugas |
|---|---|---|
| **Pemilik repo (Author)** | Faunas Wisnhu Aji | Mengatur GitHub (secrets, environment, branch `develop`), menyiapkan bundel konten, membuat tag rilis |
| **Pengelola VPS** | Anda (teman Author) | Menyiapkan server, database, `.env`, Nginx, webhook aaPanel, menjalankan deploy, verifikasi |

## Hasil akhir yang diharapkan

- `https://<DOMAIN>/` menampilkan situs (frontend).
- `https://<DOMAIN>/v1/health` mengembalikan `{"ok":true,"database":"up"}`.
- Deploy otomatis: push ke `develop` → staging; tag `v*` → produksi (setelah approval di GitHub).

---

## 0. Prasyarat

- VPS Ubuntu 22.04/24.04, RAM minimal 2 GB, disk minimal 20 GB, akses `root`/sudo.
- Domain/subdomain sudah mengarah ke IP VPS (mis. `tpb.unupurwokerto.ac.id`), plus opsional `staging.tpb.unupurwokerto.ac.id`.
- **aaPanel** sudah terpasang dan bisa login.
- Akun GitHub Anda **sudah diundang sebagai collaborator** di repo `ecdysterone89077/TPB-Website` (minta Author mengundang lebih dulu).
- Perkakas dasar: `git`, `curl`, `jq` (cek dengan `git --version`, `jq --version`).

---

## 1. Instal komponen lewat aaPanel

1. Buka **App Store** di aaPanel, instal: **MySQL 8.0**, **Node.js (v22)**, **PM2**.
2. Pasang pnpm (via terminal VPS):

```bash
npm install -g pnpm@9
node -v && pnpm -v && pm2 -v
```

Harapan: `node -v` menampilkan `v22.x`, `pnpm -v` menampilkan `9.x`.

---

## 2. Buat database

Jalankan di aaPanel → **Database** → tambah database:

- Nama database: `tpb`
- User: `tpb`
- Password: gunakan yang kuat dan **catat**

Atau lewat terminal MySQL:

```sql
CREATE DATABASE tpb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tpb'@'localhost' IDENTIFIED BY '<PASSWORD_DB>';
GRANT ALL PRIVILEGES ON tpb.* TO 'tpb'@'localhost';
FLUSH PRIVILEGES;
```

> Jangan membuka port MySQL (3306) ke internet.

---

## 3. Ambil kode proyek

```bash
mkdir -p /www/wwwroot && cd /www/wwwroot
git clone https://github.com/ecdysterone89077/TPB-Website.git tpb-website
cd tpb-website
corepack enable
pnpm install --frozen-lockfile
```

Jika clone meminta login GitHub, gunakan akun collaborator Anda (PAT/credential yang diminta Git).

> Semua langkah berikut dijalankan dari direktori `/www/wwwroot/tpb-website`.

---

## 4. Buat file rahasia `apps/api/.env`

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` (aaPanel File Manager atau `nano apps/api/.env`) dan isi:

| Variabel | Nilai produksi | Catatan |
|---|---|---|
| `NODE_ENV` | `production` | wajib |
| `PORT` | `3000` | biarkan default |
| `DATABASE_URL` | `mysql://tpb:<PASSWORD_DB>@localhost:3306/tpb` | pakai password dari langkah 2 |
| `JWT_ACCESS_SECRET` | hasil `openssl rand -hex 48` | minimal 32 karakter; **jangan** pakai contoh |
| `JWT_ACCESS_TTL_SECONDS` | `900` | biarkan default |
| `JWT_REFRESH_TTL_DAYS` | `30` | biarkan default |
| `COOKIE_SECURE` | `true` | wajib karena HTTPS |
| `COOKIE_NAME` | `tpb_refresh` | biarkan default |
| `COOKIE_DOMAIN` | kosongkan, isi `.unupurwokerto.ac.id` bila login macet | opsional |
| `MEDIA_DIR` | `/www/wwwroot/tpb-media` | **path absolut**, di luar folder rilis |
| `MEDIA_MAX_MB` | `10` | biarkan default |
| `TRUST_PROXY` | `1` | satu hop Nginx |

Siapkan folder media (harus bisa ditulis oleh proses Node/PM2):

```bash
mkdir -p /www/wwwroot/tpb-media
chown -R www:www /www/wwwroot/tpb-media
```

> File `.env` **tidak pernah** di-commit ke GitHub dan tidak boleh dikirim lewat chat.

---

## 5. Migrasi database + build

```bash
pnpm db:migrate:deploy
pnpm --filter @tpb/contracts build
pnpm --filter @tpb/api build
VITE_API_URL="https://<DOMAIN>/v1" pnpm --filter @tpb/web build
pnpm api:preflight
```

- `pnpm db:migrate:deploy` menyiapkan tabel.
- `VITE_API_URL` harus domain API (tanpa slash di akhir).
- `pnpm api:preflight` memastikan `.env` valid. Harapan: selesai tanpa pesan error.

---

## 6. Jalankan API dengan PM2

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

Salin dan jalankan perintah `sudo ...` yang tercetak oleh `pm2 startup`.
Cek status dan log:

```bash
pm2 status
pm2 logs tpb-api --lines 50
curl -fsS http://127.0.0.1:3000/v1/health
```

Harapan: `{"ok":true,"database":"up"}`.

---

## 7. Website + SSL di aaPanel

1. **Website → Add site**: domain `<DOMAIN>`, root directory `/www/wwwroot/tpb-website/apps/web/dist`.
2. **SSL → Let's Encrypt**: terbitkan sertifikat, aktifkan **Force HTTPS**.
3. Buka **Config** (Nginx) situs tersebut dan pastikan berisi:

```nginx
location /       { root /www/wwwroot/tpb-website/apps/web/dist; try_files $uri $uri/ /index.html; }
location /v1/    { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
location /media/ { proxy_pass http://127.0.0.1:3000; }
```

Simpan lalu **Reload Nginx**.

---

## 8. Webhook deploy di aaPanel

1. aaPanel → **Webhooks** (buka plugin/kemampuan webhook).
2. Buat webhook bernama `deploy-staging`, paste script **staging** di bawah, simpan, dan **salin URL**-nya.
3. Buat webhook bernama `deploy-production`, paste script **produksi**, simpan, dan **salin URL**-nya.
4. Kirim kedua URL tersebut ke Author (untuk dipasang sebagai GitHub Secrets).

**Script staging** (untuk branch `develop`):

```bash
set -e
REPO_DIR=/www/wwwroot/tpb-website
API_URL="https://staging-api.<DOMAIN>/v1"
cd "$REPO_DIR"
git fetch origin develop
git checkout --force develop
git reset --hard origin/develop
pnpm install --frozen-lockfile
pnpm db:migrate:deploy
pnpm --filter @tpb/contracts build
pnpm --filter @tpb/api build
VITE_API_URL="$API_URL" pnpm --filter @tpb/web build
pm2 reload ecosystem.config.cjs --only tpb-api --update-env || pm2 start ecosystem.config.cjs --env production
curl --fail --retry 10 --retry-delay 3 http://127.0.0.1:3000/v1/health
```

**Script produksi** (untuk tag `v*`; otomatis memakai tag versi terbaru):

```bash
set -e
REPO_DIR=/www/wwwroot/tpb-website
API_URL="https://<DOMAIN>/v1"
cd "$REPO_DIR"
git fetch --tags
TAG=$(git tag --sort=-v:refname | head -n1)
test -n "$TAG"
git checkout --force "$TAG"
pnpm install --frozen-lockfile
pnpm db:migrate:deploy
pnpm --filter @tpb/contracts build
pnpm --filter @tpb/api build
VITE_API_URL="$API_URL" pnpm --filter @tpb/web build
pm2 reload ecosystem.config.cjs --only tpb-api --update-env || pm2 start ecosystem.config.cjs --env production
curl --fail --retry 10 --retry-delay 3 http://127.0.0.1:3000/v1/health
```

> Ganti `<DOMAIN>` dan `staging-api.<DOMAIN>` dengan domain yang sebenarnya.

---

## 9. Yang dilakukan Author (GitHub)

1. **Settings → Environments → `Production` → Required reviewers**: tambahkan diri sendiri.
   (Selama ini belum aktif sehingga approval manual tidak berjalan.)
2. **Settings → Secrets and variables → Actions**: set `AAPANEL_STAGING_WEBHOOK_URL` dan `AAPANEL_PRODUCTION_WEBHOOK_URL` dari URL langkah 8.
3. Buat branch **`develop`** dari `main` (dipakai untuk staging).
4. Rilis produksi: setelah CI `main` hijau, buat tag `vX.Y.Z` → approve di GitHub → webhook berjalan.

Catatan: setiap deploy (staging/produksi) menjalankan **preflight** (lint, typecheck, test) sebelum webhook dipanggil; bila preflight gagal, deploy tidak jalan.

---

## 10. Verifikasi pertama

```bash
curl -fsS https://<DOMAIN>/v1/health
```

1. Buka `https://<DOMAIN>/` → halaman tampil.
2. Buka `https://<DOMAIN>/#admin` → form **Bootstrap Admin** (hanya muncul saat tabel user kosong). Isi nama, email, kata sandi minimal 10 karakter.
3. Login → panel admin terbuka.

---

## 11. Konten pertama kali

Database masih kosong. Alur lengkapnya ada di README bagian **"Deploy Baru → Impor Konten"**:

1. Minta Author file `tpb-konten-<tanggal>.json` (hasil **Ekspor konten** dari environment lama).
2. Pindahkan arsip media (`MEDIA_DIR` lama) ke `/www/wwwroot/tpb-media` bila ada.
3. Di panel: **Konten Halaman → Impor konten** → pilih file → periksa pratinjau → konfirmasi.
4. Ambil backup database **sebelum** impor (`mysqldump`), terutama bila database sudah berisi data.

---

## 12. Rilis berikutnya

- **Staging**: Author push/merge ke `develop` → webhook staging otomatis.
- **Produksi**: Author buat tag `vX.Y.Z` → approve → webhook produksi otomatis.
- Deploy otomatis: `git` → `pnpm install` → migrasi → build → `pm2 reload` → cek health.

---

## 13. Jika ada masalah (troubleshooting)

| Gejala | Kemungkinan penyebab | Tindakan |
|---|---|---|
| Deploy tidak jalan | Secret webhook belum diisi / environment belum punya reviewer | Cek GitHub → Actions: pesan `Secret ... belum diisi` atau menunggu approval |
| Situs 502 Bad Gateway | API mati | `pm2 status`, `pm2 logs tpb-api --lines 100`, jalankan ulang `pm2 start ecosystem.config.cjs --env production` |
| API gagal start: `... wajib dikonfigurasi` | `.env` belum lengkap | Perbaiki `apps/api/.env`, lalu `pnpm api:preflight` |
| API gagal start: `MEDIA_DIR tidak writable` | Izin folder salah | `chown -R www:www /www/wwwroot/tpb-media` |
| Browser error CORS | `CORS_ORIGINS` tidak sama dengan domain | Tulis persis `https://<DOMAIN>` (tanpa slash akhir), pisahkan koma bila lebih dari satu |
| Tidak bisa login / balik ke halaman login | Cookie tidak tersimpan | Pastikan Force HTTPS aktif dan `COOKIE_SECURE=true` |
| Gambar `/media/...` 404 | File tidak ada / Nginx salah | Cek file di `MEDIA_DIR` dan blok `location /media/` |
| Migrasi gagal | Koneksi/password DB salah | Cek `DATABASE_URL` dan hak akses user `tpb`; **jangan** mengedit file migration |
| Halaman putih setelah deploy | Build web gagal | Lihat log webhook; jalankan `VITE_API_URL="https://<DOMAIN>/v1" pnpm --filter @tpb/web build` manual |

---

## 14. Keamanan & larangan

- Jangan pernah men-commit atau membagikan isi `apps/api/.env`.
- Jangan membuka MySQL (3306) atau port 3000 ke internet; cukup lewat Nginx.
- Backup rutin: `mysqldump` untuk database dan salinan `MEDIA_DIR` untuk file media.
- Jangan menghapus tag rilis dan jangan mengedit migration yang sudah diterapkan.
- Lisensi proyek: **proprietary, hak cipta UNU Purwokerto** (lihat `LICENSE`). Jangan membagikan kode ke pihak lain tanpa izin Author.
