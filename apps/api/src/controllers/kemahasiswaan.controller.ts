import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { KemahasiswaanSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, RequestUser } from "../auth";
import { parse } from "../zod";
type CookieRequest = Request & { user?: RequestUser };
@Controller("kemahasiswaan")
export class KemahasiswaanController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() async get() {
    const row = await this.prisma.siteModule.findUnique({ where: { key: "kemahasiswaan" } });
    if (!row) return { kemahasiswaan: null };
    const r = KemahasiswaanSchema.safeParse(row.data);
    if (!r.success) return { kemahasiswaan: row.data };
    return { kemahasiswaan: r.data };
  }
  @Put() @UseGuards(JwtAuthGuard, RolesGuard) @Roles("ADMIN")
  async save(@Body() body: unknown, @Req() req: CookieRequest) {
    const parsed = parse(KemahasiswaanSchema, (body as any)?.kemahasiswaan ?? body);
    const saved = await this.prisma.siteModule.upsert({ where: { key: "kemahasiswaan" }, create: { key: "kemahasiswaan", data: parsed as any, updatedBy: req.user?.id ?? null }, update: { data: parsed as any, updatedBy: req.user?.id ?? null } });
    const legacy = await this.prisma.siteContent.findUnique({ where: { key: "main" } });
    if (legacy?.data && typeof legacy.data === "object") { const d = { ...(legacy.data as Record<string, unknown>), kemahasiswaan: parsed }; await this.prisma.siteContent.update({ where: { key: "main" }, data: { data: d as any, updatedBy: req.user?.id ?? null } }); }
    return { kemahasiswaan: saved.data, updatedAt: saved.updatedAt };
  }
}
