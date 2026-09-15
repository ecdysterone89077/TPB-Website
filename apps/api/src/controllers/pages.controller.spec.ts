import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PageRevisionDataSchema } from "@tpb/contracts";
import { PagesController } from "./pages.controller";
import { AdminPagesController } from "./admin-pages.controller";

const publishedBlock = { type: "heading", data: { text: "Terbit", level: 2, align: "left" }, isVisible: true };
const snapshot = { page: { title: "Beranda Terbit", slug: "beranda", seoTitle: "", seoDescription: "", ogImage: null }, blocks: [publishedBlock] };

const pageRow = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  slug: "beranda",
  title: "Beranda (draft)",
  status: "published",
  seoTitle: null,
  seoDescription: null,
  ogImage: null,
  publishedAt: new Date("2026-01-01T00:00:00Z"),
  publishedData: snapshot,
  updatedAt: new Date("2026-01-02T00:00:00Z"),
  createdBy: null,
  updatedBy: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

const blockRow = (over: Record<string, unknown> = {}) => ({
  id: "22222222-2222-4222-8222-222222222222",
  pageId: "p1",
  type: "heading",
  position: 0,
  data: { text: "Halo", level: 2, align: "left" },
  isVisible: true,
  anchor: null,
  ...over,
});

const makeTx = () => ({
  page: {
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(pageRow()),
  },
  block: {
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
  },
  pageRevision: { create: jest.fn().mockResolvedValue({}) },
});

const makePrisma = () => {
  const tx = makeTx();
  const prisma: any = {
    page: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(pageRow({ ...data, blocks: [] }))),
      update: jest.fn().mockResolvedValue(pageRow({ blocks: [] })),
      delete: jest.fn().mockResolvedValue({}),
    },
    block: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    pageRevision: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn((fn: any) => fn(tx)),
    tx,
  };
  return prisma;
};

describe("PagesController (publik)", () => {
  it("daftar hanya memuat halaman terbit dan memakai judul terbit", async () => {
    const prisma = makePrisma();
    prisma.page.findMany.mockResolvedValue([pageRow({ blocks: [{ id: "b1" }] })]);
    const controller = new PagesController(prisma as any);
    const out = await controller.list();
    expect(prisma.page.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "published" } }));
    expect(out.pages[0].title).toBe("Beranda Terbit");
  });

  it("halaman draft tidak pernah tampil di publik", async () => {
    const prisma = makePrisma();
    prisma.page.findUnique.mockResolvedValue(pageRow({ status: "draft" }));
    const controller = new PagesController(prisma as any);
    await expect(controller.get("beranda")).resolves.toEqual({ page: null });
  });

  it("publik menyajikan snapshot terbit, bukan editan draft", async () => {
    const prisma = makePrisma();
    prisma.page.findUnique.mockResolvedValue(pageRow({ title: "Judul Draft Baru", blocks: [blockRow({ data: { text: "Draft", level: 2, align: "left" } })] }));
    const controller = new PagesController(prisma as any);
    const out = await controller.get("beranda");
    expect(out.page?.title).toBe("Beranda Terbit");
    expect((out.page?.blocks[0] as any).data.text).toBe("Terbit");
  });

  it("halaman terbit tanpa snapshot valid -> null (tanpa fallback)", async () => {
    const prisma = makePrisma();
    prisma.page.findUnique.mockResolvedValue(pageRow({ publishedData: null }));
    const controller = new PagesController(prisma as any);
    await expect(controller.get("beranda")).resolves.toEqual({ page: null });
  });

  it("blok tersembunyi di snapshot difilter dari publik", async () => {
    const prisma = makePrisma();
    prisma.page.findUnique.mockResolvedValue(pageRow({ publishedData: { ...snapshot, blocks: [publishedBlock, { ...publishedBlock, isVisible: false }] } }));
    const controller = new PagesController(prisma as any);
    const out = await controller.get("beranda");
    expect(out.page?.blocks).toHaveLength(1);
  });
});

