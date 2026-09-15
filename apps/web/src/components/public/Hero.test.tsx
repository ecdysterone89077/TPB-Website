import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NavItemInput, SiteContent } from "@tpb/contracts";
import { Header } from "./Hero";

const brand: SiteContent["brand"] = { kicker: "Teknik", name: "TPB", org: "UNU Purwokerto", logoUrl: "" };
const navigation: NavItemInput[] = [
  { label: "Profil", href: "/profil", children: [{ label: "Sejarah", href: "/profil#sejarah" }] },
  { label: "Beranda", href: "/" },
];

const renderHeader = () =>
  render(<Header brand={brand} navigation={navigation} blocks={[]} slug="beranda" onAdmin={vi.fn()} />);

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("Header — dropdown desktop", () => {
  it("membuka/menutup dropdown dengan klik disertai aria-expanded", () => {
    renderHeader();
    const trigger = screen.getByRole("button", { name: "Profil" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Sejarah")).toBeNull();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Sejarah")).toBeTruthy();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Sejarah")).toBeNull();
  });

  it("tetap membuka dropdown saat hover dengan mouse", () => {
    renderHeader();
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Profil" }), { pointerType: "mouse" });
    expect(screen.getByText("Sejarah")).toBeTruthy();
  });

  it("tap sentuh membuka dropdown (bukan tertutup oleh event hover semu)", () => {
    renderHeader();
    const trigger = screen.getByRole("button", { name: "Profil" });
    fireEvent.pointerEnter(trigger, { pointerType: "touch" });
    expect(screen.queryByText("Sejarah")).toBeNull();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Sejarah")).toBeTruthy();
  });

  it("Escape mengembalikan fokus ke tombol pemicu", () => {
    renderHeader();
    const trigger = screen.getByRole("button", { name: "Profil" });
    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
  });

  it("menutup dropdown dengan tombol Escape", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: "Profil" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Sejarah")).toBeNull();
    expect(screen.getByRole("button", { name: "Profil" })).toHaveAttribute("aria-expanded", "false");
  });

  it("klik tautan anak memakai navigasi internal", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: "Profil" }));
    const pushSpy = vi.spyOn(window.history, "pushState");
    fireEvent.click(screen.getByText("Sejarah"));
    expect(pushSpy).toHaveBeenCalledWith({}, "", "/profil#sejarah");
    pushSpy.mockRestore();
  });

  it("menu tanpa anak tetap tautan biasa", () => {
    renderHeader();
    const link = screen.getByRole("link", { name: "Beranda" });
    expect(link).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: "Beranda" })).toBeNull();
  });
});
