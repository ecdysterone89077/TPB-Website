import { BadRequestException, ConflictException } from "@nestjs/common";
import { PageRevisionDataSchema } from "@tpb/contracts";
import { ContentBundleController } from "./content-bundle.controller";

const admin = { id: "u1", email: "a@b.test", role: "ADMIN" as const, name: "A" };

const settings = {
  brand: { kicker: "Teknik", name: "TPB", org: "UNU Purwokerto", logoUrl: "/media/logo.png" },
  pmbLink: "#pmb",
  footer: {
    newsletterTitle: "N", infoTitle: "I", quickLinksTitle: "T", galleryTitle: "G", submitLabel: "Kirim",
    socials: [],
    contact: { phone: "", email: "a@b.test", address: "Purwokerto" },
    quickLinks: [], copyright: "", tagline: "",
  },
};

const heading = (text: string, over: Record<string, unknown> = {}) => ({ type: "heading", data: { text, level: 2, align: "left" }, isVisible: true, ...over });

const blockRow = (over: Record<string, unknown> = {}) => ({
  id: "b1", pageId: "p1", type: "heading", position: 0, data: { text: "Halo", level: 2, align: "left" }, isVisible: true, anchor: null, ...over,
});

const publishedSnapshot = () => ({
  page: { title: "Beranda", slug: "beranda", seoTitle: "", seoDescription: "", ogImage: null },
  blocks: [{ type: "heading", data: { text: "Halo", level: 2, align: "left" }, isVisible: true }],
});

const pageRow = (over: Record<string, unknown> = {}) => ({
  id: "p1", slug: "beranda", title: "Beranda", status: "published", seoTitle: null, seoDescription: null, ogImage: null,
  publishedAt: new Date("2026-01-01T00:00:00Z"), publishedData: publishedSnapshot(), createdBy: null, updatedBy: null,
  createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-02T00:00:00Z"), blocks: [blockRow()], ...over,
});

const postRow = (over: Record<string, unknown> = {}) => ({
  id: "post1", slug: "berita-1", title: "Berita", category: "Kegiatan", excerpt: "", content: null, image: null,
  readTime: "", status: "published", date: new Date("2026-01-01T00:00:00Z"), authorId: null, deletedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"), ...over,
});

const mediaRow = (over: Record<string, unknown> = {}) => ({ id: "m1", url: "/media/a.png", filename: "a.png", mimeType: "image/png", size: 10, alt: null, createdAt: new Date("2026-01-01T00:00:00Z"), ...over });

const bundle = (over: Record<string, unknown> = {}) => ({ version: 1, exportedAt: "2026-09-15T00:00:00.000Z", settings, nav: [], pages: [], posts: [], media: [], ...over });

const makeTx = () => ({
  siteSetting: { upsert: jest.fn().mockResolvedValue({}) },
  navItem: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), create: jest.fn().mockResolvedValue({ id: "n1" }) },
  page: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: "p-new", ...data })),
    update: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  block: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), create: jest.fn().mockResolvedValue({}) },
  pageRevision: { create: jest.fn().mockResolvedValue({}) },
  post: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: "post-new", ...data })),
    update: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  mediaAsset: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
});

const makePrisma = () => {
  const tx = makeTx();
  const prisma: any = {
    siteSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    navItem: { findMany: jest.fn().mockResolvedValue([]) },
    page: { findMany: jest.fn().mockResolvedValue([]) },
    post: { findMany: jest.fn().mockResolvedValue([]) },
    mediaAsset: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((fn: any) => fn(tx)),
    tx,
  };
  return prisma;
};

