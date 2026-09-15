import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "./AdminPage";
const { api } = vi.hoisted(() => ({
  api: {
    currentUser: vi.fn(),
    dashboardSummary: vi.fn(),
    listAll: vi.fn(),
    logout: vi.fn(),
    getAdminPages: vi.fn(),
    getAdminPage: vi.fn(),
  },
}));

vi.mock("../lib/api", () => ({ api }));

beforeEach(() => {
  vi.clearAllMocks();
  api.currentUser.mockResolvedValue({ id: "admin-1", email: "admin@uji.test", name: "Admin Uji", role: "ADMIN", isActive: true });
  api.dashboardSummary.mockResolvedValue({ posts: 0, newPmb: 0, subscribers: 0, media: 0, audit: [] });
  api.listAll.mockResolvedValue({ posts: [], pagination: { total: 0, limit: 50, offset: 0 } });
  api.getAdminPages.mockResolvedValue({ pages: [{ id: "p1", slug: "beranda", title: "Beranda", status: "published", publishedAt: null, updatedAt: "" }], pagination: { limit: 100, offset: 0, total: 1, hasMore: false } });
  api.getAdminPage.mockResolvedValue({ id: "p1", slug: "beranda", title: "Beranda", status: "published", seoTitle: null, seoDescription: null, ogImage: null, publishedAt: null, updatedAt: "", blocks: [] });
});

afterEach(() => cleanup());

describe("AdminPage — form berita", () => {
  it("input gambar berita menerima URL maupun path /media (type text)", async () => {
    render(<AdminPage />);
    await screen.findByText("admin@uji.test");
    fireEvent.click(screen.getAllByRole("button", { name: "Berita" })[0]);
    const input = await screen.findByPlaceholderText(/\/media\//i);
    expect(input).toHaveAttribute("type", "text");
    expect(api.listAll).toHaveBeenCalledWith({ limit: 50, offset: 0 });
  });
});

describe("AdminPage — panduan cepat", () => {
  it("menampilkan panduan dan membawa ke bagian yang dipilih", async () => {
    render(<AdminPage />);
    await screen.findByText("admin@uji.test");

    fireEvent.click(await screen.findByRole("button", { name: "Buka Isi Halaman" }));

    expect(await screen.findByRole("heading", { name: "Isi Halaman" })).toBeTruthy();
    expect(api.getAdminPages).toHaveBeenCalled();
  });

  it("memakai istilah menu yang mudah dipahami", async () => {
    render(<AdminPage />);
    await screen.findByText("admin@uji.test");

    for (const label of ["Isi Halaman", "Berita", "Pengaturan Tampilan", "Media", "Pendaftar", "Langganan", "Pengguna", "Riwayat Aktivitas"]) {
      expect(screen.getAllByRole("button", { name: label }).length).toBeGreaterThan(0);
    }
  });
});
