# PANDUAN-DEPLOY-REKAN.md - Cara Deploy TPB Website (untuk pengelola)

Panduan ini merangkum beberapa cara men-deploy situs dari repo ini, dari yang paling
mandiri (semua di VPS) sampai yang cepat (Vercel saja). Runbook teknis lengkap untuk
VPS tetap ada di `DEPLOY.md`; dokumen ini melengkapi dengan skenario dan hal yang
sering bikin gagal.

Lisensi proyek: proprietary UNU Purwokerto. Deploy hanya untuk keperluan organisasi
yang berwenang.

## 0. Yang sudah tersedia

- Repo (publik): https://github.com/ecdysterone89077/TPB-Website
- Rilis terbaru: tag `v1.0.1` (pakai tag ini; jangan pakai `main` mentah karena terus bergerak)
- File database: `tpb-db-full-20260916.sql` (dikirim terpisah oleh pemilik)
  - isi: 13 tabel, 1 halaman dengan 28 blok, 1 user ADMIN (`tpb@unupurwokerto.ac.id`), 0 media, 0 pendaftar/langganan
- Catatan: deployment Vercel yang ada sekarang hanya frontend; belum ada API/DB di belakangnya.
  Situs akan tampak kosong/error sampai API berdiri - itu normal, bukan kerusakan repo.

## 1. Skenario 1 - Semua di VPS (paling mandiri, disarankan)

Ikuti `DEPLOY.md` bagian 1-7 dan 10. Ringkasan urutannya:

1. VPS Ubuntu + aaPanel. Install: MySQL 8.0, Node.js v22, PM2. Lalu `npm install -g pnpm@9`.
2. Buat database `tpb` (aaPanel -> Database, atau SQL di `DEPLOY.md` bagian 2).
   Jangan buka port MySQL (3306) ke internet.
3. Clone dan pin ke tag rilis:

   ```bash
   mkdir -p /www/wwwroot && cd /www/wwwroot
   git clone https://github.com/ecdysterone89077/TPB-Website.git tpb-website
   cd tpb-website
   git fetch --tags && git checkout v1.0.1
   corepack enable
   pnpm install --frozen-lockfile
   ```

4. Impor dump database (tabel + riwayat migrasi sudah termasuk di dalamnya):

   ```bash
   mysql -utpb -p tpb < /lokasi/tpb-db-full-20260916.sql
   ```

   atau lewat Impor di phpMyAdmin/aaPanel. Setelah ini `pnpm db:migrate:deploy`
   berikutnya hanya no-op.
5. Buat rahasia API: `cp apps/api/.env.example apps/api/.env`, isi sesuai tabel `DEPLOY.md`
   bagian 4. Wajib: `JWT_ACCESS_SECRET` baru (`openssl rand -hex 48`), `DATABASE_URL`,
   `MEDIA_DIR` (path absolut, writable), `CORS_ORIGINS` = origin web, `COOKIE_SECURE=true`.
6. Migrasi + build:

   ```bash
   pnpm db:migrate:deploy
   pnpm --filter @tpb/contracts build
   pnpm --filter @tpb/api build
   VITE_API_URL="https://<DOMAIN>/v1" pnpm --filter @tpb/web build
   pnpm api:preflight
   ```

7. Jalankan API dengan PM2:

   ```bash
   pm2 start ecosystem.config.cjs --env production
   pm2 save && pm2 startup
   curl -fsS http://127.0.0.1:3000/v1/health
   ```

8. Nginx: root situs ke `apps/web/dist`, proxy `/v1/` dan `/media/` ke `127.0.0.1:3000`
   (blok konfigurasi ada di `DEPLOY.md` bagian 7), lalu aktifkan SSL + Force HTTPS.
9. Verifikasi: `https://<DOMAIN>/v1/health` mengembalikan `{"ok":true,"database":"up"}`;
   buka `https://<DOMAIN>/`; panel admin di `https://<DOMAIN>/#admin`.

Deploy ulang berikutnya: `git fetch --tags && git checkout <tag-baru>`, build ulang,
lalu `pm2 reload`.

## 2. Skenario 2 - Web di Vercel sendiri + API/DB di VPS

