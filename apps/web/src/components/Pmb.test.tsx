import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteSettings } from "@tpb/contracts";
import { Pmb } from "./Pmb";
import { SiteContext } from "../lib/site";

const { api } = vi.hoisted(() => ({ api: { registerPmb: vi.fn() } }));

vi.mock("../lib/api", () => ({ api }));

const baseSettings = (texts?: SiteSettings["texts"]): SiteSettings => ({
  brand: { kicker: "", name: "TPB", org: "UNU", logoUrl: "" },
  pmbLink: "#pmb",
  footer: {
    newsletterTitle: "N", infoTitle: "I", quickLinksTitle: "T", galleryTitle: "G", submitLabel: "Kirim",
    socials: [],
    contact: { phone: "", email: "a@b.test", address: "Purwokerto" },
    quickLinks: [], copyright: "", tagline: "",
  },
  ...(texts ? { texts } : {}),
});

const withSite = (ui: ReactNode, texts?: SiteSettings["texts"]) =>
  render(<SiteContext.Provider value={{ status: "ready", settings: baseSettings(texts), nav: [], reload: async () => {} }}>{ui}</SiteContext.Provider>);

beforeEach(() => {
  vi.stubGlobal("crypto", { randomUUID: () => "uji-uuid" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Pmb — teks sistem", () => {
  it("memakai teks bawaan bila tidak diatur", () => {
    withSite(<Pmb onClose={vi.fn()} programs={["Teknik Pertanian"]} />);

    expect(screen.getByText("Pendaftaran PMB")).toBeTruthy();
    expect(screen.getByPlaceholderText("Nama lengkap")).toBeTruthy();
    expect(screen.getByPlaceholderText("Nomor WhatsApp / telepon")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kirim" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Batal" })).toBeTruthy();
  });

  it("memakai teks kustom dari pengaturan situs", () => {
    withSite(<Pmb onClose={vi.fn()} programs={[]} />, { pmb: { title: "Daftar Sekarang", namePlaceholder: "Nama Anda", submitLabel: "Daftar" } });

    expect(screen.getByText("Daftar Sekarang")).toBeTruthy();
    expect(screen.getByPlaceholderText("Nama Anda")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Daftar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Batal" })).toBeTruthy();
  });

  it("memakai teks kustom pada layar sukses setelah kirim", async () => {
    api.registerPmb.mockResolvedValue({});
    withSite(<Pmb onClose={vi.fn()} programs={[]} />, {
      pmb: { doneTitle: "Terdaftar!", doneBody: "Kami hubungi via WA.", closeLabel: "Selesai", namePlaceholder: "Nama", emailPlaceholder: "Surel", phonePlaceholder: "WA", messagePlaceholder: "Catatan" },
    });

    fireEvent.change(screen.getByPlaceholderText("Nama"), { target: { value: "Budi" } });
    fireEvent.change(screen.getByPlaceholderText("Surel"), { target: { value: "budi@uji.test" } });
    fireEvent.change(screen.getByPlaceholderText("WA"), { target: { value: "0812345" } });
    fireEvent.click(screen.getByRole("button", { name: "Kirim" }));

    expect(await screen.findByText("Terdaftar!")).toBeTruthy();
    expect(screen.getByText("Kami hubungi via WA.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Selesai" })).toBeTruthy();
    expect(api.registerPmb).toHaveBeenCalledWith(expect.objectContaining({ name: "Budi", email: "budi@uji.test", phone: "0812345" }));
  });
});
