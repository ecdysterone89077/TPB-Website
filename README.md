# TPB Monorepo — UNU Purwokerto

Monorepo untuk situs resmi Program Studi Teknik Pertanian & Biosistem UNU Purwokerto.

| Aplikasi | Keterangan |
|---|---|
| `apps/web` | Frontend React 19 + Vite 6 + Tailwind v4 |
| `apps/api` | REST API NestJS 11 + Prisma + MySQL 8.0, prefix `/v1` |
| `packages/contracts` | Tipe & skema Zod bersama (frontend ↔ backend) |
| `tools/supabase-migration` | Tooling migrasi data Supabase KV → MySQL |
| `.github/workflows` | CI (GitHub Actions) + deploy via aaPanel Webhook |

---

## Prasyarat

| Tool | Versi minimum | Keterangan |
|---|---|---|
| Node.js | ≥ 22.12 (rekomendasi 22 LTS) | Runtime JavaScript; `require(esm)` dibutuhkan oleh kontrak ESM |
| pnpm | ≥ 9 | Jalankan `corepack enable` terlebih dahulu |
| Docker | — | Untuk MySQL 8.0 lokal, atau gunakan MySQL sendiri |

---

## Environment

Salin setiap contoh environment ke file lokal/server yang sesuai. **Jangan pernah commit file `.env`.**

| File contoh | Isi |
|---|---|
| `apps/api/.env.example` | `NODE_ENV`, `PORT`, `DATABASE_URL`, JWT access secret & TTL, CORS allowlist, refresh-cookie settings, `MEDIA_DIR`, upload limit, `TRUST_PROXY` |
| `apps/web/.env.example` | Hanya `VITE_API_URL` (publik); jangan pernah simpan rahasia di variabel `VITE_*` |
| `tools/supabase-migration/.env.example` | Supabase service-role key (khusus migrasi) dan MySQL URL |

### Variabel wajib produksi

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | URL koneksi MySQL, contoh: `mysql://user:pass@host:3306/db` |
| `CORS_ORIGINS` | Domain frontend yang diizinkan (dipisah koma) |
| `JWT_ACCESS_SECRET` | Minimal 32 karakter, contoh: `openssl rand -hex 48` |
| `COOKIE_SECURE` | `true` untuk produksi (HTTPS) |
| `MEDIA_DIR` | Path absolut yang dapat ditulis, persisten di luar direktori rilis |
| `TRUST_PROXY` | `false`, `true`, atau jumlah hop proxy tepercaya |
| `COOKIE_DOMAIN` | Opsional; hanya jika domain hosting memerlukannya |
| `VITE_API_URL` | URL API berversi, contoh: `https://api.tpb.unupurwokerto.ac.id/v1` (bukan localhost) |

### Kebijakan pemulihan database

Pemulihan database hanya melalui **forward-fix** — jangan edit atau hapus migration yang sudah diterapkan. Sebelum deploy migration, ambil backup MySQL normal dari host dan catat tag rilis. Jika migration atau rilis gagal:

- Pertahankan proses aplikasi sebelumnya jika memungkinkan.
- Pulihkan database hanya melalui prosedur backup tim hosting yang sudah diuji jika integritas data mengharuskan.
- Buat migration korektif baru untuk pemulihan maju.
- Verifikasi `pnpm db:migrate:deploy` dan `/v1/health` sebelum membuka kembali lalu lintas.

Media yang diunggah harus dicadangkan secara terpisah dari MySQL karena berada di `MEDIA_DIR`.

---

## Setup Pengembangan

```bash
# 1. Jalankan MySQL 8.0 via Docker
docker compose up -d db

# 2. Salin file environment
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — isi JWT secret: openssl rand -hex 48
cp apps/web/.env.example apps/web/.env

# 3. Instal dependensi, build kontrak bersama, lalu jalankan migrasi database
pnpm install
pnpm --filter @tpb/contracts build
pnpm --filter @tpb/api prisma:migrate

# 4. Jalankan aplikasi
pnpm dev:api    # http://localhost:3000/v1
pnpm dev:web    # http://localhost:5173
```

