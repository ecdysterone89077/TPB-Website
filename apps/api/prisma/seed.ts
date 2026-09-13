import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { SiteContentSchema } from "@tpb/contracts";

const db = new PrismaClient();

async function main() {
  const raw = JSON.parse(readFileSync(join(__dirname, "seed-content.json"), "utf-8"));
  const content = SiteContentSchema.parse(raw);
  await db.siteContent.upsert({
    where: { key: "main" },
    create: { key: "main", data: content as never },
    update: { data: content as never },
  });
  console.log("seed: site_content/main ok");
}

main()
  .catch((e) => {
    console.error("seed failed:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
