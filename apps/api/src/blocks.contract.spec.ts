import { BlockSchema, BlocksSchema, CtaSchema, FooterSchema, HeroSchema, PageInputSchema, NavigationInputSchema, RichTextSchema, SiteContentSchema, SiteSettingsSchema } from "@tpb/contracts";
import { sanitizeBlock, sanitizeHtml } from "./sanitize";

const heading = (text: string) => ({ type: "heading", data: { text, level: 2, align: "left" } });
const heroFixture = { badge: "", line1: "a", highlight: "b", line2: "c", subtitle: "", primaryLabel: "Daftar", primaryHref: "#pmb", secondaryLabel: "", image: "" };
const footerFixture = {
  newsletterTitle: "", infoTitle: "", quickLinksTitle: "", galleryTitle: "", submitLabel: "",
  socials: [],
  contact: { phone: "", email: "a@b.test", address: "" },
  quickLinks: [], copyright: "", tagline: "",
};

describe("BlockSchema", () => {
  it("menerima blok generik dan preset, mengisi default", () => {
    const parsed = BlocksSchema.parse([
      heading("Halo"),
      { type: "spacer", data: {} },
      { type: "image", data: { image: "/media/x.png" } },
      { type: "hero", data: { badge: "", line1: "a", highlight: "b", line2: "c", subtitle: "", primaryLabel: "Daftar", primaryHref: "#pmb", secondaryLabel: "", image: "" } },
      { type: "news", data: { kicker: "Berita", title: "Berita" } },
    ]);
    expect(parsed[0].isVisible).toBe(true);
    expect(parsed[1].data).toEqual({ size: "md" });
    expect(parsed[3].type).toBe("hero");
    expect(parsed[4].type).toBe("news");
  });

  it("menolak tipe blok tak dikenal dan data tidak sesuai", () => {
    expect(BlockSchema.safeParse({ type: "tidakAda", data: {} }).success).toBe(false);
    expect(BlockSchema.safeParse({ type: "heading", data: { text: "" } }).success).toBe(false);
    expect(BlockSchema.safeParse({ type: "gallery", data: { items: [{ image: "x" }], columns: 9 } }).success).toBe(false);
  });

  it("menerima video popup dan blok html", () => {
    const video = BlockSchema.parse({ type: "video", data: { url: "https://youtu.be/abc", mode: "popup" } });
    expect(video.type).toBe("video");
    const html = BlockSchema.parse({ type: "html", data: { code: "<p>x</p>" } });
    expect(html.type).toBe("html");
  });

  it("rich text hanya menerima node yang diizinkan", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Halo", marks: [{ type: "bold" }] }] }] };
    expect(RichTextSchema.safeParse(doc).success).toBe(true);
    expect(RichTextSchema.safeParse({ type: "doc", content: [{ type: "script", content: [] }] }).success).toBe(false);
  });
});

describe("PageInputSchema & NavigationInputSchema", () => {
  it("slug hanya huruf kecil, angka, dan tanda hubung", () => {
    expect(PageInputSchema.safeParse({ title: "Profil", slug: "profil-prodi" }).success).toBe(true);
    expect(PageInputSchema.safeParse({ title: "Profil", slug: "Profil Prodi" }).success).toBe(false);
    expect(PageInputSchema.safeParse({ title: "Profil", slug: "/profil" }).success).toBe(false);
  });

  it("menu mendukung anak bertingkat", () => {
    const out = NavigationInputSchema.parse({ items: [{ label: "A", href: "/a", children: [{ label: "B", href: "/b", openInNewTab: true }] }] });
    expect(out.items[0].children?.[0].openInNewTab).toBe(true);
  });

  it("menu menolak href javascript: dan kedalaman lebih dari 3", () => {
    expect(NavigationInputSchema.safeParse({ items: [{ label: "X", href: "javascript:alert(1)" }] }).success).toBe(false);
    const deep = { label: "A", href: "/a", children: [{ label: "B", href: "/b", children: [{ label: "C", href: "/c", children: [{ label: "D", href: "/d" }] }] }] };
    expect(NavigationInputSchema.safeParse({ items: [deep] }).success).toBe(false);
  });
});

