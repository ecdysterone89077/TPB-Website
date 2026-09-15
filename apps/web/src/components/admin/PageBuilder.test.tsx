import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUser, SiteBundle } from "@tpb/contracts";
import { PageBuilder } from "./PageBuilder";
import { resetAnchorCache } from "../../lib/anchors";

const { api } = vi.hoisted(() => ({
  api: {
    getAdminPages: vi.fn(),
    getAdminPage: vi.fn(),
    exportContent: vi.fn(),
    importContent: vi.fn(),
    listMedia: vi.fn(),
  },
}));

vi.mock("../../lib/api", () => ({ api }));
vi.mock("../../lib/anchors", () => ({ resetAnchorCache: vi.fn() }));

const admin: AdminUser = { id: "u1", email: "admin@uji.test", name: "Admin", role: "ADMIN", isActive: true, createdAt: "", lastLoginAt: null };
const editor: AdminUser = { ...admin, role: "EDITOR" };

const pageData = {
  id: "p1", slug: "beranda", title: "Beranda", status: "published" as const,
  seoTitle: null, seoDescription: null, ogImage: null, publishedAt: null, updatedAt: "2026-09-15T00:00:00.000Z",
  blocks: [{ id: "b1", type: "heading", data: { text: "Halo", level: 2, align: "left" }, isVisible: true }],
};

const bundle: SiteBundle = {
  version: 1,
  exportedAt: "2026-09-15T00:00:00.000Z",
  settings: null,
  nav: [],
  pages: [{ title: "Beranda", slug: "beranda", seoTitle: "", seoDescription: "", status: "published", blocks: [{ type: "heading", data: { text: "Halo", level: 2, align: "left" }, isVisible: true }] }],
  posts: [],
  media: [{ url: "/media/hilang.png", filename: "hilang.png", mimeType: "image/png", size: 1, alt: "" }],
};

let downloadedName = "";

