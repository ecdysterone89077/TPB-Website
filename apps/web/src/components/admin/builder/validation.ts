import { BlocksSchema, type Block } from "@tpb/contracts";
import { specFor } from "./specs";

export type ValidationResult = { ok: boolean; messages: string[]; errorIndexes: Set<number> };

type Issue = { code: string; message: string; path: (string | number)[]; minimum?: number | bigint; maximum?: number | bigint };

const describeIssue = (issue: Issue): string => {
  switch (issue.code) {
    case "invalid_type":
      return "wajib diisi";
    case "too_small":
      return `terlalu pendek (minimal ${issue.minimum ?? 1})`;
    case "too_big":
      return `terlalu panjang (maksimal ${issue.maximum ?? ""})`;
    case "invalid_union":
      return "belum sesuai format";
    case "invalid_string":
      return "format tidak sesuai";
    case "invalid_enum_value":
    case "invalid_literal":
      return "pilihan tidak valid";
    default:
      return issue.message;
  }
};

const fieldLabelFor = (block: Block, path: (string | number)[]): string => {
  const [first, ...rest] = path;
  if (typeof first !== "string") return "";
  const field = specFor(block.type).fields.find((item) => item.key === first);
  const head = field?.label ?? first;
  return [head, ...rest].join(".");
};

/** Validasi blok di sisi klien dengan pesan Bahasa Indonesia yang menunjuk blok & kolom. */
export function validateBlocks(blocks: Block[]): ValidationResult {
  const parsed = BlocksSchema.safeParse(blocks);
  if (parsed.success) return { ok: true, messages: [], errorIndexes: new Set() };

  const errorIndexes = new Set<number>();
  const issues = parsed.error.issues as Issue[];
  const messages = issues.slice(0, 5).map((issue) => {
    const index = typeof issue.path[0] === "number" ? issue.path[0] : -1;
    const block = index >= 0 ? blocks[index] : undefined;
    if (index >= 0) errorIndexes.add(index);
    const label = block ? specFor(block.type).label : "Blok";
    const fieldPath = block ? fieldLabelFor(block, issue.path.slice(2)) : issue.path.slice(2).join(".");
    const detail = issue.code === "custom" ? issue.message : describeIssue(issue);
    return `${label} #${index + 1}${fieldPath ? ` (${fieldPath})` : ""}: ${detail}`;
  });
  return { ok: false, messages, errorIndexes };
}

/** Ubah pesan error server (mis. `blocks.3.data.title: Required`) menjadi label blok yang mudah dibaca. */
export function humanizeServerError(message: string, blocks: Block[]): string {
  return message.replace(/blocks\.(\d+)\.(?:data\.)?/g, (_, raw: string) => {
    const index = Number(raw);
    const block = blocks[index];
    const label = block ? specFor(block.type).label : "Blok";
    const suffix = block ? " → " : " ";
    return `${label} #${index + 1}${suffix}`;
  });
}
