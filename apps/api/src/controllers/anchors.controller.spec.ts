import { AnchorsController } from "./anchors.controller";

const heading = (anchor: string, over: Record<string, unknown> = {}) => ({
  type: "heading",
  data: { text: "Bagian", level: 2, align: "left" },
  isVisible: true,
  anchor,
  ...over,
});

const snapshot = (blocks: unknown[]) => ({
  page: { title: "Halaman", slug: "beranda", seoTitle: "", seoDescription: "", ogImage: null },
  blocks,
});

describe("AnchorsController", () => {
  it("mengumpulkan anchor dari blok halaman terbit", async () => {
    const prisma = {
      page: {
        findMany: jest.fn().mockResolvedValue([
          { slug: "beranda", publishedData: snapshot([heading("dosen")]) },
          { slug: "profil", publishedData: snapshot([heading("sejarah"), heading("visi")]) },
        ]),
      },
    };
    const controller = new AnchorsController(prisma as any);
    await expect(controller.list()).resolves.toEqual({ anchors: { dosen: "beranda", sejarah: "profil", visi: "profil" } });
    expect(prisma.page.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "published" }, orderBy: [{ updatedAt: "asc" }, { id: "asc" }] }));
  });

  it("blok tersembunyi dan blok tanpa anchor dilewati", async () => {
    const prisma = {
      page: {
        findMany: jest.fn().mockResolvedValue([
          { slug: "beranda", publishedData: snapshot([heading("tampil"), heading("hilang", { isVisible: false }), { type: "heading", data: { text: "Tanpa", level: 2, align: "left" }, isVisible: true }]) },
        ]),
      },
    };
    const controller = new AnchorsController(prisma as any);
    await expect(controller.list()).resolves.toEqual({ anchors: { tampil: "beranda" } });
  });

  it("snapshot rusak atau kosong dilewati tanpa fallback", async () => {
    const prisma = {
      page: {
        findMany: jest.fn().mockResolvedValue([
          { slug: "rusak", publishedData: { rusak: true } },
          { slug: "kosong", publishedData: null },
          { slug: "valid", publishedData: snapshot([heading("aman")]) },
        ]),
      },
    };
    const controller = new AnchorsController(prisma as any);
    await expect(controller.list()).resolves.toEqual({ anchors: { aman: "valid" } });
  });

  it("anchor bernama constructor tetap terdaftar", async () => {
    const prisma = {
      page: {
        findMany: jest.fn().mockResolvedValue([{ slug: "beranda", publishedData: snapshot([heading("constructor")]) }]),
      },
    };
    const controller = new AnchorsController(prisma as any);
    await expect(controller.list()).resolves.toEqual({ anchors: { constructor: "beranda" } });
  });

  it("anchor ganda dimenangkan halaman pertama yang deterministik", async () => {
    const prisma = {
      page: {
        findMany: jest.fn().mockResolvedValue([
          { slug: "beranda", publishedData: snapshot([heading("dosen")]) },
          { slug: "profil", publishedData: snapshot([heading("dosen")]) },
        ]),
      },
    };
    const controller = new AnchorsController(prisma as any);
    await expect(controller.list()).resolves.toEqual({ anchors: { dosen: "beranda" } });
  });
});
