import { describe, expect, it } from "vitest";
import { BlockSchema, type Block } from "@tpb/contracts";
import { humanizeServerError, validateBlocks } from "./validation";
import { specFor } from "./specs";

const heading = (text: string) => BlockSchema.parse({ type: "heading", data: { text, level: 2, align: "left" } }) as Block;

describe("validateBlocks", () => {
  it("meloloskan blok valid", () => {
    const result = validateBlocks([heading("Halo")]);
    expect(result.ok).toBe(true);
    expect(result.messages).toHaveLength(0);
  });

  it("menunjuk blok dan kolom dengan pesan Bahasa Indonesia", () => {
    const invalid = { type: "heading", data: { text: "", level: 2, align: "left" }, isVisible: true } as unknown as Block;
    const result = validateBlocks([heading("Aman"), invalid]);
    expect(result.ok).toBe(false);
    expect(result.errorIndexes.has(1)).toBe(true);
    expect(result.messages[0]).toContain("Judul #2");
    expect(result.messages[0]).toContain("Teks judul");
    expect(result.messages[0]).not.toMatch(/Required|String must/);
  });

  it("menerima data tabel di root blok (bukan terbungkus)", () => {
    const table = BlockSchema.parse({ type: "table", data: { headers: ["A"], rows: [["1"]] } }) as Block;
    expect(validateBlocks([table]).ok).toBe(true);
    const wrapped = { type: "table", data: { table: { headers: ["A"], rows: [["1"]] } }, isVisible: true } as unknown as Block;
    expect(validateBlocks([wrapped]).ok).toBe(false);
  });
});

describe("humanizeServerError", () => {
  it("mengubah path blocks.N menjadi label blok", () => {
    const blocks = [heading("A"), specFor("dosen") && BlockSchema.parse({ type: "dosen", data: specFor("dosen").defaults() }) as Block];
    const message = humanizeServerError("Data tidak valid. blocks.1.data.people.0.name: Required", blocks);
    expect(message).toContain("Daftar dosen #2");
    expect(message).not.toContain("blocks.1");
  });
});
