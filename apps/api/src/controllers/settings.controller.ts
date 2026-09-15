import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { SiteSettingsSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard, type RequestUser } from "../auth";
import { parse } from "../zod";

type AuthRequest = Request & { user?: RequestUser };

const SETTINGS_KEY = "main";

@Controller("settings")
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get() {
    const row = await this.prisma.siteSetting.findUnique({ where: { key: SETTINGS_KEY } });
    if (!row) return { settings: null };
    const parsed = SiteSettingsSchema.safeParse(row.data);
    return { settings: parsed.success ? parsed.data : null };
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  async save(@Body() body: unknown, @Req() req: AuthRequest) {
    const data = parse(SiteSettingsSchema, (body as any)?.settings ?? body);
    const saved = await this.prisma.siteSetting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, data: data as any, updatedBy: req.user?.id ?? null },
      update: { data: data as any, updatedBy: req.user?.id ?? null },
    });
    return { settings: saved.data };
  }
}
