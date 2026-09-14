import { Body, Controller, Get, Put, Req, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ContentSchema, SiteContentSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, RequestUser } from "../auth";
import { parse } from "../zod";

type CookieRequest = Request & { user?: RequestUser };

@Controller("content")
export class ContentController {
  constructor(private readonly prisma: PrismaService) {}

  // Public: returns {content} where content may be null (belum dikonfigurasi).
  // Validates stored data against SiteContentSchema before returning.
  // Opsi B: baca dari site_modules (per-modul) dulu, aggregator, fallback ke legacy site_content.
  @Get()
  async get() {
    // Coba modular dulu
    const modules = await this.prisma.siteModule.findMany();
    if (modules.length > 0) {
      const data = Object.fromEntries(modules.map((m) => [m.key, m.data])) as Record<string, unknown>;
      // Jika modul belum lengkap (mis. baru sebagian), fallback ke legacy untuk melengkapi
      if (Object.keys(data).length >= 19) {
        const result = SiteContentSchema.safeParse(data);
        if (!result.success) {
          throw new ServiceUnavailableException("Konten modular tidak valid.");
        }
        return { content: result.data };
      }
      // Jika belum lengkap, coba gabung dengan legacy
      const legacy = await this.prisma.siteContent.findUnique({ where: { key: "main" } });
      const legacyData = (legacy?.data as Record<string, unknown> | null) ?? {};
      const merged = { ...legacyData, ...data };
      if (Object.keys(merged).length > 0) {
        const result = SiteContentSchema.safeParse(merged);
        if (result.success) return { content: result.data };
      }
    }
    const row = await this.prisma.siteContent.findUnique({ where: { key: "main" } });
    const data = row?.data ?? null;
    if (data === null) return { content: null };

    const result = SiteContentSchema.safeParse(data);
    if (!result.success) {
      throw new ServiceUnavailableException("Konten situs tersimpan tidak valid.");
    }

    return { content: result.data };
  }

  // Only ADMIN may replace the public site content (navigation, branding, copy).
  // Deprecated: tetap ada untuk kompat, tapi log warning — gunakan PUT /v1/<modul> per modul.
  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async save(@Body() body: unknown, @Req() req: CookieRequest) {
    // eslint-disable-next-line no-console
    console.warn("[DEPRECATED] PUT /v1/content — gunakan PUT /v1/<modul> per modul");
    const { content } = parse(ContentSchema, body);
    const saved = await this.prisma.siteContent.upsert({
      where: { key: "main" },
      create: { key: "main", data: content as any, updatedBy: req.user?.id ?? null },
      update: { data: content as any, updatedBy: req.user?.id ?? null },
    });
    // Sync juga ke site_modules agar aggregator konsisten
    const data = content as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      await this.prisma.siteModule.upsert({
        where: { key },
        create: { key, data: value as any, updatedBy: req.user?.id ?? null },
        update: { data: value as any, updatedBy: req.user?.id ?? null },
      });
    }
    return { content: saved.data, updatedAt: saved.updatedAt };
  }
}