Catatan:

- `pnpm dev:api` memakai `tsx watch`; jika mengalami kendala DI pada Node 24, gunakan `pnpm dev:api:dist` (build API lalu jalankan `node apps/api/dist/main.js`).
- `docker compose up -d db` memerlukan CLI Docker di PATH; bila Docker hanya tersedia di dalam WSL, jalankan perintah tersebut dari WSL (aplikasi tetap diakses dari Windows melalui `localhost`).
- API me-resolve `@tpb/contracts` ke `packages/contracts/dist`, sehingga langkah build kontrak di atas wajib dijalankan pada checkout bersih.

### Perintah database

```bash
pnpm prisma:generate              # Generate Prisma Client
pnpm db:migrate                   # Buat & terapkan migration development
pnpm db:migrate:create -- nama    # Buat migration baru tanpa menerapkan
pnpm db:migrate:deploy            # Terapkan migration yang sudah direview (staging/production)
```

- `db:migrate` — membuat dan menerapkan migration development.
- `db:migrate:deploy` — hanya untuk migration yang sudah direview pada staging/production.
- Sistem ini **tidak memiliki seeder** berisi data institusi atau data palsu. Bootstrap admin dilakukan melalui halaman `/#admin` saat tabel user kosong.

---

## Deployment via aaPanel Webhook

Deployment dilakukan melalui **aaPanel Webhook** — tidak ada akses SSH dari GitHub Actions.

### Alur deployment

| Trigger | Tujuan | Alur |
|---|---|---|
| Push ke branch `develop` | Staging | GitHub Actions → POST webhook → aaPanel jalankan script deploy |
| Push tag `v*` | Production | GitHub Actions → approval manual → POST webhook → aaPanel jalankan script deploy |

### Konfigurasi webhook di aaPanel

Buka **Website → Webhooks** (atau Plugin Webhooks) di aaPanel, lalu masukkan script bash berikut. Script ini dijalankan otomatis oleh aaPanel setiap kali GitHub Actions memanggil URL webhook.

**Script staging** (trigger: push ke `develop`):

```bash
set -e
cd /path/to/repo
git fetch origin develop
git checkout --force develop
git reset --hard origin/develop
pnpm install --frozen-lockfile
pnpm db:migrate:deploy
pnpm --filter @tpb/contracts build
pnpm --filter @tpb/api build
VITE_API_URL="https://staging-api.example.test/v1" pnpm --filter @tpb/web build
pm2 reload ecosystem.config.cjs --only tpb-api --update-env || pm2 start ecosystem.config.cjs --env production
curl --fail --retry 10 --retry-delay 3 http://127.0.0.1:3000/v1/health
```

**Script production** (trigger: tag `v*`, memerlukan approval manual):

```bash
set -e
cd /path/to/repo
git fetch --tags && git checkout <tag>
pnpm install --frozen-lockfile
pnpm db:migrate:deploy
pnpm --filter @tpb/contracts build
pnpm --filter @tpb/api build
VITE_API_URL="https://api.example.test/v1" pnpm --filter @tpb/web build
pm2 reload ecosystem.config.cjs --only tpb-api --update-env || pm2 start ecosystem.config.cjs --env production
curl --fail --retry 10 --retry-delay 3 http://127.0.0.1:3000/v1/health
```

> Ganti `/path/to/repo` dengan path absolut direktori repositori di peladen. Ganti `VITE_API_URL` dengan URL API target yang sebenarnya.

### GitHub Secrets

Konfigurasi di **Settings → Secrets and variables → Actions**:

| Secret | Keterangan |
|---|---|
| `AAPANEL_STAGING_WEBHOOK_URL` | URL webhook aaPanel untuk staging |
| `AAPANEL_PRODUCTION_WEBHOOK_URL` | URL webhook aaPanel untuk production |

