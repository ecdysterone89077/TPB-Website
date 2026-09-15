import { describe, expect, it } from "vitest";
import { BlockSchema, BlockTypeSchema } from "@tpb/contracts";
import { BLOCK_SPECS, GROUP_ORDER, blockLabel, specFor } from "./specs";

describe("spesifikasi blok", () => {
  it("setiap tipe blok punya spec, label, grup valid, dan default yang lolos validasi server", () => {
    for (const type of BlockTypeSchema.options) {
      const spec = specFor(type);
      expect(spec, `spec untuk ${type}`).toBeTruthy();
      expect(spec.label.length, `label ${type}`).toBeGreaterThan(0);
      expect(GROUP_ORDER, `grup ${type}`).toContain(spec.group);
      const parsed = BlockSchema.safeParse({ type, data: spec.defaults() });
      expect(parsed.success, `${type}: ${parsed.success ? "" : parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`).toBe(true);
    }
  });

  it("semua tipe terdaftar di specs dan label mudah dibaca", () => {
    expect(Object.keys(BLOCK_SPECS).sort()).toEqual([...BlockTypeSchema.options].sort());
    expect(blockLabel("dosen")).toContain("dosen");
    expect(blockLabel("richText")).toContain("Teks");
  });

  it("field custom array menunjuk editor yang tepat", () => {
    expect(specFor("marquee").fields[0].custom).toBe("arrayText");
    expect(specFor("stats").fields[0].custom).toBe("arrayMetrics");
    expect(specFor("table").fields[0].custom).toBe("table");
  });

  it("default data array memakai bentuk yang benar", () => {
    expect(Array.isArray(specFor("marquee").defaults())).toBe(true);
    expect(Array.isArray(specFor("stats").defaults())).toBe(true);
    expect(Array.isArray(specFor("hero").defaults())).toBe(false);
  });
});
