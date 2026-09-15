import { z } from "zod";
import { BlockSchema, MediaRefSchema, isSafeHref } from "./blocks.js";
import { SiteContentSchema } from "./content.js";

/* ------------------------------------------------------------------ halaman */

export const PageStatusSchema = z.enum(["draft", "published"]);
export type PageStatus = z.infer<typeof PageStatusSchema>;

export const SlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "Slug hanya huruf kecil, angka, dan tanda hubung." });

export const PageInputSchema = z.object({
  title: z.string().trim().min(1).max(220),
  slug: SlugSchema,
  seoTitle: z.string().max(220).optional().default(""),
  seoDescription: z.string().max(500).optional().default(""),
  ogImage: MediaRefSchema.optional(),
});
export type PageInput = z.infer<typeof PageInputSchema>;

export const PageBlocksSchema = z
  .object({ blocks: z.array(BlockSchema).max(200) })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const [index, block] of value.blocks.entries()) {
      if (!block.id) continue;
      if (seen.has(block.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "id blok duplikat dalam satu halaman.", path: ["blocks", index, "id"] });
      seen.add(block.id);
    }
  });
export type PageBlocks = z.infer<typeof PageBlocksSchema>;

export type PageSummary = {
  id: string;
  slug: string;
  title: string;
  status: PageStatus;
  publishedAt: string | null;
  updatedAt: string;
};

export type PublicPage = {
  id: string;
  slug: string;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
  publishedAt: string | null;
  updatedAt: string;
  blocks: z.infer<typeof BlockSchema>[];
};

export type PageRevisionEntry = {
  id: string;
  createdAt: string;
  createdBy: string | null;
  data: { page: PageInput; blocks: z.infer<typeof BlockSchema>[] };
};

export const PageRevisionDataSchema = z.object({
  page: PageInputSchema,
  blocks: z.array(BlockSchema).max(200),
});

/* ------------------------------------------------------------------- menu */

export type NavItemInput = {
  label: string;
  href: string;
  openInNewTab?: boolean;
  children?: NavItemInput[];
};

export const NavItemInputSchema: z.ZodType<NavItemInput> = z.lazy(() =>
  z.object({
    label: z.string().trim().min(1).max(160),
    href: z.string().trim().min(1).max(2000).refine(isSafeHref, { message: "Tautan menu harus http(s), path absolut, anchor #, mailto:, atau tel:." }),
    openInNewTab: z.boolean().optional().default(false),
    children: z.array(NavItemInputSchema).max(30).optional(),
  }),
);

const maxNavDepth = (nodes: NavItemInput[], depth = 1): number =>
  nodes.reduce((max, node) => Math.max(max, node.children?.length ? maxNavDepth(node.children, depth + 1) : depth), depth);

export const NavigationInputSchema = z
  .object({ items: z.array(NavItemInputSchema).max(50) })
  .superRefine((value, ctx) => {
    if (maxNavDepth(value.items) > 3) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Kedalaman menu maksimal 3 tingkat.", path: ["items"] });
  });
export type NavigationInput = z.infer<typeof NavigationInputSchema>;

export type NavRecord = {
  id: string;
  parentId: string | null;
  label: string;
  href: string;
  openInNewTab: boolean;
  position: number;
};

/* -------------------------------------------------------------- pengaturan */

export const SiteSettingsSchema = z.object({
  brand: SiteContentSchema.shape.brand,
  footer: SiteContentSchema.shape.footer,
  pmbLink: SiteContentSchema.shape.pmbLink,
});
export type SiteSettings = z.infer<typeof SiteSettingsSchema>;
