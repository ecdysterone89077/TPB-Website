import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { PengabdianSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, RequestUser } from "../auth";
import { parse } from "../zod";
type CookieRequest = Request & { user?: RequestUser };
@Controller("pengabdian")
export class PengabdianController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() async get() {
    const row = await this.prisma.siteModule.findUnique({ where: { key: "pengabdian" } });
    if (!row) return { pengabdian: null };
    const r = PengabdianSchema.safeParse(row.data);
    if (!r.success) return { pengabdian: row.data };
    return { pengabdian: r.data };
  }
  @Put() @UseGuards(JwtAuthGuard, RolesGuard) @Roles("ADMIN")
  async save(@Body() body: unknown, @Req() req: CookieRequest) {
    const parsed = parse(PengabdianSchema, (body as any)?.pengabdian ?? body);
    const saved = await this.prisma.siteModule.upsert({ where: { key: "pengabdian" }, create: { key: "pengabdian", data: parsed as any, updatedBy: req.user?.id ?? null }, update: { data: parsed as any, updatedBy: req.user?.id ?? null } });
    const legacy = await this.prisma.siteContent.findUnique({ where: { key: "main" } });
    if (legacy?.data && typeof legacy.data === "object") { const d = { ...(legacy.data as Record<string, unknown>), pengabdian: parsed }; await this.prisma.siteContent.update({ where: { key: "main" }, data: { data: d as any, updatedBy: req.user?.id ?? null } }); }
    return { pengabdian: saved.data, updatedAt: saved.updatedAt };
  }
}
