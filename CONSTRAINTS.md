# Constraints — TPB Monorepo UNU Purwokerto

Last reviewed: 2026-09-13 by owner.
Mode: **WARN semua**. Tidak ada check yang memblokir kerja agen;
setiap pelanggaran dilaporkan dan dicatat. Eskalasi ke block diputuskan terpisah.
Budget waktu: check akhir tugas ≤ 90 detik; tanpa batas di CI.

Preview URL (satu-satunya URL untuk gate perf/a11y):
`http://localhost:4173/` — hasil `vite preview --port 4173 --strictPort`
dari production build. Alasan: build prod yang diukur, bukan dev server.

## Floor (selalu berlaku, tanpa setup)

- Tanpa komentar supresi baru: `@ts-ignore`, `eslint-disable`, `istanbul ignore`,
  `Stryker disable`, `nosemgrep`, `gitleaks:allow`
- Tanpa stub belum diimplementasi: `throw new Error("Not implemented")`, `catch {}` kosong
- Tanpa skip/hapus test tanpa alasan di commit message
- Tanpa secret di source
- File ini tidak dilemahkan agar perubahan lolos

## Ditegakkan dengan angka (mode warn)

| Dimensi | Aturan | Diperiksa oleh | Jalan di |
|---|---|---|---|
| Types | Nol type error | `pnpm -r typecheck` | tiap edit |
| Lint | Nol error dari config repo | `pnpm lint` | tiap edit |
| Secrets/env | Lolos audit repo | `pnpm audit:env` | CI + akhir tugas |
| Coverage (baris berubah) | ≥ 80% (alasan: cukup tinggi untuk memaksa test, cukup rendah untuk baris config) | `jest --coverage` (API) / `vitest run --coverage` (web) + `git diff`, tanpa run suite 2x | akhir tugas, CI |
| Security: code | Nol temuan high | `semgrep scan --config p/default --config p/owasp-top-ten <file berubah>` (semgrep 1.177.0; butuh Python312 Scripts di PATH, shell baru) | akhir tugas (scope diff), CI |
| Security: deps | Tidak ada high ke atas | `osv-scanner scan source -r .` (osv-scanner 2.5.1) | CI |
| Performance | LCP ≤ 2500ms, CLS ≤ 0.1 (ambang "good" Core Web Vitals) | `lighthouse $PREVIEW_URL --output=json --quiet --only-categories=performance,accessibility` (lighthouse 13) | preview deploy |
| Accessibility | Nol pelanggaran critical/serious | audit accessibility lighthouse yang sama (axe-core tertanam). Alasan: `@axe-core/cli` butuh chromedriver seversi Chrome (Chrome 152 vs driver 153) sehingga tidak jalan; lighthouse memakai axe-core yang sama | preview deploy |

## Terukur, belum ditegakkan (ratchet: tidak boleh turun, toleransi 0.5%)

Diperbarui 2026-09-15 (angka) setelah PR #7–#12 (navigasi otomatis, bundel konten,
tautan dokumen & teks sistem, hardening deploy, panel ramah pemula, optimasi performa
+ dependensi); pengukuran ulang pada checkout ini. **Menunggu review owner.**
Target dan ambang tidak diubah.

| Metrik | Hari ini (2026-09-15) | Arah |
|---|---|---|
| Coverage proyek API (lines) | 89.6% (`jest --coverage`, 181 test lolos, ~20 dtk) | tidak boleh turun |
| Coverage proyek web (lines) | 59.3% (`vitest run --coverage`, 135 test lolos, ~25 dtk) | tidak boleh turun |
| Bundle web (main JS) | 277.99 kB (gzip 84.90 kB) — chunk `HeavyBlocks` 13.19 kB dimuat setelah paint pertama, chunk admin terpisah (lazy); **di bawah baseline 284.2 kB (temuan ratchet PR #7–#9 tertutup)** | tidak boleh tumbuh |
| Typecheck + lint | lolos semua paket | harus tetap lolos |
| Floor scan (supresi/stub/skip) | bersih | harus tetap bersih |
| LCP halaman utama | ~2443ms (median 5 run lighthouse mobile pada preview 4173, rentang 2333–2445ms; FCP ~1.4 dtk, TBT ~80ms, CLS 0) — **memenuhi target ≤2500ms** | turun ke ≤ 2500ms |
| A11y halaman utama | 0 temuan critical/serious (skor 100, 5 run) | nol critical/serious |

Catatan LCP: perbaikan datang dari render bertahap 28 blok (header/hero dulu),
code-split komponen blok berat (`HeavyBlocks`), dan kompresi gzip respons API.
Baseline lama 2782ms diukur pada situs 1-endpoint `GET /v1/content`; kandidat
perbaikan lanjutan bila perlu: gambar hero dari `MEDIA_DIR` dan/atau prerender rute
utama. Catatan metodologi: run pertama setelah mesin idle bisa lebih tinggi
(cold start); median run stabil dipakai sesuai aturan.

Temuan WARN terbuka: tidak ada. Kenaikan bundle main (PR #7–#9) sudah tertutup
(277.99 kB < baseline) dan LCP memenuhi target. Temuan `osv-scanner` sudah nol
(lihat bagian di bawah).

## Temuan osv-scanner — SELESAI (2026-09-15)

Awalnya 21 temuan (14 high): `multer` 1.4.5-lts.2, `deepmerge-ts` 7.1.5,
`qs` 6.15.3, `sanitize-html` 2.13.1. Ditutup lewat upgrade, bukan pengecualian:

- `express` 4.21.2 → 5.2.1 (menyelaraskan dengan `@nestjs/platform-express` 11,
  menghilangkan `qs` 6.15.3).
- `multer` → ^2.3.0 (langsung) + override `pnpm.overrides` untuk pin Nest 2.2.0;
  upload media diverifikasi E2E.
- `sanitize-html` 2.13.1 → 2.17.7 (CVE XSS); ESM `htmlparser2` ditangani lewat
  `transformIgnorePatterns` Jest; sanitasi diverifikasi E2E.
- `deepmerge-ts` 7.1.5 → 8.0.2 via override (dipakai `@prisma/config`);
  `prisma validate` + `prisma generate` diverifikasi.

Hasil pemindaian ulang: **0 temuan** (`osv-scanner scan source -r .`).

## Pengecualian

| ID | Aturan | Path | Alasan | Owner | Kedaluwarsa |
|---|---|---|---|---|---|
| _(kosong)_ | | | | | |

Pengecualian baru butuh owner + tanggal; tanpa keduanya = temuan saat review.
