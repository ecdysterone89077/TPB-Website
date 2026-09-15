import { BlockSchema, NavigationInputSchema, SiteSettingsSchema } from "@tpb/contracts";
import type { Block, BlockType, NavItemInput, SiteSettings } from "@tpb/contracts";

export type ModuleMap = Record<string, unknown>;

export type LegacyStat = { value: number; suffix: string; label: string };

export type LegacyGalleryItem = {
  id?: string;
  image: string;
  caption?: string | null;
  link?: string | null;
  kind?: string | null;
  title?: string | null;
  category?: string | null;
  thumb?: string | null;
};

export type MigrationPlan = {
  page: { slug: string; title: string; blocks: Block[] };
  nav: NavItemInput[];
  settings: SiteSettings | null;
  warnings: string[];
};

const isEmptyValue = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0);

/** Urutan blok mengikuti tata letak situs lama (App.tsx + DetailSections). */
const BLOCK_LAYOUT: { module: string; type: BlockType; anchor?: string }[] = [
  { module: "hero", type: "hero", anchor: "top" },
  { module: "marquee", type: "marquee" },
  { module: "stats", type: "stats" },
  { module: "about", type: "about", anchor: "profil" },
  { module: "profil.sejarah", type: "timeline", anchor: "sejarah" },
  { module: "profil.visiMisi", type: "visiMisi", anchor: "visi-misi" },
  { module: "profil.struktur", type: "struktur", anchor: "struktur" },
  { module: "profil.sambutan", type: "quote", anchor: "sambutan" },
  { module: "akademik.kurikulum", type: "kurikulum", anchor: "kurikulum" },
  { module: "akademik.kalender", type: "kalender", anchor: "kalender" },
  { module: "akademik.dosen", type: "dosen", anchor: "dosen" },
  { module: "akademik.laboratorium", type: "laboratorium", anchor: "laboratorium" },
  { module: "penelitian.publikasi", type: "publikasi", anchor: "publikasi" },
  { module: "penelitian.jurnal", type: "jurnal", anchor: "jurnal" },
  { module: "penelitian.kolaborasi", type: "kolaborasi", anchor: "kolaborasi" },
  { module: "pengabdian.programDesa", type: "programDesa", anchor: "program-desa" },
  { module: "pengabdian.kemitraan", type: "kemitraan", anchor: "kemitraan" },
  { module: "pengabdian.kegiatan", type: "kegiatan", anchor: "kegiatan" },
  { module: "kemahasiswaan.himpunan", type: "himpunan", anchor: "himpunan" },
  { module: "kemahasiswaan.beasiswa", type: "beasiswa", anchor: "beasiswa" },
  { module: "kemahasiswaan.prestasi", type: "prestasi", anchor: "prestasi" },
  { module: "kemahasiswaan.alumni", type: "alumni", anchor: "alumni" },
  { module: "programs", type: "programs", anchor: "akademik" },
  { module: "research", type: "research", anchor: "penelitian" },
  { module: "community", type: "community", anchor: "pengabdian" },
  { module: "studentLife", type: "studentLife", anchor: "kemahasiswaan" },
  { module: "news", type: "news", anchor: "berita" },
  { module: "cta", type: "cta" },
];

const readPath = (modules: ModuleMap, path: string): unknown => {
  const [head, ...rest] = path.split(".");
  const value = modules[head];
  if (!rest.length) return value;
  if (!value || typeof value !== "object") return undefined;
  return readPath(value as ModuleMap, rest.join("."));
};

export function buildMigration(input: { modules: ModuleMap; siteStats?: LegacyStat[]; gallery?: LegacyGalleryItem[] }): MigrationPlan {
  const { modules } = input;
  const blocks: Block[] = [];
  const warnings: string[] = [];

  const add = (type: BlockType, data: unknown, anchor?: string) => {
    const parsed = BlockSchema.safeParse({ type, data, isVisible: true, ...(anchor ? { anchor } : {}) });
    if (parsed.success) blocks.push(parsed.data);
    else warnings.push(`${type} dilewati: ${parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`);
  };

  for (const item of BLOCK_LAYOUT) {
    const data = readPath(modules, item.module);
    if (item.module === "stats") {
      const fallback = Array.isArray(input.siteStats) && input.siteStats.length ? input.siteStats : data;
      if (isEmptyValue(fallback)) continue;
      add("stats", fallback);
      continue;
    }
    if (isEmptyValue(data)) continue;
    add(item.type, data, item.anchor);
  }

  const galleryItems = (input.gallery ?? [])
    .filter((g) => typeof g.image === "string" && g.image.trim() !== "")
    .map((g) => ({
      image: g.image,
      kind: g.kind === "video" ? ("video" as const) : ("image" as const),
      caption: g.caption ?? "",
      title: g.title ?? "",
      thumb: g.thumb ?? "",
    }));
  if (galleryItems.length) add("gallery", { items: galleryItems, columns: 3 }, "galeri");

  const navigationRaw = modules.navigation;
  const navParsed = NavigationInputSchema.safeParse({ items: Array.isArray(navigationRaw) ? navigationRaw : [] });
  const nav = navParsed.success ? navParsed.data.items : [];
  if (!navParsed.success) warnings.push(`navigation dilewati: ${navParsed.error.issues.map((i) => i.message).join("; ")}`);

  const settingsParsed = SiteSettingsSchema.safeParse({ brand: modules.brand, footer: modules.footer, pmbLink: modules.pmbLink ?? "" });
  if (!settingsParsed.success) warnings.push(`pengaturan global tidak lengkap: ${settingsParsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);

  const brand = modules.brand as { name?: string } | undefined;
  return {
    page: { slug: "beranda", title: brand?.name?.trim() ? String(brand.name) : "Beranda", blocks },
    nav,
    settings: settingsParsed.success ? settingsParsed.data : null,
    warnings,
  };
}
