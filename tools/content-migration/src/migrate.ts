import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { BlockSchema } from "@tpb/contracts";
import type { Block } from "@tpb/contracts";
import { buildMigration } from "./mapping";

const prisma = new PrismaClient();
const WRITE = process.argv.includes("--write");
const RECONCILE = process.argv.includes("--reconcile");
const FORCE = process.argv.includes("--force");
const HOME_SLUG = "beranda";

const canon = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canon);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if (key === "children") {
        const kids = (value as Record<string, unknown>).children;
        if (Array.isArray(kids) && kids.length === 0) continue;
      }
      out[key] = canon((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
};

const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(canon(value))).digest("hex");
const blockKey = (block: Block) => `${block.type}@${block.anchor ?? "-"}@${block.isVisible ? "on" : "off"}:${sha(block.data)}`;

const countNav = (nodes: { children?: unknown[] }[]): number => nodes.reduce((total, node) => total + 1 + countNav((node.children ?? []) as { children?: unknown[] }[]), 0);

const buildNavTree = (rows: { id: string; parentId: string | null; label: string; href: string; openInNewTab: boolean; position: number }[]) => {
  const byParent = new Map<string | null, typeof rows>();
  for (const row of rows) {
    const list = byParent.get(row.parentId) ?? [];
    list.push(row);
    byParent.set(row.parentId, list);
  }
  const build = (parentId: string | null): { label: string; href: string; openInNewTab: boolean; children?: unknown[] }[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((row) => ({
        label: row.label,
        href: row.href,
        openInNewTab: row.openInNewTab,
        ...(build(row.id).length ? { children: build(row.id) } : {}),
      }));
  return build(null);
};

async function loadLegacy() {
  const [modules, stats, gallery] = await Promise.all([
    prisma.siteModule.findMany(),
    prisma.siteStat.findMany({ orderBy: [{ ord: "asc" }, { id: "asc" }] }),
    prisma.galleryItem.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
  ]);
  return {
    modules: Object.fromEntries(modules.map((row) => [row.key, row.data])) as Record<string, unknown>,
    siteStats: stats.map((row) => ({ value: row.value, suffix: row.suffix, label: row.label })),
    gallery: gallery.map((row) => ({ image: row.image, caption: row.caption, kind: row.kind, title: row.title, thumb: row.thumb })),
  };
}

async function reconcile(plan: ReturnType<typeof buildMigration>) {
  const page = await prisma.page.findUnique({ where: { slug: HOME_SLUG }, include: { blocks: { orderBy: [{ position: "asc" }, { id: "asc" }] } } });
  const settings = await prisma.siteSetting.findUnique({ where: { key: "main" } });
  const navRows = await prisma.navItem.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
  const problems: string[] = [];

  if (!page) problems.push(`halaman ${HOME_SLUG} tidak ada`);
  else {
    const expected = plan.page.blocks.map(blockKey);
    const actual = page.blocks.map((row) => blockKey(BlockSchema.parse({ id: row.id, type: row.type, data: row.data, isVisible: row.isVisible, ...(row.anchor ? { anchor: row.anchor } : {}) })));
    if (expected.length !== actual.length) problems.push(`jumlah blok beda: plan=${expected.length} db=${actual.length}`);
    else if (expected.some((key, i) => key !== actual[i])) problems.push("isi/urutan blok berbeda dari rencana");
  }
  if (!plan.settings) problems.push("pengaturan global tidak valid di sumber");
  else if (!settings) problems.push("site_settings main tidak ada");
  else if (sha(plan.settings) !== sha(settings.data)) problems.push("site_settings berbeda dari rencana");
  const dbNavCount = navRows.length;
  const planNavCount = countNav(plan.nav as { children?: unknown[] }[]);
  if (dbNavCount !== planNavCount) problems.push(`jumlah menu beda: plan=${planNavCount} db=${dbNavCount}`);
  else if (sha(plan.nav) !== sha(buildNavTree(navRows))) problems.push("struktur menu berbeda dari rencana");

  if (problems.length) {
    console.error("RECONCILE GAGAL:");
    for (const problem of problems) console.error(` - ${problem}`);
    process.exitCode = 2;
  } else {
    console.log(`RECONCILE OK — ${plan.page.blocks.length} blok, ${planNavCount} menu, settings cocok`);
  }
}

async function main() {
  const legacy = await loadLegacy();
  const plan = buildMigration(legacy);
  const checksum = sha(plan.page.blocks);

  console.log(`Sumber: ${Object.keys(legacy.modules).length} modul, ${legacy.siteStats.length} statistik, ${legacy.gallery.length} item galeri`);
  console.log(`Rencana: halaman "${HOME_SLUG}" (${plan.page.blocks.length} blok), ${plan.nav.length} menu, settings=${plan.settings ? "siap" : "tidak lengkap"}`);
  console.log(`Checksum blok: ${checksum}`);
  for (const warning of plan.warnings) console.log(`  [warn] ${warning}`);

  if (RECONCILE) return reconcile(plan);
  if (!WRITE) {
    console.log("Mode dry-run (tidak menulis). Tambahkan --write untuk menerapkan.");
    return;
  }

  if (!FORCE) {
    if (plan.warnings.some((warning) => warning.startsWith("navigation"))) {
      throw new Error("Menu legacy tidak valid — perbaiki sumber atau jalankan dengan --force.");
    }
    if (plan.nav.length === 0) {
      throw new Error("Rencana menu kosong — jalankan dengan --force bila memang ingin mengosongkan menu.");
    }
    if (!plan.settings) {
      throw new Error("Pengaturan global (brand/footer/pmbLink) tidak lengkap — jalankan dengan --force untuk melanjutkan.");
    }
  }

  const snapshot = {
    page: { title: plan.page.title, slug: HOME_SLUG, seoTitle: "", seoDescription: "", ogImage: null },
    blocks: plan.page.blocks,
  };

  await prisma.$transaction(async (tx) => {
    if (plan.settings) {
      await tx.siteSetting.upsert({
        where: { key: "main" },
        create: { key: "main", data: plan.settings as any },
        update: { data: plan.settings as any },
      });
    }
    await tx.navItem.deleteMany();
    const createLevel = async (nodes: typeof plan.nav, parentId: string | null) => {
      for (let position = 0; position < nodes.length; position++) {
        const node = nodes[position];
        const created = await tx.navItem.create({
          data: { parentId, label: node.label, href: node.href, openInNewTab: node.openInNewTab ?? false, position },
        });
        if (node.children?.length) await createLevel(node.children, created.id);
      }
    };
    await createLevel(plan.nav, null);

    const pageData = { title: plan.page.title, status: "published" as const, publishedAt: new Date(), publishedData: snapshot as any };
    const page = await tx.page.upsert({
      where: { slug: HOME_SLUG },
      create: { slug: HOME_SLUG, ...pageData },
      update: pageData,
    });
    await tx.block.deleteMany({ where: { pageId: page.id } });
    for (let position = 0; position < plan.page.blocks.length; position++) {
      const block = plan.page.blocks[position];
      await tx.block.create({
        data: { pageId: page.id, type: block.type, position, data: block.data as any, isVisible: block.isVisible, anchor: block.anchor ?? null },
      });
    }
    await tx.pageRevision.create({ data: { pageId: page.id, data: snapshot as any } });
  });

  console.log("Migrasi selesai (--write). Jalankan --reconcile untuk verifikasi.");
}

main()
  .catch((error) => {
    console.error("MIGRASI GAGAL:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
