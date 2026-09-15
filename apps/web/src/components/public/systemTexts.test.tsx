import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SiteSettings } from "@tpb/contracts";
import { SiteContext } from "../../lib/site";
import { News } from "./ContentSections";
import { SearchButton } from "./Search";
import { CollectionState } from "./ui";

const { api } = vi.hoisted(() => ({ api: { listPublic: vi.fn() } }));

vi.mock("../../lib/api", () => ({ api }));

const baseSettings = (texts?: SiteSettings["texts"]): SiteSettings => ({
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

const withSite = (ui: ReactNode, texts?: SiteSettings["texts"]) =>
  render(<SiteContext.Provider value={{ status: "ready", settings: baseSettings(texts), nav: [], reload: async () => {} }}>{ui}</SiteContext.Provider>);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Teks sistem di komponen publik", () => {
  it("CollectionState memakai pesan kustom untuk error dan kosong", () => {
    api.listPublic.mockResolvedValue([]);
    withSite(
      <>
        <CollectionState loading={false} error="gagal" empty={false}>isi</CollectionState>
        <CollectionState loading={false} empty>isi</CollectionState>
      </>,
      { collectionError: "Gagal kustom", collectionEmpty: "Kosong kustom" },
    );

    expect(screen.getByText("Gagal kustom")).toBeTruthy();
    expect(screen.getByText("Kosong kustom")).toBeTruthy();
  });

  it("tab 'Semua' berita memakai label kustom", async () => {
    api.listPublic.mockResolvedValue([]);
    withSite(<News news={{ kicker: "Berita", title: "Berita" }} />, { newsAllTab: "Semua Berita" });

    expect(await screen.findByRole("button", { name: "Semua Berita" })).toBeTruthy();
  });

  it("placeholder pencarian memakai teks kustom", async () => {
    api.listPublic.mockResolvedValue([]);
    withSite(<SearchButton blocks={[]} navigation={[]} />, { searchPlaceholder: "Cari apa saja…" });

    fireEvent.click(screen.getByRole("button", { name: "Cari di situs" }));
    expect(await screen.findByPlaceholderText("Cari apa saja…")).toBeTruthy();
  });

  it("placeholder pencarian memakai bawaan tanpa pengaturan teks", async () => {
    api.listPublic.mockResolvedValue([]);
    withSite(<SearchButton blocks={[]} navigation={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Cari di situs" }));
    expect(await screen.findByPlaceholderText("Cari program, dosen, riset, berita… (min. 2 huruf)")).toBeTruthy();
  });

  it("menampilkan pesan saat indeks berita gagal dimuat", async () => {
    api.listPublic.mockRejectedValue(new Error("gagal"));
    withSite(<SearchButton blocks={[]} navigation={[]} />, { collectionError: "Gagal kustom" });

    fireEvent.click(screen.getByRole("button", { name: "Cari di situs" }));
    expect(await screen.findByText("Gagal kustom")).toBeTruthy();
  });
});