describe("AdminPagesController", () => {
  const admin = { id: "u1", email: "a@b.test", role: "ADMIN" as const, name: "A" };

  it("slug bentrok -> 409", async () => {
    const prisma = makePrisma();
    prisma.page.create.mockRejectedValue({ code: "P2002" });
    const controller = new AdminPagesController(prisma as any);
    await expect(controller.create({ title: "X", slug: "beranda" }, { user: admin } as any)).rejects.toThrow(ConflictException);
  });

  it("slug tidak valid -> 400", async () => {
    const prisma = makePrisma();
    const controller = new AdminPagesController(prisma as any);
    await expect(controller.create({ title: "X", slug: "Beranda Sekali" }, { user: admin } as any)).rejects.toThrow();
  });

  it("update dengan slug bentrok -> 409", async () => {
    const prisma = makePrisma();
    prisma.page.findUnique.mockResolvedValue(pageRow());
    prisma.page.update.mockRejectedValue({ code: "P2002" });
    const controller = new AdminPagesController(prisma as any);
    await expect(controller.update("p1", { title: "Baru", slug: "beranda" }, { user: admin } as any)).rejects.toThrow(ConflictException);
  });

  it("halaman tidak ditemukan -> 404 pada update/hapus/blok/unpublish", async () => {
    const prisma = makePrisma();
    const controller = new AdminPagesController(prisma as any);
    await expect(controller.update("p9", { title: "X", slug: "x" }, { user: admin } as any)).rejects.toThrow(NotFoundException);
    await expect(controller.remove("p9")).rejects.toThrow(NotFoundException);
    await expect(controller.saveBlocks("p9", { blocks: [] }, { user: admin } as any)).rejects.toThrow(NotFoundException);
    await expect(controller.unpublish("p9", { user: admin } as any)).rejects.toThrow(NotFoundException);
  });

  it("simpan blok: update/buat/hapus, sanitasi html, dan menyentuh updatedAt halaman", async () => {
    const prisma = makePrisma();
    prisma.page.findUnique.mockResolvedValue({ id: "p1" });
    prisma.tx.block.findMany.mockResolvedValue([{ id: "11111111-1111-4111-8111-111111111111" }, { id: "22222222-2222-4222-8222-222222222222" }]);
    prisma.block.findMany.mockResolvedValue([blockRow()]);
    const controller = new AdminPagesController(prisma as any);
    const out = await controller.saveBlocks("p1", {
      blocks: [
        { id: "22222222-2222-4222-8222-222222222222", type: "heading", data: { text: "Judul", level: 2, align: "left" }, isVisible: true },
        { type: "html", data: { code: "<p>aman</p><script>alert(1)</script>" }, isVisible: true },
      ],
    }, { user: admin } as any);
    expect(prisma.tx.block.deleteMany).toHaveBeenCalledWith({ where: { pageId: "p1", id: { notIn: ["22222222-2222-4222-8222-222222222222"] } } });
    expect(prisma.tx.block.update).toHaveBeenCalledTimes(1);
    expect(prisma.tx.block.create).toHaveBeenCalledTimes(1);
    const created = prisma.tx.block.create.mock.calls[0][0].data;
    expect(created.data.code).not.toContain("<script>");
    expect(prisma.tx.page.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { updatedBy: "u1" } });
    expect(out.blocks).toHaveLength(1);
  });

  it("id blok duplikat dalam satu payload ditolak", async () => {
    const prisma = makePrisma();
    prisma.page.findUnique.mockResolvedValue({ id: "p1" });
    const controller = new AdminPagesController(prisma as any);
    const id = "22222222-2222-4222-8222-222222222222";
    await expect(
      controller.saveBlocks("p1", { blocks: [{ id, type: "heading", data: { text: "A", level: 2, align: "left" } }, { id, type: "heading", data: { text: "B", level: 2, align: "left" } }] }, { user: admin } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("publish membuat snapshot terbit + revisi", async () => {
    const prisma = makePrisma();
    prisma.tx.page.findUnique.mockResolvedValue(pageRow({ publishedData: null, blocks: [blockRow()] }));
    const controller = new AdminPagesController(prisma as any);
    const out = await controller.publish("p1", { user: admin } as any);
    expect(prisma.tx.page.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "published", publishedData: expect.any(Object) }) }),
    );
    expect(prisma.tx.pageRevision.create).toHaveBeenCalledTimes(1);
    expect(out.page.status).toBe("published");
  });

  it("publish ulang tanpa perubahan tidak menambah revisi atau mengubah publishedAt", async () => {
    const prisma = makePrisma();
    const published = PageRevisionDataSchema.parse({
      page: { title: "Beranda (draft)", slug: "beranda", seoTitle: "", seoDescription: "", ogImage: null },
      blocks: [{ id: "22222222-2222-4222-8222-222222222222", type: "heading", data: { text: "Halo", level: 2, align: "left" }, isVisible: true }],
    });
    prisma.tx.page.findUnique.mockResolvedValue(pageRow({ publishedData: published, blocks: [blockRow()] }));
    const controller = new AdminPagesController(prisma as any);
    const out = await controller.publish("p1", { user: admin } as any);
    const updateArgs = prisma.tx.page.update.mock.calls.at(-1)![0];
    expect(updateArgs.data.publishedAt).toBeUndefined();
    expect(updateArgs.data.publishedData).toBeUndefined();
    expect(prisma.tx.pageRevision.create).not.toHaveBeenCalled();
    expect(out.page.status).toBe("published");
  });

  it("publish menerima blok docLink dan menolak tautan tidak aman", async () => {
    const prisma = makePrisma();
    prisma.tx.page.findUnique.mockResolvedValue(pageRow({ blocks: [blockRow({ type: "docLink", data: { kicker: "Akademik", title: "Kurikulum", links: [{ label: "Panduan", href: "https://drive.google.com/x" }] } })] }));
    const controller = new AdminPagesController(prisma as any);
    const out = await controller.publish("p1", { user: admin } as any);
    const updateArgs = prisma.tx.page.update.mock.calls.at(-1)![0];
    expect(updateArgs.data.publishedData.blocks[0].type).toBe("docLink");
    expect(out.page.status).toBe("published");

    const unsafe = makePrisma();
    unsafe.tx.page.findUnique.mockResolvedValue(pageRow({ blocks: [blockRow({ type: "docLink", data: { links: [{ label: "X", href: "javascript:alert(1)" }] } })] }));
    await expect(new AdminPagesController(unsafe as any).publish("p1", { user: admin } as any)).rejects.toThrow();
  });

  it("publish halaman tanpa blok -> 400", async () => {
    const prisma = makePrisma();
    prisma.tx.page.findUnique.mockResolvedValue(pageRow({ blocks: [] }));
    const controller = new AdminPagesController(prisma as any);
    await expect(controller.publish("p1", { user: admin } as any)).rejects.toThrow(BadRequestException);
  });

  it("restore mengarsipkan keadaan sekarang, mengganti blok, dan kembali draft", async () => {
    const prisma = makePrisma();
    prisma.pageRevision.findFirst.mockResolvedValue({
      id: "r1",
      data: {
        page: { title: "Lama", slug: "beranda", seoTitle: "", seoDescription: "", ogImage: null },
        blocks: [{ type: "heading", data: { text: "Lama", level: 2, align: "left" }, isVisible: true }],
      },
    });
    prisma.tx.page.findUnique.mockResolvedValue(pageRow({ blocks: [blockRow()] }));
    prisma.page.findUnique.mockResolvedValue(pageRow({ blocks: [blockRow()] }));
    const controller = new AdminPagesController(prisma as any);
    await controller.restore("p1", "r1", { user: admin } as any);
    expect(prisma.tx.pageRevision.create).toHaveBeenCalledTimes(1);
    expect(prisma.tx.page.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "draft", title: "Lama" }) }));
    expect(prisma.tx.block.deleteMany).toHaveBeenCalledWith({ where: { pageId: "p1" } });
    expect(prisma.tx.block.create).toHaveBeenCalledTimes(1);
  });

  it("restore dengan slug bentrok -> 409", async () => {
    const prisma = makePrisma();
    prisma.pageRevision.findFirst.mockResolvedValue({
      id: "r1",
      data: { page: { title: "Lama", slug: "beranda", seoTitle: "", seoDescription: "", ogImage: null }, blocks: [{ type: "heading", data: { text: "Lama", level: 2, align: "left" }, isVisible: true }] },
    });
    prisma.tx.page.findUnique.mockResolvedValue(pageRow({ blocks: [blockRow()] }));
    prisma.tx.page.update.mockRejectedValue({ code: "P2002" });
    const controller = new AdminPagesController(prisma as any);
    await expect(controller.restore("p1", "r1", { user: admin } as any)).rejects.toThrow(ConflictException);
  });

  it("revisi tidak ditemukan -> 404", async () => {
    const prisma = makePrisma();
    const controller = new AdminPagesController(prisma as any);
    await expect(controller.restore("p1", "rx", { user: admin } as any)).rejects.toThrow(NotFoundException);
  });
});