### GitHub Environment Variables

Konfigurasi di **Settings → Environments**:

| Variabel | Environment | Keterangan |
|---|---|---|
| `STAGING_API_URL` | staging | URL API staging, contoh: `https://staging-api.example.test/v1` |
| `PROD_API_URL` | production | URL API production, contoh: `https://api.example.test/v1` |

> Environment `production` harus memiliki protection rule dengan **required reviewers** (approval manual).

### Server-side secrets

Sebelum start, sediakan nilai lengkap `apps/api/.env` di peladen:

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | URL koneksi MySQL |
| `JWT_ACCESS_SECRET` | ≥ 32 karakter |
| `CORS_ORIGINS` | Domain frontend yang diizinkan |
| `COOKIE_SECURE` | `true` untuk produksi |
| `MEDIA_DIR` | Path absolut, dapat ditulis, persisten di luar direktori rilis |
| `TRUST_PROXY` | Konfigurasi proxy |

PM2 file tidak memuat rahasia — hosting harus menyuntikkan variabel ini sebelum PM2 start/reload.

Jalankan `pnpm api:preflight` dengan environment yang sama sebelum restart produksi untuk memastikan konfigurasi valid. Simpan `MEDIA_DIR` di luar direktori rilis agar pembersihan rilis tidak menghapus file yang diunggah.

### Varian Deployment

#### Opsi A — Full di VPS (frontend + API satu domain `tpb.unupurwokerto.ac.id`)
Cocok jika ingin 1 tempat, 1 SSL, simpel perawatan.
- DNS `A tpb → IP VPS`.
- Env VPS: `CORS_ORIGINS=https://tpb.unupurwokerto.ac.id`, `VITE_API_URL=https://tpb.unupurwokerto.ac.id/v1`, `MEDIA_DIR=/www/wwwroot/tpb-media`.
- Build: `VITE_API_URL="https://tpb.unupurwokerto.ac.id/v1" pnpm --filter @tpb/web build` (frontend) + `pm2` (API).
- Nginx satu site:
  ```nginx
  location /       { root /www/wwwroot/tpb-website/apps/web/dist; try_files $uri $uri/ /index.html; }
  location /v1/    { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
  location /media/ { proxy_pass http://127.0.0.1:3000; }
  ```

#### Opsi B — Hybrid (frontend Vercel + API VPS) — sudah ter-deploy di `tpb-website.vercel.app`
Cocok untuk CDN global + deploy 1 menit.
- VPS: site `api.tpb.unupurwokerto.ac.id` → `proxy_pass 127.0.0.1:3000`, `CORS_ORIGINS=https://tpb.unupurwokerto.ac.id,https://tpb-website.vercel.app`.
- Vercel: Import `ecdysterone89077/TPB-Website` Root `./` (vercel.json atur build), Env `VITE_API_URL=https://api.tpb.unupurwokerto.ac.id/v1` → Deploy → Domains → Add `tpb.unupurwokerto.ac.id` (CNAME `tpb → cname.vercel-dns.com`) → Redeploy.
- API tetap di VPS via webhook, frontend auto-deploy via Vercel tiap push.

API NestJS + MySQL + upload file tidak cocok serverless — jangan deploy `apps/api` ke Vercel.

---

## Konfigurasi Peladen

### aaPanel

1. Jalankan `bash <(curl -s https://www.aapanel.com/script/install-ubuntu-7.0_en.sh)` lalu ikuti wizard.
2. Setelah aaPanel aktif, instal **Plugin Website** atau **Webhooks** dari panel.
3. Buat script deploy di atas sebagai webhook script, lalu salin URL webhook-nya ke GitHub Secrets.

### Aplikasi yang harus diinstal via aaPanel

| Aplikasi | Cara instal |
|---|---|
| Node.js ≥ 20 | aaPanel → App Store → Node.js |
| pnpm | `npm install -g pnpm` |
| MySQL 8.0 | aaPanel → App Store → MySQL |
| PM2 | `npm install -g pm2` |

