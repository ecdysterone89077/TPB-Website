import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMigration, type ModuleMap } from "./mapping";

const hero = { badge: "Uji", line1: "Satu", highlight: "Dua", line2: "Tiga", subtitle: "Sub", primaryLabel: "Daftar", primaryHref: "#pmb", secondaryLabel: "Lihat", image: "/media/hero.jpg" };
const brand = { kicker: "K", name: "TPB Uji", org: "UNU", logoUrl: "/media/logo.png" };
const footer = {
  newsletterTitle: "N", infoTitle: "I", quickLinksTitle: "T", galleryTitle: "G", submitLabel: "Kirim",
  socials: { facebook: "https://www.facebook.com/tpb", twitter: "", youtube: "", linkedin: "" },
  contact: { phone: "", email: "a@b.test", address: "Purwokerto" },
  quickLinks: [], copyright: "C", tagline: "T",
};
const dosen = { kicker: "A", title: "Dosen", intro: "Intro", people: [{ name: "A", field: "TPB", photo: "" }] };
const modules: ModuleMap = {
  brand,
  footer,
  pmbLink: "#pmb",
  hero,
  marquee: ["Satu", "Dua"],
  stats: [{ value: 10, suffix: "+", label: "L" }],
  about: { kicker: "A", title: "T", body: "B", sinceYear: "2024", sinceNote: "", image: "", points: ["P"] },
  profil: {
    sejarah: { kicker: "S", title: "Sejarah", intro: "I", timeline: [{ year: "2024", text: "T" }] },
    visiMisi: { kicker: "V", title: "Visi", visi: "Visi", misi: ["M"] },
    struktur: { kicker: "S", title: "Struktur", people: [{ role: "Ketua", name: "A" }] },
    sambutan: { kicker: "S", title: "Sambutan", image: "", quote: "Q", name: "N", role: "R" },
  },
  akademik: {
    kurikulum: { kicker: "K", title: "Kurikulum", intro: "I", sks: [], clusters: [] },
    kalender: { kicker: "K", title: "Kalender", items: [{ d: "Jan", e: "Kegiatan" }] },
    dosen,
    laboratorium: { kicker: "L", title: "Lab", labs: [{ name: "Lab 1", desc: "D" }] },
  },
  programs: { kicker: "P", title: "Program", cta: "Daftar", cards: [{ tag: "T", title: "K", body: "B", img: "", color: "" }] },
  research: { kicker: "R", title: "Riset", body: "B", areas: [{ no: "1", title: "A", body: "B" }], metrics: [{ v: "1", l: "L" }] },
  community: { kicker: "C", title: "Pengabdian", body: "B", image: "", items: ["I"] },
  studentLife: { kicker: "S", title: "Kemahasiswaan", cta: "Daftar", cards: [{ tag: "T", title: "K", body: "B" }] },
  news: { kicker: "N", title: "Berita" },
  cta: { title: "CTA", body: "B", primary: "P", secondary: "S", secondaryHref: "#x" },
  navigation: [
    { label: "Beranda", href: "/" },
    { label: "Profil", href: "/profil", children: [{ label: "Sejarah", href: "/profil#sejarah" }] },
  ],
};

test("urutan blok mengikuti tata letak situs lama", () => {
  const plan = buildMigration({ modules });
  assert.deepEqual(
    plan.page.blocks.map((b) => b.type),
    ["hero", "marquee", "stats", "about", "timeline", "visiMisi", "struktur", "quote", "kurikulum", "kalender", "dosen", "laboratorium", "programs", "research", "community", "studentLife", "news", "cta"],
  );
  assert.equal(plan.page.slug, "beranda");
  assert.equal(plan.page.title, "TPB Uji");
});

test("anchor dipertahankan agar tautan lama tetap bekerja", () => {
  const plan = buildMigration({ modules });
  const anchors = Object.fromEntries(plan.page.blocks.map((b) => [b.type, b.anchor]));
  assert.equal(anchors.hero, "top");
  assert.equal(anchors.about, "profil");
  assert.equal(anchors.dosen, "dosen");
  assert.equal(anchors.news, "berita");
});

test("menu legacy menjadi struktur bertingkat", () => {
  const plan = buildMigration({ modules });
  assert.equal(plan.nav.length, 2);
  assert.equal(plan.nav[1].children?.[0].label, "Sejarah");
});

test("pengaturan global diambil dari brand/footer/pmbLink", () => {
  const plan = buildMigration({ modules });
  assert.equal(plan.settings?.brand.name, "TPB Uji");
  assert.equal(plan.settings?.pmbLink, "#pmb");
  assert.deepEqual(plan.settings?.footer.socials, [{ label: "Facebook", href: "https://www.facebook.com/tpb" }]);
});

test("statistik memakai site_stats bila modul stats kosong", () => {
  const plan = buildMigration({ modules: { ...modules, stats: [] }, siteStats: [{ value: 5, suffix: "%", label: "P" }] });
  const statsBlock = plan.page.blocks.find((b) => b.type === "stats");
  assert.ok(statsBlock && statsBlock.type === "stats");
  assert.deepEqual(statsBlock.data, [{ value: 5, suffix: "%", label: "P" }]);
});

test("galeri legacy menjadi blok gallery", () => {
  const plan = buildMigration({ modules, gallery: [{ image: "/media/g1.png", kind: "image" }, { image: "/media/v1.jpg", kind: "video", thumb: "/media/t.jpg" }] });
  const block = plan.page.blocks.find((b) => b.type === "gallery");
  assert.ok(block && block.type === "gallery");
  assert.equal(block.data.items.length, 2);
  assert.equal(block.data.items[1].kind, "video");
  assert.equal(block.anchor, "galeri");
});

test("data tidak valid dilewati dengan peringatan, bukan gagal total", () => {
  const plan = buildMigration({ modules: { ...modules, hero: { badge: 123 } } });
  assert.equal(plan.page.blocks.find((b) => b.type === "hero"), undefined);
  assert.ok(plan.warnings.some((w) => w.startsWith("hero dilewati")));
});

test("pengaturan tidak lengkap -> settings null + peringatan", () => {
  const plan = buildMigration({ modules: { hero } });
  assert.equal(plan.settings, null);
  assert.ok(plan.warnings.some((w) => w.includes("pengaturan global")));
});
