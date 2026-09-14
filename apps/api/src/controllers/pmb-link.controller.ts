import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { PmbLinkSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, RequestUser } from "../auth";
import { parse } from "../zod";
type CookieRequest = Request & { user?: RequestUser };
@Controller("pmb-link")
export class PmbLinkController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() async get() {
    const row = await this.prisma.siteModule.findUnique({ where: { key: "pmbLink" } });
    if (!row) return { pmbLink: null };
    const r = PmbLinkSchema.safeParse(row.data);
    if (!r.success) return { pmbLink: row.data };
    return { pmbLink: r.data };
  }
  @Put() @UseGuards(JwtAuthGuard, RolesGuard) @Roles("ADMIN")
  async save(@Body() body: unknown, @Req() req: CookieRequest) {
    const parsed = parse(PmbLinkSchema, (body as any)?.pmbLink ?? (body as any)?.pmb_link ?? body);
    const saved = await this.prisma.siteModule.upsert({ where: { key: "pmbLink" }, create: { key: "pmbLink", data: parsed as any, updatedBy: req.user?.id ?? null }, update: { data: parsed as any, updatedBy: req.user?.id ?? null } });
    const legacy = await this.prisma.siteContent.findUnique({ where: { key: "main" } });
    if (legacy?.data && typeof legacy.data === "object") { const d = { ...(legacy.data as Record<string, unknown>), pmbLink: parsed }; await this.prisma.siteContent.update({ where: { key: "main" }, data: { data: d as any, updatedBy: req.user?.id ?? null } }); }
    return { pmbLink: saved.data, updatedAt: saved.updatedAt };
  }
}
