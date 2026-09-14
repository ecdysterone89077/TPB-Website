import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { BrandSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, RequestUser } from "../auth";
import { parse } from "../zod";

type CookieRequest = Request & { user?: RequestUser };

@Controller("brand")
export class BrandController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get() {
    const row = await this.prisma.siteModule.findUnique({ where: { key: "brand" } });
    if (!row) return { brand: null };
    const result = BrandSchema.safeParse(row.data);
    if (!result.success) return { brand: row.data };
    return { brand: result.data };
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async save(@Body() body: unknown, @Req() req: CookieRequest) {
    const parsed = parse(BrandSchema, (body as any)?.brand ?? body);
    const saved = await this.prisma.siteModule.upsert({
      where: { key: "brand" },
      create: { key: "brand", data: parsed as any, updatedBy: req.user?.id ?? null },
      update: { data: parsed as any, updatedBy: req.user?.id ?? null },
    });
    // keep legacy aggregator in sync
    const legacy = await this.prisma.siteContent.findUnique({ where: { key: "main" } });
    if (legacy?.data && typeof legacy.data === "object") {
      const data = { ...(legacy.data as Record<string, unknown>), brand: parsed };
      await this.prisma.siteContent.update({ where: { key: "main" }, data: { data: data as any, updatedBy: req.user?.id ?? null } });
    }
    return { brand: saved.data, updatedAt: saved.updatedAt };
  }
}
