import { Controller, Get } from "@nestjs/common";
import { PageRevisionDataSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";

@Controller("anchors")
export class AnchorsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.page.findMany({
      where: { status: "published" },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      select: { slug: true, publishedData: true },
    });

    const anchors: Record<string, string> = Object.create(null);
    for (const row of rows) {
      const snapshot = PageRevisionDataSchema.safeParse(row.publishedData);
      if (!snapshot.success) continue;
      for (const block of snapshot.data.blocks) {
        if (!block.isVisible || !block.anchor) continue;
        if (!(block.anchor in anchors)) anchors[block.anchor] = row.slug;
      }
    }
    return { anchors };
  }
}
