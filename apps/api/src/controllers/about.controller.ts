import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AboutSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, RequestUser } from "../auth";
import { parse } from "../zod";
type CookieRequest = Request & { user?: RequestUser };
@Controller("about")
export class AboutController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() async get() {
    const row = await this.prisma.siteModule.findUnique({ where: { key: "about" } });
    if (!row) return { about: null };
    const r = AboutSchema.safeParse(row.data);
    if (!r.success) return { about: row.data };
    return { about: r.data };
  }
  @Put() @UseGuards(JwtAuthGuard, RolesGuard) @Roles("ADMIN")
  async save(@Body() body: unknown, @Req() req: CookieRequest) {
    const parsed = parse(AboutSchema, (body as any)?.about ?? body);
    const saved = await this.prisma.siteModule.upsert({ where: { key: "about" }, create: { key: "about", data: parsed as any, updatedBy: req.user?.id ?? null }, update: { data: parsed as any, updatedBy: req.user?.id ?? null } });
    const legacy = await this.prisma.siteContent.findUnique({ where: { key: "main" } });
    if (legacy?.data && typeof legacy.data === "object") { const d = { ...(legacy.data as Record<string, unknown>), about: parsed }; await this.prisma.siteContent.update({ where: { key: "main" }, data: { data: d as any, updatedBy: req.user?.id ?? null } }); }
    return { about: saved.data, updatedAt: saved.updatedAt };
  }
}
