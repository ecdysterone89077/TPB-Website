import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Block } from "@tpb/contracts";
import { NavLinkField } from "./SettingsEditor";

const { api } = vi.hoisted(() => ({ api: { getAdminPages: vi.fn(), getAdminPage: vi.fn() } }));

vi.mock("../../lib/api", () => ({ api }));

const block = (type: string, anchor?: string) => ({ type, data: {}, isVisible: true, ...(anchor ? { anchor } : {}) }) as unknown as Block;
const page = (id: string, slug: string, title: string, blocks: Block[]) => ({
  id,
  slug,
  title,
  status: "published",
  seoTitle: null,
  seoDescription: null,
  ogImage: null,
  publishedAt: null,
  updatedAt: "2026-09-15T00:00:00.000Z",
  blocks,
});

function Harness({ initial }: { initial: string }) {
  const [href, setHref] = useState(initial);
  return (
    <div>
      <NavLinkField href={href} onChange={setHref} />
      <output data-testid="href">{href}</output>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getAdminPages.mockResolvedValue({
    pages: [
      { id: "p1", slug: "beranda", title: "Beranda", status: "published" },
      { id: "p2", slug: "profil", title: "Profil", status: "published" },
    ],
    pagination: { limit: 100, offset: 0, total: 2, hasMore: false },
  });
  api.getAdminPage.mockImplementation((id: string) =>
    Promise.resolve(id === "p1" ? page("p1", "beranda", "Beranda", [block("heading", "top")]) : page("p2", "profil", "Profil", [block("dosen", "dosen"), block("heading")])),
  );
});

afterEach(() => cleanup());

describe("NavLinkField", () => {
  it("memuat halaman dan bagian beserta label spec blok", async () => {
    render(<Harness initial="/profil#dosen" />);

    expect(screen.getByTestId("href").textContent).toBe("/profil#dosen");
    await waitFor(() => expect(api.getAdminPage).toHaveBeenCalledWith("p2"));
    const anchorSelect = (await screen.findByLabelText("Bagian halaman")) as HTMLSelectElement;
    await waitFor(() => expect(anchorSelect.value).toBe("dosen"));
    expect(screen.getByRole("option", { name: "Daftar dosen — #dosen" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Judul — #top" })).toBeNull();
  });

  it("mengubah halaman dan bagian membangun href baru", async () => {
    render(<Harness initial="/#top" />);
    await screen.findByRole("option", { name: "Beranda" });

    fireEvent.change(screen.getByLabelText("Halaman"), { target: { value: "profil" } });
    expect(screen.getByTestId("href").textContent).toBe("/profil");

    const anchorSelect = (await screen.findByLabelText("Bagian halaman")) as HTMLSelectElement;
    await waitFor(() => expect(screen.getByRole("option", { name: "Daftar dosen — #dosen" })).toBeTruthy());
    fireEvent.change(anchorSelect, { target: { value: "dosen" } });
    expect(screen.getByTestId("href").textContent).toBe("/profil#dosen");
  });

  it("mode URL eksternal mengirim tautan apa adanya", async () => {
    render(<Harness initial="/" />);
    await screen.findByRole("option", { name: "Beranda" });

    fireEvent.change(screen.getByLabelText("Jenis tautan"), { target: { value: "url" } });
    fireEvent.change(screen.getByPlaceholderText("https://contoh.com"), { target: { value: "https://tpb.test/pmb" } });
    expect(screen.getByTestId("href").textContent).toBe("https://tpb.test/pmb");
  });

  it("mode telepon dan email memakai prefiks aman", async () => {
    render(<Harness initial="/" />);
    await screen.findByRole("option", { name: "Beranda" });

    fireEvent.change(screen.getByLabelText("Jenis tautan"), { target: { value: "phone" } });
    fireEvent.change(screen.getByPlaceholderText("+628123456789"), { target: { value: "+628123456789" } });
    expect(screen.getByTestId("href").textContent).toBe("tel:+628123456789");

    fireEvent.change(screen.getByLabelText("Jenis tautan"), { target: { value: "email" } });
    fireEvent.change(screen.getByPlaceholderText("nama@contoh.com"), { target: { value: "halo@tpb.test" } });
    expect(screen.getByTestId("href").textContent).toBe("mailto:halo@tpb.test");
  });

  it("kembali ke mode halaman memakai beranda tanpa bagian", async () => {
    render(<Harness initial="https://tpb.test" />);
    expect(screen.getByTestId("href").textContent).toBe("https://tpb.test");

    fireEvent.change(screen.getByLabelText("Jenis tautan"), { target: { value: "page" } });
    expect(screen.getByTestId("href").textContent).toBe("/");
    await screen.findByRole("option", { name: "Beranda" });
  });

  it("mengikuti perubahan href dari luar agar urutan menu tidak menimpa tautan", async () => {
    function Controlled() {
      const [href, setHref] = useState("/profil#dosen");
      return (
        <div>
          <button onClick={() => setHref("/akademik")}>ganti tautan</button>
          <NavLinkField href={href} onChange={setHref} />
          <output data-testid="href">{href}</output>
        </div>
      );
    }
    render(<Controlled />);
    await waitFor(() => expect((screen.getByLabelText("Halaman") as HTMLSelectElement).value).toBe("profil"));

    fireEvent.click(screen.getByRole("button", { name: "ganti tautan" }));
    await waitFor(() => expect((screen.getByLabelText("Halaman") as HTMLSelectElement).value).toBe("akademik"));
    expect(screen.getByTestId("href").textContent).toBe("/akademik");
  });

  it("mode tidak berubah sendiri saat mengetik nilai menyerupai tautan lain", async () => {
    render(<Harness initial="/" />);
    await screen.findByRole("option", { name: "Beranda" });

    fireEvent.change(screen.getByLabelText("Jenis tautan"), { target: { value: "url" } });
    fireEvent.change(screen.getByPlaceholderText("https://contoh.com"), { target: { value: "tel:+62812" } });
    expect((screen.getByLabelText("Jenis tautan") as HTMLSelectElement).value).toBe("url");
    expect(screen.getByTestId("href").textContent).toBe("tel:+62812");
  });

  it("menandai tautan yang belum valid", async () => {
    render(<Harness initial="/" />);
    await screen.findByRole("option", { name: "Beranda" });

    fireEvent.change(screen.getByLabelText("Jenis tautan"), { target: { value: "url" } });
    expect(screen.getByText("Tautan belum valid.")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("https://contoh.com"), { target: { value: "example.com" } });
    expect(screen.getByText("Tautan belum valid.")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("https://contoh.com"), { target: { value: "https://tpb.test" } });
    expect(screen.queryByText("Tautan belum valid.")).toBeNull();
  });

  it("menampilkan pesan error saat daftar halaman gagal dimuat", async () => {
    api.getAdminPages.mockRejectedValue(new Error("gagal halaman"));
    render(<Harness initial="/" />);

    expect(await screen.findByText("gagal halaman")).toBeTruthy();
  });

  it("slug di luar daftar ditandai dan tidak mengubah href", async () => {
    render(<Harness initial="/halaman-lama" />);

    expect(await screen.findByRole("option", { name: "halaman-lama (tidak ada di daftar)" })).toBeTruthy();
    expect(screen.getByTestId("href").textContent).toBe("/halaman-lama");
  });
});
