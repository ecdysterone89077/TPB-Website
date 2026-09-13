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

| Metrik | Hari ini (2026-09-13) | Arah |
|---|---|---|
| Coverage proyek API (lines) | 75.2% (`jest --coverage`, 32 test lolos, ~26 dtk) | tidak boleh turun |
| Coverage proyek web (lines) | 8.4% (vitest 5 + jsdom + RTL, 3 test lolos, ~3 dtk) | tidak boleh turun |
| Bundle web (main JS) | 345.7 kB (gzip 98.2 kB) | tidak boleh tumbuh |
| Typecheck + lint | lolos semua paket | harus tetap lolos |
| Floor scan (supresi/stub/skip) | bersih | harus tetap bersih |
| LCP halaman utama | 2782ms (skor perf 0.95) | turun ke ≤ 2500ms |
| A11y halaman utama | 2 temuan: `color-contrast` (1 node `p.text-red-600`), `landmark-one-main` hilang (skor 0.85) | nol critical/serious |

## Temuan awal osv-scanner (warn, perbaikan terpisah — bukan pengecualian)

14 high dari `pnpm-lock.yaml`: `multer` 1.4.5-lts.2 (fix 2.x, breaking),
`deepmerge-ts` 7.1.5 (fix 8.0.0), `qs` 6.15.3 (fix 6.16.0). Butuh keputusan
owner sebelum upgrade; tidak ditutup sebagai exception tanpa owner + tanggal.

## Pengecualian

| ID | Aturan | Path | Alasan | Owner | Kedaluwarsa |
|---|---|---|---|---|---|
| _(kosong)_ | | | | | |

Pengecualian baru butuh owner + tanggal; tanpa keduanya = temuan saat review.