### Nginx

Konfigurasi Nginx melalui **aaPanel Site Manager**:

| Rute | Target |
|---|---|
| `/` | Sajikan `apps/web/dist` sebagai static site |
| `/v1/` | Proxy ke API NestJS pada port 3000 |
| `/media/` | Proxy ke API pada port 3000 (atau sajikan langsung dari `MEDIA_DIR`) |

Proxy harus meneruskan cookie dan header `Authorization`, serta mengatur HTTPS di sisi hosting.

### MEDIA_DIR

Pastikan direktori `MEDIA_DIR`:
- Dapat ditulis oleh proses Node.js
- Persisten dan berada di luar direktori rilis
- Dicadangkan secara terpisah dari database MySQL

---

## Alur Admin

1. Buka `/#admin` — selama tabel `users` (MySQL) kosong, form **Bootstrap Admin** muncul (sekali pakai).
2. Login → dashboard: **Dashboard, Konten Halaman, Pengaturan Situs, Berita, PMB, Media, Pelanggan, Pengguna, Audit Log**.
3. **Konten Halaman (builder)** — pilih halaman → **+ Tambah bagian** (palet 40 template berlabel Indonesia) → isi kolom → atur urutan (tarik/geser atau tombol ↑↓) → **Simpan draf** → **Terbitkan**. Tersedia: duplikat, sembunyikan bagian, pratinjau, dan **Riwayat versi** (pulihkan versi lama). Editor teks mendukung tebal/miring/daftar/tautan (TipTap), kolom gambar memakai pemilih dari pustaka Media, kolom video menerima tautan YouTube/Instagram.
4. **Pengaturan Situs** — identitas/brand, logo, link PMB, footer & kontak, serta **editor menu navigasi** (multi-level, buka di tab baru).
5. **Struktur konten = halaman + blok** (lihat bagian Page Builder). Situs publik dirender sepenuhnya dari blok halaman terbit; tidak ada fallback/default content di kode (kebijakan: *tidak boleh ada data static inline / fallback / hardcode menempel di file code*).
6. **Media** — unggah JPEG/PNG/GIF/WebP/PDF lalu salin URL-nya; blok galeri menampilkan grid + popup lightbox (video YouTube/Instagram diputar di tempat), blok video mendukung mode popup.
7. **Pencarian** — tombol Cari di menu mencari keyword pada blok halaman yang sedang dibuka dan berita.

---

## Page Builder (halaman + blok)

Model konten: tabel `pages`, `blocks`, `nav_items`, `site_settings`, `page_revisions`. Kontrak validasi di `packages/contracts` (`BlockSchema`: 12 blok generik — termasuk rich text, gambar, video popup, galeri lightbox, tombol, accordion, tabel, embed, HTML kustom — + 28 preset bergaya situs sebelumnya). Blok `html` (mode lanjutan) disanitasi allowlist di server (`apps/api/src/sanitize.ts`). Tautan divalidasi (menolak `javascript:`/protocol-relative), menu maks 3 tingkat, id blok unik.

| Endpoint | Akses | Keterangan |
|---|---|---|
| `GET /v1/pages`, `GET /v1/pages/:slug` | publik | hanya halaman terbit; yang disajikan adalah **snapshot saat terbit** — editan draft baru tayang setelah `publish` |
| `GET /v1/nav`, `PUT /v1/nav` | publik / ADMIN+EDITOR | menu multi-level (maks 3 tingkat) |
| `GET /v1/settings`, `PUT /v1/settings` | publik / ADMIN+EDITOR | brand, footer, link PMB |
| `GET/POST/PUT/DELETE /v1/admin/pages[/:id]` | ADMIN+EDITOR | CRUD halaman |
| `PUT /v1/admin/pages/:id/blocks` | ADMIN+EDITOR | simpan blok transaksional (id blok dipertahankan; id duplikat ditolak) |
| `POST /v1/admin/pages/:id/publish` / `unpublish` | ADMIN+EDITOR | terbit (minimal 1 blok) + snapshot revisi |
| `GET /v1/admin/pages/:id/revisions`, `POST /v1/admin/pages/:id/revisions/:revisionId/restore` | ADMIN+EDITOR | riwayat & pemulihan; restore mengarsipkan keadaan sekarang lalu kembali draft |
| `GET /v1/admin/content/export`, `POST /v1/admin/content/import` | ADMIN | ekspor/impor penuh (settings, menu, halaman+blok, berita, daftar media); merge berdasarkan slug dalam satu transaksi |

