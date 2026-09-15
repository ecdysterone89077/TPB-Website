import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Block } from "@tpb/contracts";
import HeavyBlockView from "./HeavyBlocks";

vi.mock("../../lib/api", () => ({ api: { listPublic: vi.fn().mockResolvedValue([]) } }));

const block = (value: unknown) => value as Block;

describe("HeavyBlockView", () => {
  it("merender tipe blok berat dan mengabaikan tipe ringan", async () => {
    render(<HeavyBlockView block={block({ id: "h1", type: "stats", data: [{ value: 5, suffix: "+", label: "Mitra" }], isVisible: true, anchor: "angka" })} onDaftar={vi.fn()} />);
    expect(await screen.findByText("Mitra")).toBeTruthy();
    expect(document.getElementById("angka")).toBeTruthy();

    render(<HeavyBlockView block={block({ id: "h2", type: "visiMisi", data: { kicker: "Profil", title: "Visi & Misi", visi: "Visi kami", misi: ["Misi satu"] }, isVisible: true })} onDaftar={vi.fn()} />);
    expect(await screen.findByText("Visi kami")).toBeTruthy();

    render(<HeavyBlockView block={block({ id: "h3", type: "cta", data: { title: "Ayo bergabung", body: "", primary: "Daftar", secondary: "Kontak", secondaryHref: "#kontak" }, isVisible: true })} onDaftar={vi.fn()} />);
    expect(await screen.findByText("Ayo bergabung")).toBeTruthy();

    render(<HeavyBlockView block={block({ id: "h4", type: "heading", data: { text: "Bukan berat", level: 2, align: "left" }, isVisible: true })} onDaftar={vi.fn()} />);
    expect(screen.queryByText("Bukan berat")).toBeNull();
  });
});
