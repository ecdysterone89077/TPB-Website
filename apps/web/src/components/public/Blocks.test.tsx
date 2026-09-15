import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("membuat indeks pencarian dari blok", () => {
    const entries = buildBlockIndex(
      [block({ id: "b6", type: "heading", data: { text: "Kurikulum Baru", level: 2, align: "left" }, isVisible: true, anchor: "kurikulum" })],
      [{ label: "Akademik", href: "/#kurikulum" }],
    );
    expect(entries[0].group).toBe("Akademik");
    expect(entries[0].href).toBe("#kurikulum");
    expect(entries[0].text).toContain("Kurikulum Baru");
  });
});
