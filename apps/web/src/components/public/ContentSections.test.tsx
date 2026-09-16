import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SiteContent } from "@tpb/contracts";
import { Footer } from "./Footer";

vi.mock("../../lib/api", () => ({ api: { subscribe: vi.fn() } }));

const footer = (socials: SiteContent["footer"]["socials"]): SiteContent["footer"] => ({
  newsletterTitle: "Ikuti Perkembangan Kami", infoTitle: "Informasi Kontak", quickLinksTitle: "Tautan Cepat", galleryTitle: "Galeri", submitLabel: "Langganan",
  socials,
  contact: { phone: "", phoneHref: "", email: "a@b.test", address: "Purwokerto" },
  quickLinks: [], copyright: "© 2026 Prodi TPB", tagline: "MEREKAYASA",
});

afterEach(() => cleanup());

describe("Footer — media sosial", () => {
  it("menampilkan tautan dari daftar dengan label apa adanya", () => {
    render(
      <Footer
        footer={footer([
          { label: "Instagram TPB UNU Purwokerto", href: "https://www.instagram.com/tpb_unupurwokerto/" },
          { label: "Instagram HIMATETA", href: "https://www.instagram.com/himateta.unupwt/" },
        ])}
      />,
    );

    const tpb = screen.getByRole("link", { name: "Instagram TPB UNU Purwokerto" });
    const himateta = screen.getByRole("link", { name: "Instagram HIMATETA" });
    expect(tpb.getAttribute("href")).toBe("https://www.instagram.com/tpb_unupurwokerto/");
    expect(himateta.getAttribute("href")).toBe("https://www.instagram.com/himateta.unupwt/");
    expect(tpb.getAttribute("target")).toBe("_blank");
    expect(tpb.getAttribute("rel")).toBe("noreferrer");
    expect(screen.queryByRole("link", { name: "Facebook" })).toBeNull();
  });

  it("tanpa socials tidak ada tautan media sosial", () => {
    render(<Footer footer={footer([])} />);
    expect(screen.queryByRole("link", { name: /Instagram/ })).toBeNull();
  });
});