describe("validasi tautan blok", () => {
  it("menolak href javascript: pada tombol dan gambar", () => {
    expect(BlockSchema.safeParse({ type: "button", data: { label: "Klik", href: "javascript:alert(1)" } }).success).toBe(false);
    expect(BlockSchema.safeParse({ type: "image", data: { image: "/media/a.png", link: "javascript:alert(1)" } }).success).toBe(false);
    expect(BlockSchema.safeParse({ type: "button", data: { label: "Klik", href: "https://tpb.test/x" } }).success).toBe(true);
    expect(BlockSchema.safeParse({ type: "button", data: { label: "Klik", href: "#pmb" } }).success).toBe(true);
  });

  it("preset dan settings juga menolak tautan tidak aman", () => {
    expect(HeroSchema.safeParse({ ...heroFixture, primaryHref: "javascript:alert(1)" }).success).toBe(false);
    expect(HeroSchema.safeParse({ ...heroFixture, primaryHref: "#pmb", secondaryHref: "https://tpb.test" }).success).toBe(true);
    expect(CtaSchema.safeParse({ title: "T", body: "B", primary: "P", secondary: "S", secondaryHref: "javascript:alert(1)" }).success).toBe(false);
    expect(FooterSchema.safeParse({ ...footerFixture, quickLinks: [{ label: "X", href: "javascript:alert(1)" }] }).success).toBe(false);
    expect(FooterSchema.safeParse({ ...footerFixture, socials: [{ label: "Facebook", href: "javascript:alert(1)" }] }).success).toBe(false);
    expect(SiteContentSchema.shape.pmbLink.safeParse("javascript:alert(1)").success).toBe(false);
    expect(SiteContentSchema.shape.pmbLink.safeParse("https://pmb.tpb.test").success).toBe(true);
  });

  it("menolak URL video/embed tanpa host dan gambar protocol-relative", () => {
    expect(BlockSchema.safeParse({ type: "video", data: { url: "https://" } }).success).toBe(false);
    expect(BlockSchema.safeParse({ type: "video", data: { url: "javascript:alert(1)" } }).success).toBe(false);
    expect(BlockSchema.safeParse({ type: "embed", data: { url: "https://maps.google.com/x" } }).success).toBe(true);
    expect(BlockSchema.safeParse({ type: "image", data: { image: "//evil.test/x.png" } }).success).toBe(false);
    expect(BlockSchema.safeParse({ type: "image", data: { image: "" } }).success).toBe(true);
  });

  it("rich text menolak mark link dengan href tidak aman", () => {
    const doc = (href: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href } }] }] }] });
    expect(RichTextSchema.safeParse(doc("https://tpb.test")).success).toBe(true);
    expect(RichTextSchema.safeParse(doc("javascript:alert(1)")).success).toBe(false);
  });

  it("anchor kosong dan lebih dari 120 karakter ditolak", () => {
    expect(BlockSchema.safeParse({ type: "heading", data: { text: "A", level: 2, align: "left" }, anchor: "" }).success).toBe(false);
    expect(BlockSchema.safeParse({ type: "heading", data: { text: "A", level: 2, align: "left" }, anchor: "a".repeat(121) }).success).toBe(false);
  });

  it("anchor harus slug huruf kecil (spasi/huruf besar ditolak)", () => {
    expect(BlockSchema.safeParse({ type: "heading", data: { text: "A", level: 2, align: "left" }, anchor: "Dosen Kami" }).success).toBe(false);
    expect(BlockSchema.safeParse({ type: "heading", data: { text: "A", level: 2, align: "left" }, anchor: "dosen-kami" }).success).toBe(true);
  });

  it("video boleh kosong (placeholder) tetapi URL teks harus tetap aman", () => {
    expect(BlockSchema.safeParse({ type: "video", data: { url: "" } }).success).toBe(true);
    expect(BlockSchema.safeParse({ type: "video", data: { url: "https://" } }).success).toBe(false);
    expect(BlockSchema.safeParse({ type: "video", data: { url: "https://www.youtube.com/watch?v=abc" } }).success).toBe(true);
  });
});

describe("blok docLink", () => {
  it("menerima tautan dokumen dan mengisi default", () => {
    const parsed = BlockSchema.parse({ type: "docLink", data: { links: [{ label: "Panduan Kurikulum", href: "https://drive.google.com/file/d/x" }] } });
    expect(parsed.type).toBe("docLink");
    if (parsed.type !== "docLink") throw new Error("tipe blok salah");
    expect(parsed.data.kicker).toBe("");
    expect(parsed.data.title).toBe("");
    expect(parsed.data.note).toBe("");
    expect(parsed.data.links[0].note).toBe("");
  });

  it("menolak daftar kosong, label kosong, tautan tidak aman, dan lebih dari 50 tautan", () => {
    expect(BlockSchema.safeParse({ type: "docLink", data: { links: [] } }).success).toBe(false);
    expect(BlockSchema.safeParse({ type: "docLink", data: { links: [{ label: "", href: "#x" }] } }).success).toBe(false);
    expect(BlockSchema.safeParse({ type: "docLink", data: { links: [{ label: "X", href: "javascript:alert(1)" }] } }).success).toBe(false);
    expect(BlockSchema.safeParse({ type: "docLink", data: { links: Array.from({ length: 51 }, (_, index) => ({ label: `L${index}`, href: "#x" })) } }).success).toBe(false);
  });

  it("menerima anchor dan tautan internal", () => {
    const parsed = BlockSchema.parse({
      type: "docLink",
      anchor: "kurikulum",
      data: { kicker: "Akademik · Kurikulum", title: "Kurikulum", note: "", links: [{ label: "Panduan Kurikulum 2026/2027", href: "#kurikulum", note: "" }] },
    });
    expect(parsed.anchor).toBe("kurikulum");
  });
});

