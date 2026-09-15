import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { NavigationInputSchema } from "@tpb/contracts";
import { PrismaService } from "../prisma.service";
import { JwtAuthGuard, Roles, RolesGuard } from "../auth";
import { parse } from "../zod";
import { buildNavTree, createNavTree } from "../nav.util";

@Controller("nav")
export class NavController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get() {
    const rows = await this.prisma.navItem.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
    return { items: buildNavTree(rows) };
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "EDITOR")
  async replace(@Body() body: unknown) {
    const { items } = parse(NavigationInputSchema, body);

    await this.prisma.$transaction(async (tx) => {
      await tx.navItem.deleteMany();
      await createNavTree(tx, items, null);
    });

    const rows = await this.prisma.navItem.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
    return { items: buildNavTree(rows) };
  }
}
