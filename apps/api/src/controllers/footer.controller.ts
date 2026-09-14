import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { FooterSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, RequestUser } from "../auth";
import { parse } from "../zod";
type CookieRequest = Request & { user?: RequestUser };
@Controller("footer")
export class FooterController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() async get() {
    const row = await this.prisma.siteModule.findUnique({ where: { key: "footer" } });
    if (!row) return { footer: null };
    const r = FooterSchema.safeParse(row.data);
    if (!r.success) return { footer: row.data };
    return { footer: r.data };
  }
  @Put() @UseGuards(JwtAuthGuard, RolesGuard) @Roles("ADMIN")
  async save(@Body() body: unknown, @Req() req: CookieRequest) {
    const parsed = parse(FooterSchema, (body as any)?.footer ?? body);
    const saved = await this.prisma.siteModule.upsert({ where: { key: "footer" }, create: { key: "footer", data: parsed as any, updatedBy: req.user?.id ?? null }, update: { data: parsed as any, updatedBy: req.user?.id ?? null } });
    const legacy = await this.prisma.siteContent.findUnique({ where: { key: "main" } });
    if (legacy?.data && typeof legacy.data === "object") { const d = { ...(legacy.data as Record<string, unknown>), footer: parsed }; await this.prisma.siteContent.update({ where: { key: "main" }, data: { data: d as any, updatedBy: req.user?.id ?? null } }); }
    return { footer: saved.data, updatedAt: saved.updatedAt };
  }
}
