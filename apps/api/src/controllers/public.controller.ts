import { Body, Controller, Get, Post, Query, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import { SubscriberInputSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard } from "../auth";
import { parse } from "../zod";
import { parsePagination, paginationMeta } from "../pagination";

@Controller()
export class PublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, database: "up" };
    } catch {
      throw new ServiceUnavailableException({ ok: false, database: "down" });
    }
  }

  @Post("subscribers")
  async subscribe(@Body() body: unknown) {
    const { email } = parse(SubscriberInputSchema, body);
    const normalized = email.toLowerCase();
    const subscriber = await this.prisma.subscriber.upsert({
      where: { email: normalized },
      create: { email: normalized },
      update: {},
    });
    return { subscriber };
  }

  @Get("subscribers")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "OPERATOR")
  async listSubscribers(@Query() query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const [rows, total] = await Promise.all([
      this.prisma.subscriber.findMany({ orderBy: [{ subscribedAt: "desc" }, { id: "desc" }], skip: pagination.offset, take: pagination.limit }),
      this.prisma.subscriber.count(),
    ]);
    return {
      subscribers: rows.map((r) => ({ id: r.id, email: r.email, subscribedAt: r.subscribedAt.toISOString() })),
      pagination: paginationMeta(pagination, total),
    };
  }
}