describe("ContentBundleController — export", () => {
  it("mengekspor settings, nav, halaman, berita, dan media", async () => {
    const prisma = makePrisma();
    prisma.siteSetting.findUnique.mockResolvedValue({ key: "main", data: settings });
    prisma.navItem.findMany.mockResolvedValue([
      { id: "n1", parentId: null, label: "Beranda", href: "/", openInNewTab: false, position: 0 },
      { id: "n2", parentId: "n1", label: "Profil", href: "/profil", openInNewTab: false, position: 0 },
    ]);
    prisma.page.findMany.mockResolvedValue([pageRow()]);
    prisma.post.findMany.mockResolvedValue([postRow()]);
    prisma.mediaAsset.findMany.mockResolvedValue([mediaRow()]);

    const controller = new ContentBundleController(prisma as any);
    const { bundle: out } = await controller.export();

    expect(out.version).toBe(1);
    expect(typeof out.exportedAt).toBe("string");
    expect(out.settings).toMatchObject({ pmbLink: "#pmb" });
    expect(out.nav).toEqual([{ label: "Beranda", href: "/", openInNewTab: false, children: [{ label: "Profil", href: "/profil", openInNewTab: false }] }]);
    expect(out.pages).toHaveLength(1);
    expect(out.pages[0].blocks[0]).toEqual({ type: "heading", data: { text: "Halo", level: 2, align: "left" }, isVisible: true });
    expect(out.pages[0].blocks[0]).not.toHaveProperty("id");
    expect(out.posts[0]).toMatchObject({ slug: "berita-1", date: "2026-01-01T00:00:00.000Z" });
    expect(out.media[0]).toEqual({ url: "/media/a.png", filename: "a.png", mimeType: "image/png", size: 10, alt: "" });
    expect(prisma.post.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));
  });

  it("settings belum dikonfigurasi -> null", async () => {
    const prisma = makePrisma();
    const controller = new ContentBundleController(prisma as any);
    const { bundle: out } = await controller.export();
    expect(out.settings).toBeNull();
  });

  it("settings tersimpan tidak valid -> ekspor ditolak (tanpa fallback)", async () => {
    const prisma = makePrisma();
    prisma.siteSetting.findUnique.mockResolvedValue({ key: "main", data: { rusak: true } });
    const controller = new ContentBundleController(prisma as any);
    await expect(controller.export()).rejects.toThrow(BadRequestException);
  });

  it("halaman terbit memakai blok snapshot terbit, bukan draf yang belum tayang", async () => {
    const prisma = makePrisma();
    const published = PageRevisionDataSchema.parse({
      page: { title: "Beranda", slug: "beranda", seoTitle: "", seoDescription: "", ogImage: null },
      blocks: [heading("Dari Snapshot")],
    });
    prisma.page.findMany.mockResolvedValue([pageRow({ publishedData: published, blocks: [blockRow({ data: { text: "Draf Belum Terbit", level: 2, align: "left" } })] })]);
    const controller = new ContentBundleController(prisma as any);
    const { bundle: out } = await controller.export();
    expect(out.pages[0].blocks).toEqual([{ type: "heading", data: { text: "Dari Snapshot", level: 2, align: "left" }, isVisible: true }]);
  });

  it("halaman terbit memakai judul/SEO snapshot, bukan draf yang belum tayang", async () => {
    const prisma = makePrisma();
    const published = PageRevisionDataSchema.parse({
      page: { title: "Judul Tayang", slug: "beranda", seoTitle: "SEO Tayang", seoDescription: "Desc Tayang", ogImage: null },
      blocks: [heading("Halo")],
    });
    prisma.page.findMany.mockResolvedValue([pageRow({ title: "Judul Draf", seoTitle: "SEO Draf", seoDescription: "Desc Draf", publishedData: published })]);
    const controller = new ContentBundleController(prisma as any);
    const { bundle: out } = await controller.export();
    expect(out.pages[0]).toMatchObject({ title: "Judul Tayang", seoTitle: "SEO Tayang", seoDescription: "Desc Tayang" });
  });

  it("mengekspor blok docLink dan anchor-nya dari snapshot terbit", async () => {
    const prisma = makePrisma();
    const published = PageRevisionDataSchema.parse({
      page: { title: "Beranda", slug: "beranda", seoTitle: "", seoDescription: "", ogImage: null },
      blocks: [{ type: "docLink", anchor: "kurikulum", data: { kicker: "Akademik", title: "Kurikulum", links: [{ label: "Panduan", href: "https://drive.google.com/x" }] }, isVisible: true }],
    });
    prisma.page.findMany.mockResolvedValue([pageRow({ publishedData: published })]);
    const controller = new ContentBundleController(prisma as any);
    const { bundle: out } = await controller.export();
    expect(out.pages[0].blocks[0]).toMatchObject({ type: "docLink", anchor: "kurikulum" });
  });

  it("menolak ekspor halaman terbit tanpa snapshot valid", async () => {
    const prisma = makePrisma();
    prisma.page.findMany.mockResolvedValue([pageRow({ publishedData: null })]);
    const controller = new ContentBundleController(prisma as any);
    await expect(controller.export()).rejects.toThrow(BadRequestException);
  });

  it("menyertakan anchor dan blok tersembunyi apa adanya untuk halaman draf", async () => {
    const prisma = makePrisma();
    prisma.page.findMany.mockResolvedValue([pageRow({ status: "draft", blocks: [blockRow({ anchor: "dosen" }), blockRow({ id: "b2", position: 1, isVisible: false })] })]);
    const controller = new ContentBundleController(prisma as any);
    const { bundle: out } = await controller.export();
    expect(out.pages[0].blocks[0]).toMatchObject({ anchor: "dosen" });
    expect(out.pages[0].blocks[1]).toMatchObject({ isVisible: false });
  });

  it("menolak ekspor jika ada blok lama yang tidak valid (tanpa fallback)", async () => {
    const prisma = makePrisma();
    prisma.page.findMany.mockResolvedValue([pageRow({ status: "draft", blocks: [blockRow({ type: "heading", data: { text: 123 } })] })]);
    const controller = new ContentBundleController(prisma as any);
    await expect(controller.export()).rejects.toThrow();
  });
});

