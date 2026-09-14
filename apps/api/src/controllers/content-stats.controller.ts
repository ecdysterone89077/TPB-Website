import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { StatsContentSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, RequestUser } from "../auth";
import { parse } from "../zod";

type CookieRequest = Request & { user?: RequestUser };

// SiteContent.stats (hero stats) — beda dengan /v1/stats (site_stats table)
@Controller("content-stats")
export class ContentStatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get() {
    const row = await this.prisma.siteModule.findUnique({ where: { key: "stats" } });
    if (!row) return { stats: null };
    const result = StatsContentSchema.safeParse(row.data);
    if (!result.success) return { stats: row.data };
    return { stats: result.data };
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async save(@Body() body: unknown, @Req() req: CookieRequest) {
    const parsed = parse(StatsContentSchema, (body as any)?.stats ?? body);
    const saved = await this.prisma.siteModule.upsert({
      where: { key: "stats" },
      create: { key: "stats", data: parsed as any, updatedBy: req.user?.id ?? null },
      update: { data: parsed as any, updatedBy: req.user?.id ?? null },
    });
    const legacy = await this.prisma.siteContent.findUnique({ where: { key: "main" } });
    if (legacy?.data && typeof legacy.data === "object") {
      const data = { ...(legacy.data as Record<string, unknown>), stats: parsed };
      await this.prisma.siteContent.update({ where: { key: "main" }, data: { data: data as any, updatedBy: req.user?.id ?? null } });
    }
    return { stats: saved.data, updatedAt: saved.updatedAt };
  }
}
