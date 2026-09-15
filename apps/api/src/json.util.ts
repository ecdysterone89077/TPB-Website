export const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

export const withoutBlockIds = (value: unknown): unknown => {
  if (!value || typeof value !== "object") return value;
  const snapshot = value as { blocks?: unknown[] };
  if (!Array.isArray(snapshot.blocks)) return value;
  return {
    ...snapshot,
    blocks: snapshot.blocks.map((block) => {
      if (!block || typeof block !== "object") return block;
      const entries = Object.entries(block as Record<string, unknown>).filter(([key]) => key !== "id");
      return Object.fromEntries(entries);
    }),
  };
};

export const samePublishedSnapshot = (publishedData: unknown, snapshot: unknown): boolean =>
  canonicalJson(withoutBlockIds(publishedData)) === canonicalJson(withoutBlockIds(snapshot));