Alamat halaman memakai path asli (`/`, `/profil`, dst.); SPA fallback disediakan `vercel.json` dan konfigurasi Nginx (`try_files ... /index.html`) — lihat bagian deployment.

### Migrasi & pembersihan tabel lama

```bash
pnpm content:migrate            # pratinjau rencana blok (dry-run, tanpa menulis)
pnpm content:migrate:write      # terapkan ke halaman "beranda"
pnpm content:migrate:reconcile  # verifikasi blok/menu/settings vs sumber
pnpm content:drop-legacy -- --yes   # hapus tabel legacy (site_modules, site_content, site_stats, gallery_items)
```

**Penting untuk produksi (hanya sekali, manual — bukan bagian script deploy):** setelah `pnpm db:migrate:deploy` pertama kali, jalankan urutan `content:migrate` → `content:migrate:write` → `content:migrate:reconcile` → `content:drop-legacy -- --yes` **setelah backup database**. Jangan menaruh langkah migrasi di webhook deploy: setelah tabel legacy di-drop, `content:migrate` otomatis no-op (aman), tetapi menjalankannya berulang sebelum drop akan menimpa editan konten dari panel.

## Deploy Baru → Impor Konten

Untuk environment baru (database kosong) atau pemulihan cepat tanpa seeder institusi:

1. **Environment lama:** buka `/#admin` → **Konten Halaman** → **Ekspor konten** (khusus ADMIN). Berkas `tpb-konten-<YYYYMMDD-HHmm>.json` berisi settings, menu, semua halaman + blok, semua berita, dan daftar media (URL saja — berkas media tidak ikut). Ekspor memvalidasi kontrak; jika ada data lama yang tidak valid, ekspor ditolak dengan pesan bagian yang bermasalah.
2. Pindahkan arsip media (`MEDIA_DIR`) secara terpisah dari database (mis. `rsync`) ke environment baru — **jangan unggah ulang**; impor akan mendaftarkan kembali entri pustaka Media dari bundel sehingga URL `/media/...` yang sudah disalin tetap terkelola.
3. **Environment baru:** buat admin pertama lewat `/#admin` (bootstrap), lalu **Konten Halaman** → **Impor konten** → pilih berkas → periksa pratinjau (jumlah halaman/berita, menu diganti seluruhnya, settings, media yang belum terdaftar) → konfirmasi.
4. Impor berjalan dalam **satu transaksi** dan **merge berdasarkan slug**: halaman dengan slug sama diperbarui (blok diganti berurutan), halaman baru dibuat, menu diganti seluruhnya, settings di-upsert, berita dengan slug sama diperbarui (termasuk menghidupkan kembali berita yang dihapus). Halaman berstatus terbit ikut membuat snapshot revisi. Halaman/berita yang **tidak ada di bundel dibiarkan apa adanya** — ini bukan pemulihan penuh; `ogImage` yang tidak ada di bundel akan dikosongkan.
5. Setelah impor: periksa situs publik dan **Terbitkan** halaman yang masih draf bila perlu.

