import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAnchorCache, resolveAnchorHref, scrollOrResolve } from "./anchors";

const { api } = vi.hoisted(() => ({ api: { getAnchors: vi.fn() } }));

vi.mock("./api", () => ({ api }));

beforeEach(() => {
  vi.clearAllMocks();
  resetAnchorCache();
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "/");
  Element.prototype.scrollIntoView = vi.fn();
});

describe("resolveAnchorHref", () => {
  it("tidak memanggil API jika anchor ada di halaman sekarang", async () => {
    document.body.innerHTML = '<div id="dosen"></div>';
    await expect(resolveAnchorHref("beranda", "dosen")).resolves.toBeNull();
    expect(api.getAnchors).not.toHaveBeenCalled();
  });

  it("mengembalikan href halaman lain yang memuat anchor", async () => {
    api.getAnchors.mockResolvedValue({ dosen: "profil" });
    await expect(resolveAnchorHref("beranda", "dosen")).resolves.toBe("/profil#dosen");
  });

  it("anchor di beranda memakai href akar", async () => {
    api.getAnchors.mockResolvedValue({ kurikulum: "beranda" });
    window.history.replaceState({}, "", "/profil");
    await expect(resolveAnchorHref("profil", "kurikulum")).resolves.toBe("/#kurikulum");
  });

  it("anchor tak dikenal -> null", async () => {
    api.getAnchors.mockResolvedValue({});
    await expect(resolveAnchorHref("beranda", "hilang")).resolves.toBeNull();
  });

  it("nama bawaan Object tidak dianggap anchor", async () => {
    api.getAnchors.mockResolvedValue({});
    await expect(resolveAnchorHref("beranda", "constructor")).resolves.toBeNull();
    await expect(resolveAnchorHref("beranda", "toString")).resolves.toBeNull();
  });

  it("anchor di halaman yang sama tapi elemen hilang -> null (tanpa loop)", async () => {
    api.getAnchors.mockResolvedValue({ dosen: "beranda" });
    await expect(resolveAnchorHref("beranda", "dosen")).resolves.toBeNull();
  });

  it("anchor kosong -> null tanpa panggil API", async () => {
    await expect(resolveAnchorHref("beranda", "")).resolves.toBeNull();
    expect(api.getAnchors).not.toHaveBeenCalled();
  });

  it("gagal memuat anchors -> null (tanpa crash)", async () => {
    api.getAnchors.mockRejectedValue(new Error("jaringan"));
    await expect(resolveAnchorHref("beranda", "dosen")).resolves.toBeNull();
  });

  it("hasil resolusi di-cache sekali panggil", async () => {
    api.getAnchors.mockResolvedValue({ dosen: "profil" });
    await resolveAnchorHref("beranda", "dosen");
    await resolveAnchorHref("beranda", "sejarah");
    expect(api.getAnchors).toHaveBeenCalledTimes(1);
  });
});

describe("scrollOrResolve", () => {
  it("menggulir jika elemen ada di halaman sekarang", () => {
    document.body.innerHTML = '<div id="dosen"></div>';
    scrollOrResolve("beranda", "#dosen");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(api.getAnchors).not.toHaveBeenCalled();
  });

  it("hash kosong tidak memanggil API", () => {
    scrollOrResolve("beranda", "");
    scrollOrResolve("beranda", "#");
    expect(api.getAnchors).not.toHaveBeenCalled();
  });

  it("mengarahkan ke halaman anchor tanpa menambah riwayat", async () => {
    api.getAnchors.mockResolvedValue({ dosen: "profil" });
    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    scrollOrResolve("beranda", "#dosen");
    await vi.waitFor(() => expect(window.location.pathname).toBe("/profil"));
    expect(window.location.hash).toBe("#dosen");
    expect(replaceSpy).toHaveBeenCalledWith({}, "", "/profil#dosen");
    expect(pushSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
    replaceSpy.mockRestore();
  });

  it("tidak mengganti URL jika pengguna sudah pindah saat resolusi berjalan", async () => {
    let release: (value: Record<string, string>) => void = () => {};
    api.getAnchors.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    scrollOrResolve("beranda", "#dosen");
    window.history.replaceState({}, "", "/berita");
    release({ dosen: "profil" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(window.location.pathname).toBe("/berita");
    expect(window.location.hash).toBe("");
  });

  it("tidak mengubah URL saat panel admin sedang terbuka", async () => {
    api.getAnchors.mockResolvedValue({ dosen: "profil" });
    window.history.replaceState({}, "", "/#admin");
    scrollOrResolve("beranda", "#dosen");
    await vi.waitFor(() => expect(api.getAnchors).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("#admin");
  });
});