beforeEach(() => {
  vi.clearAllMocks();
  downloadedName = "";
  api.getAdminPages.mockResolvedValue({ pages: [{ id: "p1", slug: "beranda", title: "Beranda", status: "published", publishedAt: null, updatedAt: "" }], pagination: { limit: 100, offset: 0, total: 1, hasMore: false } });
  api.getAdminPage.mockResolvedValue(pageData);
  api.exportContent.mockResolvedValue(bundle);
  api.importContent.mockResolvedValue({ pagesCreated: 0, pagesUpdated: 1, postsCreated: 0, postsUpdated: 0, settingsUpdated: 1, navUpdated: 0, mediaMissing: ["/media/hilang.png"] });
  api.listMedia.mockResolvedValue({ media: [], pagination: { limit: 100, offset: 0, total: 0, hasMore: false } });
  (URL as any).createObjectURL = vi.fn(() => "blob:uji");
  (URL as any).revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { downloadedName = this.download; });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PageBuilder — bundel konten", () => {
  it("ADMIN dapat mengekspor konten sebagai berkas JSON", async () => {
    render(<PageBuilder user={admin} />);
    const button = await screen.findByRole("button", { name: "Ekspor konten" });

    fireEvent.click(button);

    await waitFor(() => expect(api.exportContent).toHaveBeenCalledTimes(1));
    expect((URL as any).createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (URL as any).createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await blob.text())).toEqual(bundle);
    expect(downloadedName).toMatch(/^tpb-konten-\d{8}-\d{4}\.json$/);
    expect(await screen.findByText(/Konten diekspor/i)).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((URL as any).revokeObjectURL).toHaveBeenCalledWith("blob:uji");
  });

  it("ADMIN dapat mengimpor bundel setelah konfirmasi dan melihat ringkasan", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    api.listMedia
      .mockResolvedValueOnce({ media: [{ id: "m1", url: "/media/ada.png", filename: "ada.png", mimeType: "image/png", size: 1, alt: null, createdAt: "" }], pagination: { limit: 100, offset: 0, total: 101, hasMore: true } })
      .mockResolvedValueOnce({ media: [], pagination: { limit: 100, offset: 100, total: 101, hasMore: false } });
    render(<PageBuilder user={admin} />);
    await screen.findByRole("button", { name: "Impor konten" });

    const file = new File([JSON.stringify(bundle)], "konten.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("File bundel konten"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: /Terapkan impor/ }));

    await waitFor(() => expect(api.importContent).toHaveBeenCalledTimes(1));
    expect(api.importContent.mock.calls[0][0]).toEqual(bundle);
    expect(api.listMedia.mock.calls.map((call) => call[0].offset)).toEqual([0, 100]);
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("/media/hilang.png"));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Menu navigasi diganti seluruhnya"));
    expect(resetAnchorCache).toHaveBeenCalledTimes(1);
    expect(api.getAdminPages).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/Impor selesai.*1 halaman diperbarui.*1 media belum ada/s)).toBeTruthy();
  });

  it("batal pada konfirmasi tidak mengimpor dan berkas tetap bisa diterapkan", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<PageBuilder user={admin} />);
    await screen.findByRole("button", { name: "Impor konten" });

    const file = new File([JSON.stringify(bundle)], "konten.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("File bundel konten"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: /Terapkan impor/ }));

    expect(await screen.findByText("Impor dibatalkan.")).toBeTruthy();
    expect(api.importContent).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Terapkan impor/ })).toBeEnabled();
  });

  it("kegagalan impor menampilkan error dan tombol dapat dicoba lagi", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.importContent.mockRejectedValue(new Error("gagal server"));
    render(<PageBuilder user={admin} />);
    await screen.findByRole("button", { name: "Impor konten" });

    const file = new File([JSON.stringify(bundle)], "konten.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("File bundel konten"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: /Terapkan impor/ }));

    expect(await screen.findByText("gagal server")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Terapkan impor/ })).toBeEnabled();
    expect(resetAnchorCache).not.toHaveBeenCalled();
  });

  it("berkas melebihi 10 MB ditolak sebelum dibaca", async () => {
    render(<PageBuilder user={admin} />);
    await screen.findByRole("button", { name: "Impor konten" });

    const big = new File(["{}"], "besar.json", { type: "application/json" });
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("File bundel konten"), { target: { files: [big] } });
    fireEvent.click(await screen.findByRole("button", { name: /Terapkan impor/ }));

    expect(await screen.findByText(/melebihi 10 MB/i)).toBeTruthy();
    expect(api.importContent).not.toHaveBeenCalled();
  });

  it("tombol Batal impor membersihkan pilihan berkas", async () => {
    render(<PageBuilder user={admin} />);
    await screen.findByRole("button", { name: "Impor konten" });

    const file = new File([JSON.stringify(bundle)], "konten.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("File bundel konten"), { target: { files: [file] } });
    expect(await screen.findByRole("button", { name: /Terapkan impor/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Batal impor" }));
    expect(screen.queryByRole("button", { name: /Terapkan impor/ })).toBeNull();
  });

  it("berkas rusak ditolak tanpa memanggil API impor", async () => {
    render(<PageBuilder user={admin} />);
    await screen.findByRole("button", { name: "Impor konten" });

    const file = new File(["{rusak"], "rusak.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("File bundel konten"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: /Terapkan impor/ }));

    expect(await screen.findByText(/JSON yang valid/i)).toBeTruthy();
    expect(api.importContent).not.toHaveBeenCalled();
  });

  it("bundel tidak sesuai kontrak ditolak tanpa memanggil API impor", async () => {
    render(<PageBuilder user={admin} />);
    await screen.findByRole("button", { name: "Impor konten" });

    const file = new File([JSON.stringify({ version: 2 })], "salah.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("File bundel konten"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: /Terapkan impor/ }));

    expect(await screen.findByText(/Bundel tidak valid/i)).toBeTruthy();
    expect(api.importContent).not.toHaveBeenCalled();
  });

  it("EDITOR tidak melihat tombol ekspor/impor", async () => {
    render(<PageBuilder user={editor} />);
    await screen.findByRole("button", { name: "+ Halaman baru" });

    expect(screen.queryByRole("button", { name: "Ekspor konten" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Impor konten" })).toBeNull();
  });
});
