import { describe, expect, it } from "vitest";
import { NavItemInputSchema, type Block } from "@tpb/contracts";
import { HOME_SLUG } from "../../lib/router";
import { anchorChoices, buildNavHref, parseNavHref, type NavLinkValue } from "./navLink";

const block = (type: string, anchor?: string, isVisible = true) => ({ type, data: {}, isVisible, ...(anchor ? { anchor } : {}) }) as unknown as Block;

describe("parseNavHref", () => {
  it("mengenali halaman dalam situs", () => {
    expect(parseNavHref("/")).toMatchObject({ mode: "page", slug: HOME_SLUG, anchor: "" });
    expect(parseNavHref("/profil")).toMatchObject({ mode: "page", slug: "profil", anchor: "" });
    expect(parseNavHref("/profil/")).toMatchObject({ mode: "page", slug: "profil", anchor: "" });
  });

  it("mengenali anchor halaman", () => {
    expect(parseNavHref("/#dosen")).toMatchObject({ mode: "page", slug: HOME_SLUG, anchor: "dosen" });
    expect(parseNavHref("/profil#dosen")).toMatchObject({ mode: "page", slug: "profil", anchor: "dosen" });
    expect(parseNavHref("#dosen")).toMatchObject({ mode: "page", slug: HOME_SLUG, anchor: "dosen" });
  });

  it("mengenali URL eksternal, telepon, dan email", () => {
    expect(parseNavHref("https://tpb.test/pmb")).toMatchObject({ mode: "url", value: "https://tpb.test/pmb" });
    expect(parseNavHref("tel:+628123456789")).toMatchObject({ mode: "phone", value: "+628123456789" });
    expect(parseNavHref("mailto:halo@tpb.test")).toMatchObject({ mode: "email", value: "halo@tpb.test" });
  });

  it("tautan lain diperlakukan sebagai URL agar tidak hilang", () => {
    expect(parseNavHref("contoh")).toMatchObject({ mode: "url", value: "contoh" });
  });
});

describe("buildNavHref", () => {
  it("membangun href halaman sesuai aturan beranda", () => {
    expect(buildNavHref({ mode: "page", slug: HOME_SLUG, anchor: "", value: "" })).toBe("/");
    expect(buildNavHref({ mode: "page", slug: "profil", anchor: "", value: "" })).toBe("/profil");
    expect(buildNavHref({ mode: "page", slug: HOME_SLUG, anchor: "dosen", value: "" })).toBe("/#dosen");
    expect(buildNavHref({ mode: "page", slug: "profil", anchor: "dosen", value: "" })).toBe("/profil#dosen");
  });

  it("membangun URL eksternal, telepon, dan email", () => {
    expect(buildNavHref({ mode: "url", slug: HOME_SLUG, anchor: "", value: " https://tpb.test " })).toBe("https://tpb.test");
    expect(buildNavHref({ mode: "phone", slug: HOME_SLUG, anchor: "", value: " +62 812 345" })).toBe("tel:+62812345");
    expect(buildNavHref({ mode: "email", slug: HOME_SLUG, anchor: "", value: "halo@tpb.test" })).toBe("mailto:halo@tpb.test");
  });

  it("href hasil picker lolos validasi NavItemInputSchema", () => {
    const values: NavLinkValue[] = [
      { mode: "page", slug: HOME_SLUG, anchor: "", value: "" },
      { mode: "page", slug: "profil", anchor: "dosen", value: "" },
      { mode: "url", slug: HOME_SLUG, anchor: "", value: "https://tpb.test/pmb" },
      { mode: "phone", slug: HOME_SLUG, anchor: "", value: "+62 812-345" },
      { mode: "email", slug: HOME_SLUG, anchor: "", value: "halo@tpb.test" },
    ];
    for (const value of values) {
      expect(NavItemInputSchema.safeParse({ label: "Menu", href: buildNavHref(value) }).success).toBe(true);
    }
  });

  it("telepon/email kosong tidak dianggap tautan valid", () => {
    expect(NavItemInputSchema.safeParse({ label: "Menu", href: buildNavHref({ mode: "phone", slug: HOME_SLUG, anchor: "", value: "" }) }).success).toBe(false);
    expect(NavItemInputSchema.safeParse({ label: "Menu", href: buildNavHref({ mode: "url", slug: HOME_SLUG, anchor: "", value: "example.com" }) }).success).toBe(false);
  });

  it("slug kosong kembali ke beranda", () => {
    expect(buildNavHref({ mode: "page", slug: "", anchor: "", value: "" })).toBe("/");
  });

  it("round-trip parse -> build tetap sama", () => {
    const samples = ["/", "/profil", "/#dosen", "/profil#sejarah", "https://tpb.test", "tel:+628123456789", "mailto:halo@tpb.test"];
    for (const href of samples) {
      expect(buildNavHref(parseNavHref(href))).toBe(href);
    }
  });

  it("anchor tanpa slug dinormalkan ke beranda", () => {
    expect(buildNavHref(parseNavHref("#kurikulum"))).toBe("/#kurikulum");
  });

  it("round-trip value -> build -> parse tetap sama", () => {
    const values: NavLinkValue[] = [
      { mode: "page", slug: "profil", anchor: "dosen", value: "" },
      { mode: "url", slug: HOME_SLUG, anchor: "", value: "https://tpb.test/pmb" },
      { mode: "phone", slug: HOME_SLUG, anchor: "", value: "+628123456789" },
      { mode: "email", slug: HOME_SLUG, anchor: "", value: "halo@tpb.test" },
    ];
    for (const value of values) {
      expect(parseNavHref(buildNavHref(value))).toMatchObject(value);
    }
  });
});

describe("anchorChoices", () => {
  it("memakai label spec blok dan nilai anchor", () => {
    const choices = anchorChoices([block("dosen", "dosen"), block("kurikulum", "kurikulum")]);
    expect(choices).toEqual([
      { value: "dosen", label: "Daftar dosen — #dosen" },
      { value: "kurikulum", label: "Kurikulum — #kurikulum" },
    ]);
  });

  it("mengabaikan blok tanpa anchor dan anchor ganda", () => {
    const choices = anchorChoices([block("heading"), block("heading", "sama"), block("dosen", "sama")]);
    expect(choices).toEqual([{ value: "sama", label: "Judul — #sama" }]);
  });

  it("mengabaikan blok yang disembunyikan dari publik", () => {
    const choices = anchorChoices([block("heading", "tampil"), block("dosen", "sembunyi", false)]);
    expect(choices).toEqual([{ value: "tampil", label: "Judul — #tampil" }]);
  });

  it("memakai nama tipe sebagai label cadangan untuk spesifikasi tak dikenal", () => {
    expect(anchorChoices([block("legacy", "lama")])).toEqual([{ value: "lama", label: "legacy — #lama" }]);
  });
});