1. Fork repo ini, lalu ubah `vercel.json`: ganti rewrite `/media/:path*` dari
   `https://api.tpb.unupurwokerto.ac.id` (domain pemilik, belum aktif) menjadi
   `https://api.<domain-anda>`.
2. Import repo fork ke Vercel. Set environment variable `VITE_API_URL=https://api.<domain-anda>/v1`
   (nilai ini dibaca saat build).
3. Deploy API + DB seperti Skenario 1 (langkah 1-7 dan 10), dengan
   `CORS_ORIGINS=https://<proyek-vercel-anda>`.
4. Pastikan API ber-HTTPS (cookie refresh) dan `/media/` di-proxy ke API.

## 3. Skenario 3 - Frontend tetap di Vercel pemilik + API/DB di VPS Anda

1. Deploy API + DB seperti Skenario 1 (langkah 1-7 dan 10).
2. Kirim URL API ke pemilik; pemilik mengisi `VITE_API_URL` di proyek Vercel
   `tpb5/tpb-website` lalu redeploy.
3. Di API, set `CORS_ORIGINS` ke domain web Vercel.

## 4. Skenario 4 - Vercel saja (hanya pratinjau tampilan)

Vercel hanya menyajikan frontend statis. Tanpa API, semua data kosong (halaman,
berita, pengaturan). Hanya berguna untuk melihat tampilan, bukan untuk produksi.

## 5. Soal login admin

Dump memuat user `tpb@unupurwokerto.ac.id` dengan sandi dari environment pemilik.
Kalau tidak dipakai, kosongkan tabel user dulu (urutan penting karena foreign key):

```sql
DELETE FROM audit_logs;
DELETE FROM refresh_tokens;
DELETE FROM users;
```

Lalu buka `https://<DOMAIN>/#admin`: form Bootstrap Admin muncul hanya saat tabel
`users` kosong, dan admin baru bisa dibuat di situ.

Kalau memakai akun dari dump, segera ganti sandinya lewat menu **Pengguna**.
Jangan membagikan file dump ke pihak lain - berisi hash kredensial.

## 6. Masalah yang sering terjadi

| Gejala | Sebab / tindakan |
|---|---|
| Workflow GitHub "Deploy Production" merah: `Secret ... belum diisi` | Normal - webhook aaPanel belum diisi pemilik. Deploy manual di dokumen ini tetap jalan. |
| API mati, situs 502 | `pm2 status`; `pm2 logs tpb-api --lines 100`; jalankan ulang `pm2 start ecosystem.config.cjs --env production`. |
| Error CORS | `CORS_ORIGINS` harus sama persis dengan origin web (tanpa slash akhir). |
| Login selalu balik ke halaman login | Pastikan Force HTTPS aktif dan `COOKIE_SECURE=true`. |
| `/media/...` 404 | File ada di `MEDIA_DIR` dan blok `location /media/` Nginx benar. |
| Halaman putih | Lihat log build web; build ulang dengan `VITE_API_URL` benar. |
| Domain `api.tpb.unupurwokerto.ac.id` tidak resolve | Jangan dipakai sampai DNS + API-nya benar-benar berdiri; pakai domain sendiri. |
| Migrasi | Dump berisi 10 riwayat migrasi sedangkan kode `v1.0.1` punya 7 - aman; entri ekstra diabaikan dan kolomnya tidak dipakai aplikasi. Jangan edit file migrasi. |

## 7. Checklist verifikasi

- [ ] `https://<DOMAIN>/v1/health` mengembalikan ok + database up
- [ ] Halaman publik tampil dengan konten (bukan kosong)
- [ ] Bisa login admin di `/#admin`
- [ ] (Opsional) Unggah 1 gambar lewat menu Media dan pastikan muncul di `/media/...`

## 8. Yang perlu diminta ke pemilik

- File `tpb-db-full-20260916.sql`
- (Opsional) sandi admin dari dump, bila ingin memakai akun yang sudah ada
- (Opsional, Skenario 3) pengaturan `VITE_API_URL` di proyek Vercel pemilik
- (Opsional, otomatisasi) pengaturan secret webhook `AAPANEL_*` di GitHub
