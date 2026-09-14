import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { MarqueeSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, RequestUser } from "../auth";
import { parse } from "../zod";

type CookieRequest = Request & { user?: RequestUser };

@Controller("marquee")
export class MarqueeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get() {
    const row = await this.prisma.siteModule.findUnique({ where: { key: "marquee" } });
    if (!row) return { marquee: null };
    const result = MarqueeSchema.safeParse(row.data);
    if (!result.success) return { marquee: row.data };
    return { marquee: result.data };
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async save(@Body() body: unknown, @Req() req: CookieRequest) {
    const parsed = parse(MarqueeSchema, (body as any)?.marquee ?? body);
    const saved = await this.prisma.siteModule.upsert({
      where: { key: "marquee" },
      create: { key: "marquee", data: parsed as any, updatedBy: req.user?.id ?? null },
      update: { data: parsed as any, updatedBy: req.user?.id ?? null },
    });
    const legacy = await this.prisma.siteContent.findUnique({ where: { key: "main" } });
    if (legacy?.data && typeof legacy.data === "object") {
      const data = { ...(legacy.data as Record<string, unknown>), marquee: parsed };
      await this.prisma.siteContent.update({ where: { key: "main" }, data: { data: data as any, updatedBy: req.user?.id ?? null } });
    }
    return { marquee: saved.data, updatedAt: saved.updatedAt };
  }
}
