import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { NavigationSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, RequestUser } from "../auth";
import { parse } from "../zod";

type CookieRequest = Request & { user?: RequestUser };

@Controller("navigation")
export class NavigationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get() {
    const row = await this.prisma.siteModule.findUnique({ where: { key: "navigation" } });
    if (!row) return { navigation: null };
    const result = NavigationSchema.safeParse(row.data);
    if (!result.success) return { navigation: row.data };
    return { navigation: result.data };
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async save(@Body() body: unknown, @Req() req: CookieRequest) {
    const parsed = parse(NavigationSchema, (body as any)?.navigation ?? body);
    const saved = await this.prisma.siteModule.upsert({
      where: { key: "navigation" },
      create: { key: "navigation", data: parsed as any, updatedBy: req.user?.id ?? null },
      update: { data: parsed as any, updatedBy: req.user?.id ?? null },
    });
    const legacy = await this.prisma.siteContent.findUnique({ where: { key: "main" } });
    if (legacy?.data && typeof legacy.data === "object") {
      const data = { ...(legacy.data as Record<string, unknown>), navigation: parsed };
      await this.prisma.siteContent.update({ where: { key: "main" }, data: { data: data as any, updatedBy: req.user?.id ?? null } });
    }
    return { navigation: saved.data, updatedAt: saved.updatedAt };
  }
}
