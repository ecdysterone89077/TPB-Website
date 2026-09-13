# AGENTS.md — TPB Monorepo UNU Purwokerto

Baca `CONSTRAINTS.md` sebelum menulis kode. Jangan melemahkan isinya agar perubahan lolos.

## TDD primer (satu keputusan)

Primer TDD repo ini adalah ECC **`tdd-workflow`** (pola RED-GREEN-REFACTOR, target
liputan baris berubah ≥ 80%); skill `test-driven-development` tidak dipakai agar
tidak dobel-trigger. Runner: `apps/api` = Jest (`pnpm --filter @tpb/api test`),
`apps/web` = Vitest (`pnpm --filter @tpb/web test`).

## Tiering review (anti dobel-trigger)

- **Default tiap keputusan non-trivial: `doubt-driven-development`**
  (satu review adversarial konteks-segar, murah).
- **`council` / `santa-method` hanya untuk high-stakes**, tidak pernah paralel
  dengan doubt pada artefak yang sama.
- Pemicu high-stakes: auth/keamanan, migrasi DB, hapus data, perubahan kontrak
  API publik (`packages/contracts`), deploy produksi.
- Standar kerja coding repo ini: `systematic-debugging` (reproduksi dulu) +
  `requesting-code-review` (review pre-commit sebelum commit).
