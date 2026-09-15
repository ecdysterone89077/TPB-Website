import { describe, expect, it } from "vitest";
import { DEFAULT_SYSTEM_TEXTS, resolveSystemTexts, systemTextsOverrides } from "./systemTexts";

describe("resolveSystemTexts", () => {
  it("tanpa texts memakai seluruh default", () => {
    expect(resolveSystemTexts(null)).toEqual(DEFAULT_SYSTEM_TEXTS);
    expect(resolveSystemTexts(undefined)).toEqual(DEFAULT_SYSTEM_TEXTS);
    expect(resolveSystemTexts({})).toEqual(DEFAULT_SYSTEM_TEXTS);
  });

  it("menimpa hanya field yang diisi (termasuk pmb bersarang)", () => {
    const resolved = resolveSystemTexts({ loading: "Menyiapkan…", pmb: { submitLabel: "Daftar" } });
    expect(resolved.loading).toBe("Menyiapkan…");
    expect(resolved.notFoundTitle).toBe(DEFAULT_SYSTEM_TEXTS.notFoundTitle);
    expect(resolved.pmb.submitLabel).toBe("Daftar");
    expect(resolved.pmb.cancelLabel).toBe(DEFAULT_SYSTEM_TEXTS.pmb.cancelLabel);
    expect(DEFAULT_SYSTEM_TEXTS.pmb.submitLabel).toBe("Kirim");
  });

  it("teks kosong/spasi dianggap tidak diisi, termasuk di dalam pmb", () => {
    const resolved = resolveSystemTexts({ loading: "   ", titleSuffix: "", pmb: { submitLabel: "  " } });
    expect(resolved.loading).toBe(DEFAULT_SYSTEM_TEXTS.loading);
    expect(resolved.titleSuffix).toBe(DEFAULT_SYSTEM_TEXTS.titleSuffix);
    expect(resolved.pmb.submitLabel).toBe(DEFAULT_SYSTEM_TEXTS.pmb.submitLabel);
  });

  it("kunci tak dikenal diabaikan", () => {
    const resolved = resolveSystemTexts({ loading: "A", catatan: "x" } as never);
    expect(resolved.loading).toBe("A");
    expect((resolved as unknown as Record<string, unknown>).catatan).toBeUndefined();
  });

  it("default tidak ikut bermutasi antar pemanggilan (termasuk pmb)", () => {
    const first = resolveSystemTexts({ loading: "A" });
    first.loading = "B";
    first.pmb.submitLabel = "X";
    expect(resolveSystemTexts(null).loading).toBe(DEFAULT_SYSTEM_TEXTS.loading);
    expect(resolveSystemTexts(null).pmb.submitLabel).toBe(DEFAULT_SYSTEM_TEXTS.pmb.submitLabel);
  });
});

describe("systemTextsOverrides", () => {
  it("nilai sama dengan bawaan tidak disimpan", () => {
    expect(systemTextsOverrides(DEFAULT_SYSTEM_TEXTS)).toBeUndefined();
  });

  it("hanya field yang berubah yang disimpan, termasuk pmb", () => {
    const values = { ...DEFAULT_SYSTEM_TEXTS, pmb: { ...DEFAULT_SYSTEM_TEXTS.pmb } };
    values.loading = "Menyiapkan…";
    values.pmb.submitLabel = "Daftar";
    expect(systemTextsOverrides(values)).toEqual({ loading: "Menyiapkan…", pmb: { submitLabel: "Daftar" } });
  });
});
