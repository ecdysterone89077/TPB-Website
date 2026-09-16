import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Block } from "@tpb/contracts";
import { BlockRenderer } from "./Blocks";
import { RichTextView } from "./RichText";
import { buildBlockIndex } from "./Search";

const noop = () => {};

describe("RichTextView", () => {
  it("merender paragraf, heading, daftar, dan mark", () => {
    render(
      <RichTextView
        doc={{
          type: "doc",
          content: [
            { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Judul" }] },
            { type: "paragraph", content: [{ type: "text", text: "tebal", marks: [{ type: "bold" }] }, { type: "text", text: " biasa" }] },
            { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item" }] }] }] },
            { type: "paragraph", content: [{ type: "text", text: "tautan", marks: [{ type: "link", attrs: { href: "https://tpb.test" } }] }] },
          ],
        }}
      />,
    );
    expect(screen.getByText("Judul").tagName).toBe("H2");
    expect(screen.getByText("tebal").tagName).toBe("STRONG");
    expect(screen.getByText("item")).toBeTruthy();
    const link = screen.getByText("tautan") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://tpb.test");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("mengabaikan node tak dikenal", () => {
    render(<RichTextView doc={{ type: "doc", content: [{ type: "tidakAda" } as never, { type: "paragraph", content: [{ type: "text", text: "aman" }] }] }} />);
    expect(screen.getByText("aman")).toBeTruthy();
  });
});

describe("BlockRenderer", () => {
  const block = (value: unknown) => value as Block;

  it("merender heading dengan anchor", () => {
    render(<BlockRenderer block={block({ id: "b1", type: "heading", data: { text: "Halo Dunia", level: 2, align: "left" }, isVisible: true, anchor: "halo" })} onDaftar={noop} />);
    expect(screen.getByText("Halo Dunia").tagName).toBe("H2");
    expect(document.getElementById("halo")).toBeTruthy();
  });

  it("merender gambar dari path media", () => {
    render(<BlockRenderer block={block({ id: "b2", type: "image", data: { image: "/media/foto.png", alt: "Foto", caption: "Keterangan", link: "" }, isVisible: true })} onDaftar={noop} />);
    const img = screen.getByAltText("Foto") as HTMLImageElement;
    expect(img.getAttribute("src")).toContain("/media/foto.png");
    expect(screen.getByText("Keterangan")).toBeTruthy();
  });

  it("merender tombol dengan tautan aman", () => {
    render(<BlockRenderer block={block({ id: "b3", type: "button", data: { label: "Daftar", href: "#pmb", style: "gold", openInNewTab: false, align: "left" }, isVisible: true })} onDaftar={noop} />);
    const link = screen.getByText("Daftar") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("#pmb");
  });

  it("merender blok html tersanitasi dan accordion", () => {
    render(<BlockRenderer block={block({ id: "b4", type: "html", data: { code: "<p>Isi HTML</p>" }, isVisible: true })} onDaftar={noop} />);
    expect(screen.getByText("Isi HTML")).toBeTruthy();
    render(<BlockRenderer block={block({ id: "b5", type: "accordion", data: { items: [{ title: "Pertanyaan", body: "Jawaban" }] }, isVisible: true })} onDaftar={noop} />);
    expect(screen.getByText("Pertanyaan")).toBeTruthy();
  });

  it("menerapkan anchor pada blok preset yang punya id bawaan", async () => {
    render(<BlockRenderer block={block({ id: "b8", type: "stats", data: [], isVisible: true, anchor: "angka" })} onDaftar={noop} />);
    render(<BlockRenderer block={block({ id: "b9", type: "about", data: { kicker: "K", title: "T", body: "", sinceYear: "2024", sinceNote: "", image: "", points: [] }, isVisible: true, anchor: "profil-baru" })} onDaftar={noop} />);
    render(<BlockRenderer block={block({ id: "b10", type: "programs", data: { kicker: "K", title: "T", cta: "Daftar", cards: [] }, isVisible: true, anchor: "program" })} onDaftar={noop} />);
    render(<BlockRenderer block={block({ id: "b11", type: "cta", data: { title: "T", body: "", primary: "Daftar", secondary: "Kontak", secondaryHref: "#kontak" }, isVisible: true, anchor: "ajakan" })} onDaftar={noop} />);
    await waitFor(() => expect(document.getElementById("angka")).toBeTruthy());
    await waitFor(() => expect(document.getElementById("profil-baru")).toBeTruthy());
    await waitFor(() => expect(document.getElementById("program")).toBeTruthy());
    await waitFor(() => expect(document.getElementById("ajakan")).toBeTruthy());
  });

  it("blok preset tanpa anchor tetap memakai id bawaannya", async () => {
    render(<BlockRenderer block={block({ id: "b12", type: "about", data: { kicker: "K", title: "T", body: "", sinceYear: "2024", sinceNote: "", image: "", points: [] }, isVisible: true })} onDaftar={noop} />);
    await waitFor(() => expect(document.getElementById("profil")).toBeTruthy());
  });

  it("merender tautan dokumen eksternal di tab baru", () => {
    render(<BlockRenderer block={block({ id: "b13", type: "docLink", data: { kicker: "Akademik · Kurikulum", title: "Kurikulum", note: "", links: [{ label: "Panduan Kurikulum 2026/2027", href: "https://drive.google.com/file/d/x", note: "PDF" }] }, isVisible: true, anchor: "kurikulum" })} onDaftar={noop} />);
    expect(document.getElementById("kurikulum")).toBeTruthy();
    expect(screen.getByText("Akademik · Kurikulum")).toBeTruthy();
    expect(screen.getByText("Kurikulum").tagName).toBe("H2");
    const link = screen.getByText("Panduan Kurikulum 2026/2027").closest("a") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://drive.google.com/file/d/x");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("PDF")).toBeTruthy();
  });

  it("tautan dokumen internal tidak membuka tab baru", () => {
    render(<BlockRenderer block={block({ id: "b14", type: "docLink", data: { links: [{ label: "Ke Profil", href: "/profil" }] }, isVisible: true })} onDaftar={noop} />);
    const link = screen.getByText("Ke Profil").closest("a") as HTMLAnchorElement;
    expect(link.getAttribute("target")).toBeNull();
    expect(link.getAttribute("rel")).toBeNull();
  });

  it("membuat indeks pencarian dari blok", () => {
    const entries = buildBlockIndex(
      [block({ id: "b6", type: "heading", data: { text: "Kurikulum Baru", level: 2, align: "left" }, isVisible: true, anchor: "kurikulum" })],
      [{ label: "Akademik", href: "/#kurikulum" }],
      "beranda",
    );
    expect(entries[0].group).toBe("Akademik");
    expect(entries[0].href).toBe("/#kurikulum");
    expect(entries[0].text).toContain("Kurikulum Baru");
  });

  it("indeks pencarian tidak memuat href tautan", () => {
    const entries = buildBlockIndex(
      [block({ id: "b8", type: "docLink", data: { kicker: "Akademik", title: "Kurikulum", note: "", links: [{ label: "Panduan", href: "https://drive.google.com/rahasia", note: "" }] }, isVisible: true, anchor: "kurikulum" })],
      [],
      "beranda",
    );
    expect(entries[0].text).toContain("Kurikulum");
    expect(entries[0].text).toContain("Panduan");
    expect(entries[0].text).not.toContain("drive.google.com");
  });

  it("indeks memakai slug halaman selain beranda", () => {
    const entries = buildBlockIndex(
      [block({ id: "b7", type: "heading", data: { text: "Sejarah", level: 2, align: "left" }, isVisible: true, anchor: "sejarah" })],
      [],
      "profil",
    );
    expect(entries[0].href).toBe("/profil#sejarah");
  });
});
