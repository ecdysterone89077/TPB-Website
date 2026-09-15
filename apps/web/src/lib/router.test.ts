import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOME_SLUG, hrefForPage, navigate, scrollToHash, slugFromPath } from "./router";

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

describe("navigate", () => {
  let scrollIntoView: (arg?: boolean | ScrollIntoViewOptions) => void;

  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    document.body.innerHTML = "";
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("menggulir ke anchor setelah pushState saat elemen ada di halaman", () => {
    document.body.innerHTML = '<div id="dosen"></div>';
    navigate("/#dosen");
    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("#dosen");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("tidak menggulir jika anchor tidak ada di halaman sekarang", () => {
    navigate("/profil#dosen");
    expect(window.location.pathname).toBe("/profil");
    expect(window.location.hash).toBe("#dosen");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("navigasi tanpa hash tidak menggulir", () => {
    navigate("/profil");
    expect(window.location.pathname).toBe("/profil");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("pushState dipakai dan event popstate/tpb:navigate dipancarkan", () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    const popstate = vi.fn();
    const tpb = vi.fn();
    window.addEventListener("popstate", popstate);
    window.addEventListener("tpb:navigate", tpb);
    navigate("/profil");
    expect(pushSpy).toHaveBeenCalledWith({}, "", "/profil");
    expect(popstate).toHaveBeenCalledTimes(1);
    expect(tpb).toHaveBeenCalledTimes(1);
    window.removeEventListener("popstate", popstate);
    window.removeEventListener("tpb:navigate", tpb);
    pushSpy.mockRestore();
  });

  it("navigasi ke URL yang sama tidak menambah riwayat", () => {
    navigate("/profil");
    const pushSpy = vi.spyOn(window.history, "pushState");
    navigate("/profil");
    expect(pushSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
  });

  it("navigasi pengganti memakai replaceState agar Back tidak memantul", () => {
    navigate("/profil");
    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    navigate("/akademik#dosen", { replace: true });
    expect(replaceSpy).toHaveBeenCalledWith({}, "", "/akademik#dosen");
    expect(pushSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
    replaceSpy.mockRestore();
  });

  it("anchor halaman yang sama tetap menggulir setelah pushState", () => {
    window.history.replaceState({}, "", "/profil");
    document.body.innerHTML = '<div id="sejarah"></div>';
    navigate("/profil#sejarah");
    expect(window.location.hash).toBe("#sejarah");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });
});

describe("scrollToHash", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("mengabaikan hash kosong", () => {
    scrollToHash("");
    scrollToHash("#");
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("menggulir ke elemen target", () => {
    document.body.innerHTML = '<div id="pmb"></div>';
    scrollToHash("#pmb");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });
});
