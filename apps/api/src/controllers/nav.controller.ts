import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { NavigationInputSchema, type NavItemInput } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard } from "../auth";
import { parse } from "../zod";

type NavRow = { id: string; parentId: string | null; label: string; href: string; openInNewTab: boolean; position: number };

const buildTree = (rows: NavRow[]): NavItemInput[] => {
  const byParent = new Map<string | null, NavRow[]>();
  for (const row of rows) {
    const list = byParent.get(row.parentId) ?? [];
    list.push(row);
    byParent.set(row.parentId, list);
  }
  const build = (parentId: string | null): NavItemInput[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((row) => {
        const children = build(row.id);
        return {
          label: row.label,
          href: row.href,
          openInNewTab: row.openInNewTab,
          ...(children.length ? { children } : {}),
        };
      });
  return build(null);
};

@Controller("nav")
export class NavController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get() {
    const rows = await this.prisma.navItem.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
    return { items: buildTree(rows) };
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  async replace(@Body() body: unknown) {
    const { items } = parse(NavigationInputSchema, body);

    await this.prisma.$transaction(async (tx) => {
      await tx.navItem.deleteMany();
      const createLevel = async (nodes: NavItemInput[], parentId: string | null) => {
        for (let position = 0; position < nodes.length; position++) {
          const node = nodes[position];
          const created = await tx.navItem.create({
            data: { parentId, label: node.label, href: node.href, openInNewTab: node.openInNewTab ?? false, position },
          });
          if (node.children?.length) await createLevel(node.children, created.id);
        }
      };
      await createLevel(items, null);
    });

    const rows = await this.prisma.navItem.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
    return { items: buildTree(rows) };
  }
}
