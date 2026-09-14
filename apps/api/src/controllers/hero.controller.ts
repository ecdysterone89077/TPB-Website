import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { HeroSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, RequestUser } from "../auth";
import { parse } from "../zod";

type CookieRequest = Request & { user?: RequestUser };

@Controller("hero")
export class HeroController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get() {
    const row = await this.prisma.siteModule.findUnique({ where: { key: "hero" } });
    if (!row) return { hero: null };
    const result = HeroSchema.safeParse(row.data);
    if (!result.success) return { hero: row.data };
    return { hero: result.data };
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async save(@Body() body: unknown, @Req() req: CookieRequest) {
    const parsed = parse(HeroSchema, (body as any)?.hero ?? body);
    const saved = await this.prisma.siteModule.upsert({
      where: { key: "hero" },
      create: { key: "hero", data: parsed as any, updatedBy: req.user?.id ?? null },
      update: { data: parsed as any, updatedBy: req.user?.id ?? null },
    });
    const legacy = await this.prisma.siteContent.findUnique({ where: { key: "main" } });
    if (legacy?.data && typeof legacy.data === "object") {
      const data = { ...(legacy.data as Record<string, unknown>), hero: parsed };
      await this.prisma.siteContent.update({ where: { key: "main" }, data: { data: data as any, updatedBy: req.user?.id ?? null } });
    }
    return { hero: saved.data, updatedAt: saved.updatedAt };
  }
}