describe("ContentBundleController — import", () => {
  it("menggabungkan halaman berdasarkan slug, mengganti blok, dan menyarikan html", async () => {
    const prisma = makePrisma();
    prisma.tx.page.findUnique.mockResolvedValue(pageRow());
    const controller = new ContentBundleController(prisma as any);

    const { summary } = await controller.import(bundle({
      pages: [{
        title: "Beranda Baru", slug: "beranda", seoTitle: "SEO", seoDescription: "Desc", status: "published",
        blocks: [heading("Judul", { id: "11111111-1111-4111-8111-111111111111" }), { type: "html", data: { code: "<p>aman</p><script>alert(1)</script>" }, isVisible: true }],
      }],
    }), { user: admin } as any);

    expect(prisma.tx.block.deleteMany).toHaveBeenCalledWith({ where: { pageId: "p1" } });
    expect(prisma.tx.block.create).toHaveBeenCalledTimes(2);
    expect(prisma.tx.block.create.mock.calls[0][0].data).toMatchObject({ pageId: "p1", position: 0 });
    expect(prisma.tx.block.create.mock.calls[0][0].data.id).toBeUndefined();
    const html = prisma.tx.block.create.mock.calls[1][0].data.data.code;
    expect(html).not.toContain("<script>");
    expect(html).toContain("<p>aman</p>");
    expect(prisma.tx.page.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1" }, data: expect.objectContaining({ title: "Beranda Baru", status: "published", updatedBy: "u1" }) }));
    expect(prisma.tx.pageRevision.create).toHaveBeenCalledTimes(1);
    const snapshot = prisma.tx.pageRevision.create.mock.calls[0][0].data.data;
    expect(snapshot.blocks[0]).not.toHaveProperty("id");
    expect(prisma.tx.page.deleteMany).not.toHaveBeenCalled();
    expect(prisma.tx.post.deleteMany).not.toHaveBeenCalled();
    expect(summary.pagesUpdated).toBe(1);
    expect(summary.pagesCreated).toBe(0);
  });

  it("menolak halaman terbit tanpa blok agar situs tidak kosong", async () => {
    const prisma = makePrisma();
    prisma.tx.page.findUnique.mockResolvedValue(pageRow());
    const controller = new ContentBundleController(prisma as any);

    await expect(controller.import(bundle({ pages: [{ title: "Beranda", slug: "beranda", status: "published", blocks: [] }] }), { user: admin } as any)).rejects.toThrow(BadRequestException);
    expect(prisma.tx.page.update).not.toHaveBeenCalled();
    expect(prisma.tx.block.deleteMany).not.toHaveBeenCalled();
    expect(prisma.tx.pageRevision.create).not.toHaveBeenCalled();
  });

  it("impor ulang snapshot yang sama tidak mengubah publishedAt atau menambah revisi", async () => {
    const prisma = makePrisma();
    const canonical = PageRevisionDataSchema.parse({
      page: { title: "Beranda", slug: "beranda", seoTitle: "", seoDescription: "", ogImage: null },
      blocks: [heading("Halo")],
    });
    const reordered = {
      blocks: [{ id: "22222222-2222-4222-8222-222222222222", isVisible: true, data: { align: "left", level: 2, text: "Halo" }, type: "heading" }],
      page: { ogImage: null, seoDescription: "", seoTitle: "", slug: "beranda", title: "Beranda" },
    };
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(canonical));
    prisma.tx.page.findUnique.mockResolvedValue(pageRow({ publishedData: reordered }));
    const controller = new ContentBundleController(prisma as any);

    await controller.import(bundle({ pages: [{ title: "Beranda", slug: "beranda", status: "published", blocks: [heading("Halo")] }] }), { user: admin } as any);

    const updateArgs = prisma.tx.page.update.mock.calls.at(-1)![0];
    expect(updateArgs.data.publishedAt).toBeUndefined();
    expect(updateArgs.data.publishedData).toBeUndefined();
    expect(prisma.tx.pageRevision.create).not.toHaveBeenCalled();
  });

  it("bentrok slug saat impor paralel -> 409 (bukan 500)", async () => {
    const prisma = makePrisma();
    prisma.$transaction.mockRejectedValue({ code: "P2002" });
    const controller = new ContentBundleController(prisma as any);

    await expect(controller.import(bundle(), { user: admin } as any)).rejects.toThrow(ConflictException);
  });

  it("membuat halaman baru sebagai draf tanpa revisi", async () => {
    const prisma = makePrisma();
    const controller = new ContentBundleController(prisma as any);

    const { summary } = await controller.import(bundle({
      pages: [{ title: "Profil", slug: "profil", status: "draft", blocks: [heading("Tentang")] }],
    }), { user: admin } as any);

    expect(prisma.tx.page.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ slug: "profil", status: "draft", createdBy: "u1" }) }));
    expect(prisma.tx.block.create).toHaveBeenCalledTimes(1);
    expect(prisma.tx.pageRevision.create).not.toHaveBeenCalled();
    expect(summary.pagesCreated).toBe(1);
    expect(summary.pagesUpdated).toBe(0);
  });

  it("halaman terbit mengisi snapshot publishedData dan publishedAt", async () => {
    const prisma = makePrisma();
    prisma.tx.page.findUnique.mockResolvedValue(pageRow({ publishedAt: null, publishedData: null }));
    const controller = new ContentBundleController(prisma as any);

    await controller.import(bundle({ pages: [{ title: "Beranda", slug: "beranda", status: "published", blocks: [heading("Halo")] }] }), { user: admin } as any);

    const updateArgs = prisma.tx.page.update.mock.calls.at(-1)![0];
    expect(updateArgs.data.status).toBe("published");
    expect(updateArgs.data.publishedAt).toBeInstanceOf(Date);
    expect(updateArgs.data.publishedData.blocks[0].type).toBe("heading");
    expect(prisma.tx.pageRevision.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ pageId: "p1", createdBy: "u1" }) }));
  });

  it("settings di-upsert pada key main dan nav diganti seluruhnya", async () => {
    const prisma = makePrisma();
    const controller = new ContentBundleController(prisma as any);

    const { summary } = await controller.import(bundle({
      nav: [{ label: "Beranda", href: "/" }, { label: "Profil", href: "/profil", children: [{ label: "Sejarah", href: "/profil#sejarah" }] }],
    }), { user: admin } as any);

    expect(prisma.tx.siteSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { key: "main" } }));
    expect(prisma.tx.navItem.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.tx.navItem.create).toHaveBeenCalledTimes(3);
    expect(summary.settingsUpdated).toBe(1);
    expect(summary.navUpdated).toBe(3);
  });

  it("settings null tidak menulis settings", async () => {
    const prisma = makePrisma();
    const controller = new ContentBundleController(prisma as any);
    const { summary } = await controller.import(bundle({ settings: null }), { user: admin } as any);
    expect(prisma.tx.siteSetting.upsert).not.toHaveBeenCalled();
    expect(summary.settingsUpdated).toBe(0);
  });

  it("berita di-merge berdasarkan slug dan yang soft-deleted dihidupkan lagi", async () => {
    const prisma = makePrisma();
    prisma.tx.post.findUnique
      .mockResolvedValueOnce(postRow({ slug: "berita-lama", deletedAt: new Date("2026-02-01T00:00:00Z") }))
      .mockResolvedValueOnce(null);
    const controller = new ContentBundleController(prisma as any);

    const { summary } = await controller.import(bundle({
      posts: [
        { slug: "berita-lama", title: "Lama", category: "Kegiatan", status: "published", date: "2026-03-01T00:00:00.000Z" },
        { slug: "berita-baru", title: "Baru", category: "Prestasi", status: "draft", date: "2026-04-01T00:00:00.000Z" },
      ],
    }), { user: admin } as any);

    expect(prisma.tx.post.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "post1" }, data: expect.objectContaining({ deletedAt: null, title: "Lama" }) }));
    expect(prisma.tx.post.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ slug: "berita-baru", authorId: "u1" }) }));
    expect(summary.postsUpdated).toBe(1);
    expect(summary.postsCreated).toBe(1);
  });

  it("melaporkan media /media yang belum ada dan mendaftarkannya ke pustaka", async () => {
    const prisma = makePrisma();
    prisma.tx.mediaAsset.findMany.mockResolvedValue([{ url: "/media/ada.png" }]);
    const controller = new ContentBundleController(prisma as any);
    const longUrl = `/${"a".repeat(300)}.png`;

    const { summary } = await controller.import(bundle({
      media: [
        { url: "/media/ada.png" }, { url: "/media/hilang.png" }, { url: "/media/hilang.png" }, { url: longUrl }, { url: "https://cdn.test/eksternal.png" },
      ],
    }), { user: admin } as any);

    expect(summary.mediaMissing).toEqual(["/media/hilang.png", longUrl]);
    const data = prisma.tx.mediaAsset.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({ url: "/media/hilang.png", filename: "hilang.png", mimeType: "", size: 0, alt: null });
    expect(data[1].filename).toHaveLength(255);
  });

  it("bundel tidak valid ditolak tanpa menulis apa pun", async () => {
    const prisma = makePrisma();
    const controller = new ContentBundleController(prisma as any);
    await expect(controller.import({ version: 1, exportedAt: "kemarin", settings: null, nav: [], pages: [], posts: [], media: [] }, { user: admin } as any)).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("seluruh impor berjalan dalam satu transaksi dengan timeout longgar", async () => {
    const prisma = makePrisma();
    const controller = new ContentBundleController(prisma as any);
    await controller.import(bundle(), { user: admin } as any);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 60000, maxWait: 10000 });
    expect(prisma.tx.mediaAsset.createMany).not.toHaveBeenCalled();
  });
});
