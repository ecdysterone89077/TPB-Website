import type { Prisma } from "@prisma/client";
import type { NavItemInput } from "@tpb/contracts";

export type NavRow = { id: string; parentId: string | null; label: string; href: string; openInNewTab: boolean; position: number };

export const buildNavTree = (rows: NavRow[]): NavItemInput[] => {
  const byParent = new Map<string | null, NavRow[]>();
  for (const row of rows) {
    const list = byParent.get(row.parentId) ?? [];
    list.push(row);
    byParent.set(row.parentId, list);
  }
  const build = (parentId: string | null): NavItemInput[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((row) => {
        const children = build(row.id);
        return {
          label: row.label,
          href: row.href,
          openInNewTab: row.openInNewTab,
          ...(children.length ? { children } : {}),
        };
      });
  return build(null);
};

export const countNavTree = (nodes: NavItemInput[]): number =>
  nodes.reduce((total, node) => total + 1 + countNavTree(node.children ?? []), 0);

export async function createNavTree(tx: Prisma.TransactionClient, nodes: NavItemInput[], parentId: string | null): Promise<void> {
  for (let position = 0; position < nodes.length; position++) {
    const node = nodes[position];
    const created = await tx.navItem.create({
      data: { parentId, label: node.label, href: node.href, openInNewTab: node.openInNewTab ?? false, position },
    });
    if (node.children?.length) await createNavTree(tx, node.children, created.id);
  }
}
