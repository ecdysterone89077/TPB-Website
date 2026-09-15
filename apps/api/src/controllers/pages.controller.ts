import { Controller, Get, Param } from "@nestjs/common";
import { PageRevisionDataSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { toPageSummary } from "../pages.util";

@Controller("pages")
export class PagesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.page.findMany({
      where: { status: "published" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      include: { blocks: { select: { id: true } } },
    });
    return {
      pages: rows.map((row) => {
        const snapshot = PageRevisionDataSchema.safeParse(row.publishedData);
        const summary = toPageSummary(row);
        return snapshot.success ? { ...summary, title: snapshot.data.page.title } : summary;
      }),
    };
  }

  @Get(":slug")
  async get(@Param("slug") slug: string) {
    const row = await this.prisma.page.findUnique({ where: { slug } });
    if (!row || row.status !== "published") return { page: null };
    const snapshot = PageRevisionDataSchema.safeParse(row.publishedData);
    if (!snapshot.success) return { page: null };
    const data = snapshot.data;
    return {
      page: {
        id: row.id,
        slug: row.slug,
        title: data.page.title,
        seoTitle: data.page.seoTitle || null,
        seoDescription: data.page.seoDescription || null,
        ogImage: data.page.ogImage ?? null,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
        blocks: data.blocks.filter((block) => block.isVisible),
      },
    };
  }
}
