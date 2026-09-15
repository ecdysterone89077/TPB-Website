import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "./AdminPage";
const { api } = vi.hoisted(() => ({
  api: {
    currentUser: vi.fn(),
    dashboardSummary: vi.fn(),
    listAll: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock("../lib/api", () => ({ api }));

beforeEach(() => {
  vi.clearAllMocks();
  api.currentUser.mockResolvedValue({ id: "admin-1", email: "admin@uji.test", name: "Admin Uji", role: "ADMIN", isActive: true });
  api.dashboardSummary.mockResolvedValue({ posts: 0, newPmb: 0, subscribers: 0, media: 0, audit: [] });
  api.listAll.mockResolvedValue({ posts: [], pagination: { total: 0, limit: 50, offset: 0 } });
});

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