> **Penting:** impor **tidak** menyimpan snapshot keadaan sebelumnya. Untuk environment yang sudah berisi konten, ambil backup MySQL dulu. Batas ukuran berkas bundel: 10 MB (limit body khusus endpoint impor; limit global API 2 MB). Untuk situs besar, pisahkan halaman menjadi beberapa bundel atau naikkan limit secara sadar di `apps/api/src/main.ts`.

## Migrasi Data dari Supabase

```bash
cd tools/supabase-migration

# Export data dari Supabase (kv_store_1860c1e8: posts, stats, subscribers, pmb, gallery, content)
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<key> pnpm export

# Import ke MySQL (idempoten) — content.json dipetakan ke halaman "beranda" + blok, settings, dan menu
pnpm import

# Verifikasi: hitungan baris posts, subscribers, pmb, blok halaman, menu, settings
pnpm reconcile
```

- `import` memetakan `content.json` (bersama `stats.json` dan `gallery.json`) memakai logika yang sama dengan `tools/content-migration` → menulis halaman `beranda` + blok, menu (`nav_items`), dan pengaturan global; data lama bila ada akan tertimpa. Tabel legacy `site_modules`/`site_content`/`site_stats`/`gallery_items` sudah tidak dipakai.
- `reconcile` memverifikasi hitungan baris untuk posts/subscribers/pmb/blok/menu/settings.

Service-role key **hanya** melalui variabel environment — tidak pernah masuk repo, tidak pernah diekspos ke frontend.

---

## Struktur Otentikasi

| Komponen | Detail |
|---|---|
| Access token | JWT, 15 menit, di memori frontend, header `Authorization: Bearer` |
| Refresh token | 30 hari, httpOnly cookie `tpb_refresh`; disimpan di database sebagai hash SHA-256, rotasi saat dipakai, revocation di logout |
| Reuse detection | Refresh token yang sudah dicabut lalu dipakai ulang → seluruh sesi aktif pengguna dicabut (family revocation) dan cookie dibersihkan |
| Rate limit | Global 100 req/menit per IP; khusus login 10/menit, bootstrap 5/menit, refresh 30/menit, pendaftaran PMB 10/menit. Di belakang reverse proxy, set `TRUST_PROXY` ke jumlah hop (mis. `1`) agar limit dan audit IP akurat |
| Role | `ADMIN` (semua akses), `EDITOR` (konten & berita), `OPERATOR` (PMB & galeri) |
| Proteksi admin | Akun admin aktif terakhir tidak dapat dihapus, diturunkan, atau dinonaktifkan; pengguna tidak dapat menghapus akunnya sendiri |
| Bootstrap admin | Hanya tersedia saat tabel `users` kosong |

---

## Arsitektur CI/CD

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Actions                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ci.yml (setiap push & PR)                        │   │
│  │  · contracts build → lint → audit:env             │   │
│  │  · prisma generate & validate                     │   │
│  │  · MySQL wait (2 fasa) → migrate → unit tests     │   │
│  │  · API smoke test → verify migrasi (riwayat/skema) │   │
│  │  · typecheck → build api → build web              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────┐  ┌───────────────────────────┐│
│  │ deploy-staging.yml   │  │ deploy-production.yml     ││
│  │ push → develop       │  │ push tag v*               ││
│  │ → POST webhook       │  │ → approval manual         ││
│  │ → aaPanel deploy     │  │ → POST webhook            ││
│  │                      │  │ → aaPanel deploy           ││
│  └──────────────────────┘  └───────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Peladen (aaPanel)                      │
│                                                          │
│  aaPanel Webhook → Script bash:                          │
│    git pull → pnpm install → db:migrate:deploy           │
│    → build contracts → build api → build web             │
│    → pm2 reload → curl health check                      │
│                                                          │
│  Nginx:                                                  │
│    /       → apps/web/dist (static)                      │
│    /v1/    → API NestJS :3000                            │
│    /media/ → API NestJS :3000                            │
└─────────────────────────────────────────────────────────┘
```

---

## Lisensi

Proprietary — hak cipta milik UNU Purwokerto.
