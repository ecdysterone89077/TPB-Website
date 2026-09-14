import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ResearchSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, RequestUser } from "../auth";
import { parse } from "../zod";
type CookieRequest = Request & { user?: RequestUser };
@Controller("research")
export class ResearchController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() async get() {
    const row = await this.prisma.siteModule.findUnique({ where: { key: "research" } });
    if (!row) return { research: null };
    const r = ResearchSchema.safeParse(row.data);
    if (!r.success) return { research: row.data };
    return { research: r.data };
  }
  @Put() @UseGuards(JwtAuthGuard, RolesGuard) @Roles("ADMIN")
  async save(@Body() body: unknown, @Req() req: CookieRequest) {
    const parsed = parse(ResearchSchema, (body as any)?.research ?? body);
    const saved = await this.prisma.siteModule.upsert({ where: { key: "research" }, create: { key: "research", data: parsed as any, updatedBy: req.user?.id ?? null }, update: { data: parsed as any, updatedBy: req.user?.id ?? null } });
    const legacy = await this.prisma.siteContent.findUnique({ where: { key: "main" } });
    if (legacy?.data && typeof legacy.data === "object") { const d = { ...(legacy.data as Record<string, unknown>), research: parsed }; await this.prisma.siteContent.update({ where: { key: "main" }, data: { data: d as any, updatedBy: req.user?.id ?? null } }); }
    return { research: saved.data, updatedAt: saved.updatedAt };
  }
}
