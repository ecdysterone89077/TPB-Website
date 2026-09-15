import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CONFIRMED = process.argv.includes("--yes");
const TABLES = ["site_modules", "site_content", "site_stats", "gallery_items"];

async function main() {
  if (!CONFIRMED) {
    console.error("Drop tabel legacy dibatalkan (butuh --yes).");
    console.error("Jalankan migrasi konten + verifikasi paritas terlebih dahulu:");
    console.error("  pnpm content:migrate:write && pnpm content:migrate:reconcile");
    console.error("Lalu: pnpm content:drop-legacy -- --yes");
    process.exitCode = 1;
    return;
  }

  const home = await prisma.page.findUnique({ where: { slug: "beranda" } });
  if (!home) {
    console.error("Halaman 'beranda' belum ada — jalankan migrasi konten dulu. Drop dibatalkan.");
    process.exitCode = 2;
    return;
  }
  const blocks = await prisma.block.count({ where: { pageId: home.id } });
  if (blocks === 0) {
    console.error("Halaman 'beranda' belum memiliki blok — drop dibatalkan.");
    process.exitCode = 2;
    return;
  }

  for (const table of TABLES) {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${table}\``);
    console.log(`dropped: ${table}`);
  }
  console.log(`Selesai — ${TABLES.length} tabel legacy dihapus (halaman beranda: ${blocks} blok).`);
}

main()
  .catch((error) => {
    console.error("DROP GAGAL:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
