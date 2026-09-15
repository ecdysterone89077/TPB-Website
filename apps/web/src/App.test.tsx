import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteSettings } from "@tpb/contracts";
import App from "./App";

const { api } = vi.hoisted(() => ({
  api: {
    getSettings: vi.fn(),
    getNav: vi.fn(),
    getPage: vi.fn(),
    getAnchors: vi.fn(),
    listPublic: vi.fn(),
  },
}));

vi.mock("./lib/api", () => ({ api }));

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const settings = (texts?: SiteSettings["texts"]): SiteSettings => ({
  brand: { kicker: "", name: "TPB", org: "UNU", logoUrl: "" },
  pmbLink: "#pmb",
  footer: {
    newsletterTitle: "N", infoTitle: "I", quickLinksTitle: "T", galleryTitle: "G", submitLabel: "Kirim",
    socials: { facebook: "", twitter: "", youtube: "", linkedin: "" },
    contact: { phone: "", email: "a@b.test", address: "Purwokerto" },
    quickLinks: [], copyright: "", tagline: "",
  },
  ...(texts ? { texts } : {}),
});

const page = {
  id: "p1", slug: "beranda", title: "Beranda", seoTitle: null, seoDescription: null, ogImage: null,
  publishedAt: null, updatedAt: "2026-09-15T00:00:00.000Z",
  blocks: [{ id: "b1", type: "heading", data: { text: "Halo", level: 2, align: "left" }, isVisible: true }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IntersectionObserver", NoopObserver);
  window.history.replaceState({}, "", "/");
  api.getNav.mockResolvedValue([]);
  api.listPublic.mockResolvedValue([]);
  api.getAnchors.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App — teks sistem", () => {
  it("memakai akhiran judul situs kustom tanpa mengambil ulang halaman", async () => {
    api.getSettings.mockResolvedValue(settings({ titleSuffix: "UNU Uji" }));
    api.getPage.mockResolvedValue(page);

    render(<App />);

    await waitFor(() => expect(document.title).toBe("Beranda · UNU Uji"));
    expect(api.getPage).toHaveBeenCalledTimes(1);
  });

  it("memakai judul, isi, dan tombol 404 kustom", async () => {
    api.getSettings.mockResolvedValue(settings({ notFoundTitle: "Halaman Hilang", notFoundBody: "Tidak ada di sini.", backLabel: "Balik" }));
    api.getPage.mockResolvedValue(null);

    render(<App />);

    expect(await screen.findByText("Halaman Hilang")).toBeTruthy();
    expect(screen.getByText("Tidak ada di sini.")).toBeTruthy();
    expect(screen.getByText("Balik")).toBeTruthy();
    await waitFor(() => expect(document.title).toBe("Halaman Hilang · TPB UNU Purwokerto"));
  });

  it("memakai judul dan isi error kustom", async () => {
    api.getSettings.mockResolvedValue(settings({ errorTitle: "Situs Bermasalah", errorBody: "Coba beberapa saat lagi." }));
    api.getPage.mockRejectedValue(new Error("jaringan"));

    render(<App />);

    expect(await screen.findByText("Situs Bermasalah")).toBeTruthy();
    expect(screen.getByText("Coba beberapa saat lagi.")).toBeTruthy();
    await waitFor(() => expect(document.title).toBe("Situs Bermasalah · TPB UNU Purwokerto"));
  });

  it("memakai judul bawaan saat teks tidak diatur", async () => {
    api.getSettings.mockResolvedValue(settings());
    api.getPage.mockResolvedValue(null);

    render(<App />);

    expect(await screen.findByText("404 — Halaman tidak ditemukan")).toBeTruthy();
    expect(screen.getByText("Kembali ke Beranda")).toBeTruthy();
  });
});
