import { BlockSchema, BlocksSchema, PageInputSchema, NavigationInputSchema, RichTextSchema } from "@tpb/contracts";
import { sanitizeBlock, sanitizeHtml } from "./sanitize";

const heading = (text: string) => ({ type: "heading", data: { text, level: 2, align: "left" } });

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
