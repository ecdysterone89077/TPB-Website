import { ImportSummarySchema, SiteBundleSchema } from "@tpb/contracts";

const settings = {
  brand: { kicker: "Teknik", name: "TPB", org: "UNU Purwokerto", logoUrl: "" },
  pmbLink: "#pmb",
  footer: {
    newsletterTitle: "N", infoTitle: "I", quickLinksTitle: "T", galleryTitle: "G", submitLabel: "Kirim",
    socials: { facebook: "", twitter: "", youtube: "", linkedin: "" },
    contact: { phone: "", email: "a@b.test", address: "" },
    quickLinks: [], copyright: "", tagline: "",
  },
};

const page = (slug: string, over: Record<string, unknown> = {}) => ({ title: "Judul", slug, seoTitle: "", seoDescription: "", status: "draft", blocks: [], ...over });
const post = (slug: string, over: Record<string, unknown> = {}) => ({ slug, title: "Berita", category: "Kegiatan", excerpt: "", content: null, image: null, readTime: "", status: "published", date: "2026-09-01T00:00:00.000Z", ...over });
const media = (url: string, over: Record<string, unknown> = {}) => ({ url, filename: "a.png", mimeType: "image/png", size: 10, alt: "", ...over });
const bundle = (over: Record<string, unknown> = {}) => ({ version: 1, exportedAt: "2026-09-15T00:00:00.000Z", settings, nav: [], pages: [], posts: [], media: [], ...over });

describe("SiteBundleSchema", () => {
  it("menerima bundel lengkap dan mengisi default", () => {
    const parsed = SiteBundleSchema.parse(bundle({
      pages: [{ title: "Beranda", slug: "beranda", status: "published", blocks: [{ type: "heading", data: { text: "Halo" } }] }],
      posts: [{ slug: "berita-1", title: "Berita", category: "Kegiatan", date: "2026-09-01T00:00:00.000Z" }],
      media: [{ url: "/media/a.png" }],
    }));
    expect(parsed.version).toBe(1);
    expect(parsed.pages[0].seoTitle).toBe("");
    expect(parsed.pages[0].blocks[0].isVisible).toBe(true);
    expect(parsed.posts[0].status).toBe("draft");
    expect(parsed.posts[0].excerpt).toBe("");
    expect(parsed.media[0].filename).toBe("");
    expect(parsed.media[0].size).toBe(0);
  });

  it("menolak menu lebih dari 3 tingkat dan menerima tepat 3 tingkat", () => {
    const three = [{ label: "Satu", href: "/", children: [{ label: "Dua", href: "/a", children: [{ label: "Tiga", href: "/b" }] }] }];
    const four = [{ label: "Satu", href: "/", children: [{ label: "Dua", href: "/a", children: [{ label: "Tiga", href: "/b", children: [{ label: "Empat", href: "/c" }] }] }] }];
    expect(SiteBundleSchema.safeParse(bundle({ nav: three })).success).toBe(true);
    expect(SiteBundleSchema.safeParse(bundle({ nav: four })).success).toBe(false);
  });

  it("menolak berita tanpa tanggal", () => {
    const withoutDate = { slug: "tanpa-tanggal", title: "Berita", category: "Kegiatan" };
    expect(SiteBundleSchema.safeParse(bundle({ posts: [withoutDate] })).success).toBe(false);
  });

  it("settings boleh null (tanpa fallback)", () => {
    expect(SiteBundleSchema.parse(bundle({ settings: null })).settings).toBeNull();
  });

  it("menolak versi tak dikenal dan tanggal tidak valid", () => {
    expect(SiteBundleSchema.safeParse(bundle({ version: 2 })).success).toBe(false);
    expect(SiteBundleSchema.safeParse(bundle({ exportedAt: "kemarin" })).success).toBe(false);
  });

  it("menolak slug halaman ganda", () => {
    expect(SiteBundleSchema.safeParse(bundle({ pages: [page("profil"), page("profil")] })).success).toBe(false);
  });

  it("menolak slug berita ganda", () => {
    expect(SiteBundleSchema.safeParse(bundle({ posts: [post("sama"), post("sama")] })).success).toBe(false);
  });

  it("menolak blok halaman tidak valid", () => {
    expect(SiteBundleSchema.safeParse(bundle({ pages: [page("beranda", { blocks: [{ type: "heading", data: { text: "" } }] })] })).success).toBe(false);
  });

  it("menolak media tanpa url", () => {
    expect(SiteBundleSchema.safeParse(bundle({ media: [media("")] })).success).toBe(false);
  });

  it("menolak menu tidak aman", () => {
    expect(SiteBundleSchema.safeParse(bundle({ nav: [{ label: "X", href: "javascript:alert(1)" }] })).success).toBe(false);
  });
});

describe("ImportSummarySchema", () => {
  it("menerima ringkasan valid dan menolak angka negatif", () => {
    expect(ImportSummarySchema.safeParse({ pagesCreated: 1, pagesUpdated: 2, postsCreated: 3, postsUpdated: 4, settingsUpdated: 1, navUpdated: 8, mediaMissing: ["/media/a.png"] }).success).toBe(true);
    expect(ImportSummarySchema.safeParse({ pagesCreated: -1, pagesUpdated: 0, postsCreated: 0, postsUpdated: 0, settingsUpdated: 0, navUpdated: 0, mediaMissing: [] }).success).toBe(false);
  });
});
