import { z } from "zod";
import { BlockSchema } from "./blocks.js";
import { PostInputSchema } from "./content.js";
import { NavItemInputSchema, PageInputSchema, PageStatusSchema, SiteSettingsSchema, maxNavDepth } from "./pages.js";

/**
 * Bundel konten situs (ekspor/impor penuh antar-environment).
 * Versi 1: settings + nav + semua halaman/blok + berita + daftar media (URL saja).
 */

export const SiteBundlePageSchema = PageInputSchema.extend({
  status: PageStatusSchema,
  blocks: z.array(BlockSchema).max(200),
});
export type SiteBundlePage = z.infer<typeof SiteBundlePageSchema>;

export const SiteBundlePostSchema = PostInputSchema.extend({
  slug: z.string().trim().min(1).max(220),
  date: z.string().datetime(),
});
export type SiteBundlePost = z.infer<typeof SiteBundlePostSchema>;

export const SiteBundleMediaSchema = z.object({
  url: z.string().trim().min(1).max(2000),
  filename: z.string().max(255).default(""),
  mimeType: z.string().max(120).default(""),
  size: z.number().int().min(0).default(0),
  alt: z.string().max(500).default(""),
});
export type SiteBundleMedia = z.infer<typeof SiteBundleMediaSchema>;

const addDuplicateSlugIssues = <T extends { slug: string }>(items: T[], ctx: z.RefinementCtx, path: (string | number)[]) => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.slug)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Slug ganda dalam bundel.", path: [...path, index, "slug"] });
    seen.add(item.slug);
  });
};

export const SiteBundleSchema = z
  .object({
    version: z.literal(1),
    exportedAt: z.string().datetime(),
    settings: SiteSettingsSchema.nullable(),
    nav: z.array(NavItemInputSchema).max(50),
    pages: z.array(SiteBundlePageSchema).max(200),
    posts: z.array(SiteBundlePostSchema).max(2000),
    media: z.array(SiteBundleMediaSchema).max(5000),
  })
  .superRefine((bundle, ctx) => {
    if (maxNavDepth(bundle.nav) > 3) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Kedalaman menu maksimal 3 tingkat.", path: ["nav"] });
    addDuplicateSlugIssues(bundle.pages, ctx, ["pages"]);
    addDuplicateSlugIssues(bundle.posts, ctx, ["posts"]);
  });
export type SiteBundle = z.infer<typeof SiteBundleSchema>;

export const ImportSummarySchema = z.object({
  pagesCreated: z.number().int().min(0),
  pagesUpdated: z.number().int().min(0),
  postsCreated: z.number().int().min(0),
  postsUpdated: z.number().int().min(0),
  settingsUpdated: z.number().int().min(0),
  navUpdated: z.number().int().min(0),
  mediaMissing: z.array(z.string().max(2000)).max(5000),
});
export type ImportSummary = z.infer<typeof ImportSummarySchema>;
