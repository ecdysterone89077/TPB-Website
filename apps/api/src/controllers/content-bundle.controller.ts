import { BadRequestException, Body, ConflictException, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { PageRevisionDataSchema, SiteBundleSchema, SiteSettingsSchema, type Block, type ImportSummary } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, type RequestUser } from "../auth";
import { parse } from "../zod";
import { sanitizeBlock } from "../sanitize";
import { buildNavTree, countNavTree, createNavTree } from "../nav.util";

type AuthRequest = Request & { user?: RequestUser };

const SETTINGS_KEY = "main";

// MySQL menormalkan urutan key JSON, jadi perbandingan snapshot harus kanonik.
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

// Snapshot terbit dari panel menyimpan id blok; impor tidak. Abaikan id saat membandingkan.
const withoutBlockIds = (value: unknown): unknown => {
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

@Controller("admin/content")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class ContentBundleController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("export")
  async export() {
    const [settingsRow, navRows, pages, posts, media] = await Promise.all([
      this.prisma.siteSetting.findUnique({ where: { key: SETTINGS_KEY } }),
      this.prisma.navItem.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] }),
      this.prisma.page.findMany({ orderBy: [{ slug: "asc" }], include: { blocks: { orderBy: [{ position: "asc" }, { id: "asc" }] } } }),
      this.prisma.post.findMany({ where: { deletedAt: null }, orderBy: [{ date: "asc" }, { id: "asc" }] }),
      this.prisma.mediaAsset.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    ]);

    const parsedSettings = settingsRow ? SiteSettingsSchema.safeParse(settingsRow.data) : null;
    if (settingsRow && !parsedSettings?.success) {
      throw new BadRequestException("Pengaturan situs tersimpan tidak valid — perbaiki di Pengaturan Situs sebelum mengekspor.");
    }
    const exportBlock = (block: { type: string; data: unknown; isVisible: boolean; anchor?: string | null }) => ({
      type: block.type,
      data: block.data,
      isVisible: block.isVisible,
      ...(block.anchor ? { anchor: block.anchor } : {}),
    });
    const bundle = {
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      settings: parsedSettings?.success ? parsedSettings.data : null,
      nav: buildNavTree(navRows),
      pages: pages.map((page) => {
        const published = page.status === "published" ? PageRevisionDataSchema.safeParse(page.publishedData) : null;
        return {
          title: page.title,
          slug: page.slug,
          seoTitle: page.seoTitle ?? "",
          seoDescription: page.seoDescription ?? "",
          ...(page.ogImage ? { ogImage: page.ogImage } : {}),
          status: page.status,
          blocks: (page.blocks.length ? page.blocks : published?.success ? published.data.blocks : []).map(exportBlock),
        };
      }),
      posts: posts.map((post) => ({
        slug: post.slug,
        title: post.title,
        category: post.category,
        excerpt: post.excerpt ?? "",
        content: post.content,
        image: post.image,
        readTime: post.readTime ?? "",
        status: post.status,
        date: post.date.toISOString(),
      })),
      media: media.map((item) => ({ url: item.url, filename: item.filename, mimeType: item.mimeType, size: item.size, alt: item.alt ?? "" })),
    };
    return { bundle: parse(SiteBundleSchema, bundle) };
  }

  @Post("import")
  async import(@Body() body: unknown, @Req() req: AuthRequest) {
    const bundle = parse(SiteBundleSchema, body);
    const userId = req.user?.id ?? null;

    let summary: ImportSummary;
    try {
      summary = await this.prisma.$transaction(
        async (tx) => {
          const result: ImportSummary = { pagesCreated: 0, pagesUpdated: 0, postsCreated: 0, postsUpdated: 0, settingsUpdated: 0, navUpdated: 0, mediaMissing: [] };

          if (bundle.settings) {
            await tx.siteSetting.upsert({
              where: { key: SETTINGS_KEY },
              create: { key: SETTINGS_KEY, data: bundle.settings as any, updatedBy: userId },
              update: { data: bundle.settings as any, updatedBy: userId },
            });
            result.settingsUpdated = 1;
          }

          await tx.navItem.deleteMany();
          await createNavTree(tx, bundle.nav, null);
          result.navUpdated = countNavTree(bundle.nav);

          for (const input of bundle.pages) {
            if (input.status === "published" && input.blocks.length === 0) {
              throw new BadRequestException(`Halaman "${input.title}" berstatus terbit tanpa blok — impor dibatalkan.`);
            }
            const existing = await tx.page.findUnique({ where: { slug: input.slug } });
            const blocks = input.blocks
              .map(sanitizeBlock)
              .map((clean) => ({
                type: clean.type,
                data: clean.data,
                isVisible: clean.isVisible,
                ...(clean.anchor ? { anchor: clean.anchor } : {}),
              }) as Block);
            const snapshot = input.status === "published"
              ? PageRevisionDataSchema.parse({
                  page: { title: input.title, slug: input.slug, seoTitle: input.seoTitle ?? "", seoDescription: input.seoDescription ?? "", ogImage: input.ogImage ?? null },
                  blocks,
                })
              : null;
            const unchangedPublished = snapshot !== null
              && existing !== null
              && canonicalJson(withoutBlockIds(existing.publishedData)) === canonicalJson(withoutBlockIds(snapshot));
            const data = {
              title: input.title,
              seoTitle: input.seoTitle || null,
              seoDescription: input.seoDescription || null,
              ogImage: input.ogImage ?? null,
              status: input.status,
              updatedBy: userId,
              ...(snapshot && !unchangedPublished ? { publishedAt: new Date(), publishedData: snapshot as any } : {}),
            };

            let pageId: string;
            if (existing) {
              await tx.page.update({ where: { id: existing.id }, data });
              pageId = existing.id;
              result.pagesUpdated += 1;
            } else {
              const created = await tx.page.create({ data: { ...data, slug: input.slug, createdBy: userId } });
              pageId = created.id;
              result.pagesCreated += 1;
            }

            await tx.block.deleteMany({ where: { pageId } });
            for (let position = 0; position < blocks.length; position++) {
              const block = blocks[position];
              await tx.block.create({ data: { pageId, type: block.type, position, data: block.data as any, isVisible: block.isVisible, anchor: block.anchor ?? null } });
            }

            if (snapshot && !unchangedPublished) await tx.pageRevision.create({ data: { pageId, data: snapshot as any, createdBy: userId } });
          }

          for (const input of bundle.posts) {
            const existing = await tx.post.findUnique({ where: { slug: input.slug } });
            const data = {
              title: input.title,
              category: input.category,
              excerpt: input.excerpt ?? "",
              content: input.content ?? null,
              image: input.image ?? null,
              readTime: input.readTime ?? "",
              status: input.status ?? "draft",
              date: new Date(input.date),
            };
            if (existing) {
              await tx.post.update({ where: { id: existing.id }, data: { ...data, deletedAt: null } });
              result.postsUpdated += 1;
            } else {
              await tx.post.create({ data: { ...data, slug: input.slug, authorId: userId } });
              result.postsCreated += 1;
            }
          }

          const known = new Set((await tx.mediaAsset.findMany({ select: { url: true } })).map((item) => item.url));
          const seen = new Set<string>();
          const missingRows = bundle.media.filter((item) => {
            if (!item.url.startsWith("/") || known.has(item.url) || seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
          });
          result.mediaMissing = missingRows.map((item) => item.url);
          if (missingRows.length) {
            await tx.mediaAsset.createMany({
              data: missingRows.map((item) => ({
                url: item.url,
                filename: (item.filename || item.url.split("/").pop() || item.url).slice(0, 255),
                mimeType: item.mimeType.slice(0, 120),
                size: item.size,
                alt: item.alt ? item.alt.slice(0, 500) : null,
              })),
            });
          }

          return result;
        },
        { timeout: 60000, maxWait: 10000 },
      );
    } catch (error: any) {
      if (error?.code === "P2002") throw new ConflictException("Impor bentrok dengan data lain (slug ganda). Coba lagi.");
      throw error;
    }

    return { summary };
  }
}