describe("footer.socials", () => {
  it("menerima daftar media sosial berlabel", () => {
    const parsed = FooterSchema.parse({
      ...footerFixture,
      socials: [
        { label: "Instagram TPB UNU Purwokerto", href: "https://www.instagram.com/tpb_unupurwokerto/" },
        { label: "Instagram HIMATETA", href: "https://www.instagram.com/himateta.unupwt/" },
      ],
    });
    expect(parsed.socials.map((item) => item.label)).toEqual(["Instagram TPB UNU Purwokerto", "Instagram HIMATETA"]);
    expect(parsed.socials[1].href).toBe("https://www.instagram.com/himateta.unupwt/");
  });

  it("mengubah bentuk lama facebook/twitter/youtube/linkedin menjadi daftar", () => {
    const parsed = FooterSchema.parse({ ...footerFixture, socials: { facebook: "https://www.facebook.com/x", twitter: "", youtube: "https://www.youtube.com/@x", linkedin: "" } });
    expect(parsed.socials).toEqual([
      { label: "Facebook", href: "https://www.facebook.com/x" },
      { label: "YouTube", href: "https://www.youtube.com/@x" },
    ]);
    expect(FooterSchema.parse({ ...footerFixture, socials: { tiktok: "https://www.tiktok.com/@x" } }).socials).toEqual([{ label: "tiktok", href: "https://www.tiktok.com/@x" }]);
  });

  it("tanpa socials menjadi daftar kosong; label kosong dan bentuk bukan daftar ditolak", () => {
    expect(FooterSchema.parse({ ...footerFixture, socials: undefined }).socials).toEqual([]);
    expect(FooterSchema.safeParse({ ...footerFixture, socials: [{ label: "", href: "https://tpb.test" }] }).success).toBe(false);
    expect(FooterSchema.safeParse({ ...footerFixture, socials: [{ label: "X", href: "#top" }] }).success).toBe(true);
    expect(FooterSchema.safeParse({ ...footerFixture, socials: "bukan-array" }).success).toBe(false);
    expect(FooterSchema.safeParse({ ...footerFixture, socials: { facebook: "javascript:alert(1)" } }).success).toBe(false);
    expect(FooterSchema.safeParse({ ...footerFixture, socials: { facebook: 123 } }).success).toBe(false);
  });
});

describe("SiteSettingsSchema texts", () => {
  const base = {
    brand: { kicker: "", name: "TPB", org: "UNU", logoUrl: "" },
    pmbLink: "#pmb",
    footer: {
      newsletterTitle: "N", infoTitle: "I", quickLinksTitle: "T", galleryTitle: "G", submitLabel: "Kirim",
      socials: [],
      contact: { phone: "", email: "a@b.test", address: "Purwokerto" },
      quickLinks: [], copyright: "", tagline: "",
    },
  };

  it("tetap kompatibel tanpa texts dan menerima texts parsial", () => {
    expect(SiteSettingsSchema.safeParse(base).success).toBe(true);
    const parsed = SiteSettingsSchema.parse({ ...base, texts: { loading: "Menyiapkan…", pmb: { submitLabel: "Daftar" } } });
    expect(parsed.texts?.loading).toBe("Menyiapkan…");
    expect(parsed.texts?.pmb?.submitLabel).toBe("Daftar");
  });

  it("menolak teks melebihi batas", () => {
    expect(SiteSettingsSchema.safeParse({ ...base, texts: { titleSuffix: "x".repeat(161) } }).success).toBe(false);
    expect(SiteSettingsSchema.safeParse({ ...base, texts: { pmb: { submitLabel: "x".repeat(81) } } }).success).toBe(false);
  });
});

describe("sanitizeHtml", () => {
  it("membuang script dan event handler", () => {
    const out = sanitizeHtml('<p onclick="x()">aman</p><script>alert(1)</script><img src="x" onerror="h()">');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onerror");
    expect(out).toContain("<p>aman</p>");
  });

  it("menambah rel pada tautan dan membatasi iframe ke host tepercaya", () => {
    const link = sanitizeHtml('<a href="https://tpb.test" target="_blank">x</a>');
    expect(link).toContain('rel="noopener noreferrer"');
    const good = sanitizeHtml('<iframe src="https://www.youtube.com/embed/abc"></iframe>');
    expect(good).toContain("youtube.com/embed/abc");
    const bad = sanitizeHtml('<iframe src="https://evil.test/embed"></iframe>');
    expect(bad).not.toContain("evil.test");
  });

  it("sanitizeBlock hanya mengubah blok html", () => {
    const cleaned = sanitizeBlock({ type: "html", data: { code: "<b>x</b><script>1</script>" }, isVisible: true });
    expect(cleaned.type === "html" && cleaned.data.code).not.toContain("script");
    const headingBlock = sanitizeBlock({ type: "heading", data: { text: "<b>judul</b>", level: 2, align: "left" }, isVisible: true });
    expect(headingBlock.type === "heading" && headingBlock.data.text).toBe("<b>judul</b>");
  });
});
