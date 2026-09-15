import type { Block, PageStatus, PublicPage } from "@tpb/contracts";

export type BlockRow = {
  id: string;
  type: string;
  position: number;
  data: unknown;
  isVisible: boolean;
  anchor: string | null;
};

export type PageRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
};

export function toBlock(row: BlockRow): Block {
  return {
    id: row.id,
    type: row.type,
    data: row.data,
    isVisible: row.isVisible,
    ...(row.anchor ? { anchor: row.anchor } : {}),
  } as Block;
}

export function toPublicPage(row: PageRow & { blocks: BlockRow[] }): PublicPage {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    ogImage: row.ogImage,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    blocks: row.blocks.filter((b) => b.isVisible).map(toBlock),
  };
}

export function toAdminPage(row: PageRow & { blocks: BlockRow[] }) {
  return { ...toPublicPage(row), status: row.status as PageStatus, blocks: row.blocks.map(toBlock) };
}

export function toPageSummary(row: PageRow & { blocks?: { id: string }[] }) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status as PageStatus,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    blockCount: row.blocks?.length,
  };
}
