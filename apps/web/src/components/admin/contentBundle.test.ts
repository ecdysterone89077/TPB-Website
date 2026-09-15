import { describe, expect, it } from "vitest";
import type { SiteBundle } from "@tpb/contracts";
import { bundleFileName, bundlePreview, missingBundleMedia } from "./contentBundle";

const bundle = (over: Partial<SiteBundle> = {}): SiteBundle => ({
  version: 1,
  exportedAt: "2026-09-15T00:00:00.000Z",
  settings: null,
  nav: [],
  pages: [],
  posts: [],
  media: [],
  ...over,
});

const page = (slug: string) => ({ title: "Judul", slug, seoTitle: "", seoDescription: "", status: "draft" as const, blocks: [] });
const media = (url: string) => ({ url, filename: "", mimeType: "", size: 0, alt: "" });

describe("bundleFileName", () => {
  it("memakai format tpb-konten-YYYYMMDD-HHmm", () => {
    expect(bundleFileName(new Date(2026, 8, 15, 10, 5))).toBe("tpb-konten-20260915-1005.json");
    expect(bundleFileName(new Date(2026, 11, 3, 4, 30))).toBe("tpb-konten-20261203-0430.json");
  });
});

describe("missingBundleMedia", () => {
  it("hanya melaporkan path /media yang belum ada di server", () => {
    const missing = missingBundleMedia(
      [media("/media/ada.png"), media("/media/hilang.png"), media("https://cdn.test/x.png")],
      ["/media/ada.png"],
    );
    expect(missing).toEqual(["/media/hilang.png"]);
  });

  it("tanpa media yang hilang -> daftar kosong", () => {
    expect(missingBundleMedia([media("/media/ada.png")], ["/media/ada.png"])).toEqual([]);
  });
});

describe("bundlePreview", () => {
  it("menghitung halaman total, halaman baru, dan berita", () => {
    const preview = bundlePreview(
      bundle({
        pages: [page("beranda"), page("profil")],
        posts: [{ slug: "a", title: "A", category: "Kegiatan", excerpt: "", content: null, image: null, readTime: "", status: "published", date: "2026-09-01T00:00:00.000Z" }],
      }),
      ["beranda"],
    );
    expect(preview).toEqual({ pages: 2, newPages: 1, posts: 1 });
  });
});
