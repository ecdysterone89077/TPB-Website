import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { PageBlocksSchema, PageInputSchema, PageRevisionDataSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, type RequestUser } from "../auth";
import { parse } from "../zod";
import { parsePagination, paginationMeta } from "../pagination";
import { sanitizeBlock } from "../sanitize";
import { samePublishedSnapshot } from "../json.util";
import { toAdminPage, toBlock, toPageSummary } from "../pages.util";

type AuthRequest = Request & { user?: RequestUser };

@Controller("admin/pages")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN", "EDITOR")
export class AdminPagesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const [rows, total] = await Promise.all([
      this.prisma.page.findMany({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: pagination.offset,
        take: pagination.limit,
        include: { blocks: { select: { id: true } } },
      }),
      this.prisma.page.count(),
    ]);
    return { pages: rows.map(toPageSummary), pagination: paginationMeta(pagination, total) };
  }

  @Post()
  async create(@Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(PageInputSchema, body);
    try {
      const page = await this.prisma.page.create({
        data: {
          slug: input.slug,
          title: input.title,
          seoTitle: input.seoTitle || null,
          seoDescription: input.seoDescription || null,
          ogImage: input.ogImage ?? null,
          createdBy: req.user?.id ?? null,
          updatedBy: req.user?.id ?? null,
        },
        include: { blocks: true },
      });
      return { page: toAdminPage(page) };
    } catch (error: any) {
      if (error?.code === "P2002") throw new ConflictException("Slug sudah dipakai halaman lain.");
      throw error;
    }
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const page = await this.prisma.page.findUnique({ where: { id }, include: { blocks: { orderBy: [{ position: "asc" }, { id: "asc" }] } } });
    if (!page) throw new NotFoundException("Halaman tidak ditemukan.");
    return { page: toAdminPage(page) };
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: unknown, @Req() req: AuthRequest) {
    const input = parse(PageInputSchema, body);
    const existing = await this.prisma.page.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Halaman tidak ditemukan.");
    try {
      const page = await this.prisma.page.update({
        where: { id },
        data: {
          slug: input.slug,
          title: input.title,
          seoTitle: input.seoTitle || null,
          seoDescription: input.seoDescription || null,
          ogImage: input.ogImage ?? null,
          updatedBy: req.user?.id ?? null,
        },
        include: { blocks: { orderBy: [{ position: "asc" }, { id: "asc" }] } },
      });
      return { page: toAdminPage(page) };
    } catch (error: any) {
      if (error?.code === "P2002") throw new ConflictException("Slug sudah dipakai halaman lain.");
      throw error;
    }
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const existing = await this.prisma.page.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Halaman tidak ditemukan.");
    await this.prisma.page.delete({ where: { id } });
    return { ok: true };
  }

  @Put(":id/blocks")
  async saveBlocks(@Param("id") id: string, @Body() body: unknown, @Req() req: AuthRequest) {
    const { blocks } = parse(PageBlocksSchema, body);
    const sanitized = blocks.map(sanitizeBlock);
    const existing = await this.prisma.page.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Halaman tidak ditemukan.");

    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.block.findMany({ where: { pageId: id }, select: { id: true } });
      const known = new Set(rows.map((b) => b.id));
      const keep = sanitized.map((b) => b.id).filter((bid): bid is string => !!bid && known.has(bid));
      await tx.block.deleteMany({ where: { pageId: id, id: { notIn: keep } } });
      for (let position = 0; position < sanitized.length; position++) {
        const block = sanitized[position];
        const data = { type: block.type, position, data: block.data as any, isVisible: block.isVisible, anchor: block.anchor ?? null };
        if (block.id && known.has(block.id)) await tx.block.update({ where: { id: block.id }, data });
        else await tx.block.create({ data: { ...data, pageId: id } });
      }
      await tx.page.update({ where: { id }, data: { updatedBy: req.user?.id ?? null } });
    });

    const rows = await this.prisma.block.findMany({ where: { pageId: id }, orderBy: [{ position: "asc" }, { id: "asc" }] });
    return { blocks: rows.map(toBlock) };
  }

  @Post(":id/publish")
  async publish(@Param("id") id: string, @Req() req: AuthRequest) {
    const result = await this.prisma.$transaction(async (tx) => {
      const page = await tx.page.findUnique({ where: { id }, include: { blocks: { orderBy: [{ position: "asc" }, { id: "asc" }] } } });
      if (!page) throw new NotFoundException("Halaman tidak ditemukan.");
      if (!page.blocks.length) throw new BadRequestException("Halaman tanpa blok tidak dapat diterbitkan.");
      const snapshot = PageRevisionDataSchema.parse({
        page: { title: page.title, slug: page.slug, seoTitle: page.seoTitle ?? "", seoDescription: page.seoDescription ?? "", ogImage: page.ogImage ?? null },
        blocks: page.blocks.map(toBlock).map(sanitizeBlock),
      });
      const unchanged = page.status === "published" && samePublishedSnapshot(page.publishedData, snapshot);
      const updated = await tx.page.update({
        where: { id },
        data: { status: "published", ...(unchanged ? {} : { publishedAt: new Date(), publishedData: snapshot as any }), updatedBy: req.user?.id ?? null },
      });
      if (!unchanged) await tx.pageRevision.create({ data: { pageId: id, data: snapshot as any, createdBy: req.user?.id ?? null } });
      return updated;
    });
    return { page: toPageSummary({ ...result, blocks: [] }) };
  }

  @Post(":id/unpublish")
  async unpublish(@Param("id") id: string, @Req() req: AuthRequest) {
    const existing = await this.prisma.page.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Halaman tidak ditemukan.");
    const page = await this.prisma.page.update({ where: { id }, data: { status: "draft", updatedBy: req.user?.id ?? null } });
    return { page: toPageSummary({ ...page, blocks: [] }) };
  }

  @Get(":id/revisions")
  async revisions(@Param("id") id: string) {
    const rows = await this.prisma.pageRevision.findMany({ where: { pageId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30 });
    return {
      revisions: rows.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), createdBy: r.createdBy, data: r.data })),
    };
  }

  @Post(":id/revisions/:revisionId/restore")
  async restore(@Param("id") id: string, @Param("revisionId") revisionId: string, @Req() req: AuthRequest) {
    const revision = await this.prisma.pageRevision.findFirst({ where: { id: revisionId, pageId: id } });
    if (!revision) throw new NotFoundException("Revisi tidak ditemukan.");
    const snapshot = parse(PageRevisionDataSchema, revision.data);

    try {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.page.findUnique({ where: { id }, include: { blocks: { orderBy: [{ position: "asc" }, { id: "asc" }] } } });
        if (!current) throw new NotFoundException("Halaman tidak ditemukan.");
        const before = PageRevisionDataSchema.parse({
          page: { title: current.title, slug: current.slug, seoTitle: current.seoTitle ?? "", seoDescription: current.seoDescription ?? "", ogImage: current.ogImage ?? null },
          blocks: current.blocks.map(toBlock),
        });
        await tx.pageRevision.create({ data: { pageId: id, data: before as any, createdBy: req.user?.id ?? null } });
        await tx.page.update({
          where: { id },
          data: {
            title: snapshot.page.title,
            slug: snapshot.page.slug,
            seoTitle: snapshot.page.seoTitle || null,
            seoDescription: snapshot.page.seoDescription || null,
            ogImage: snapshot.page.ogImage ?? null,
            status: "draft",
            updatedBy: req.user?.id ?? null,
          },
        });
        await tx.block.deleteMany({ where: { pageId: id } });
        for (let position = 0; position < snapshot.blocks.length; position++) {
          const block = sanitizeBlock(snapshot.blocks[position]);
          await tx.block.create({
            data: { pageId: id, type: block.type, position, data: block.data as any, isVisible: block.isVisible, anchor: block.anchor ?? null },
          });
        }
      });
    } catch (error: any) {
      if (error?.code === "P2002") throw new ConflictException("Slug revisi sudah dipakai halaman lain.");
      throw error;
    }

    const page = await this.prisma.page.findUnique({ where: { id }, include: { blocks: { orderBy: [{ position: "asc" }, { id: "asc" }] } } });
    return { page: toAdminPage(page!) };
  }
}
