import { describe, expect, it } from "vitest";
import { HOME_SLUG, hrefForPage, slugFromPath } from "./router";

describe("slugFromPath", () => {
  it("akar situs menjadi beranda", () => {
    expect(slugFromPath("/")).toBe(HOME_SLUG);
    expect(slugFromPath("")).toBe(HOME_SLUG);
    expect(slugFromPath("/beranda/")).toBe("beranda");
  });

  it("path lain menjadi slug", () => {
    expect(slugFromPath("/profil")).toBe("profil");
    expect(slugFromPath("/profil/")).toBe("profil");
    expect(slugFromPath("/akademik")).toBe("akademik");
  });

  it("path rusak tidak membuat crash", () => {
    expect(slugFromPath("/%E0%A4%A")).toBe("__tidak-valid__");
  });

  it("href halaman mengikuti aturan beranda", () => {
    expect(hrefForPage(HOME_SLUG)).toBe("/");
    expect(hrefForPage("profil")).toBe("/profil");
  });
});
