import { NavController } from "./nav.controller";
import { SettingsController } from "./settings.controller";

describe("NavController", () => {
  it("membangun struktur bersarang dari baris datar", async () => {
    const prisma = {
      navItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: "n1", parentId: null, label: "Beranda", href: "/", openInNewTab: false, position: 0 },
          { id: "n2", parentId: null, label: "Profil", href: "/profil", openInNewTab: false, position: 1 },
          { id: "n3", parentId: "n2", label: "Sejarah", href: "/profil#sejarah", openInNewTab: false, position: 0 },
        ]),
      },
    };
    const controller = new NavController(prisma as any);
    const out = await controller.get();
    expect(out.items).toHaveLength(2);
    expect(out.items[1].children?.[0].label).toBe("Sejarah");
  });

  it("replace menu mengganti seluruh baris (delete + create bersarang)", async () => {
    const tx = {
      navItem: { deleteMany: jest.fn().mockResolvedValue({}), create: jest.fn().mockResolvedValue({ id: "x" }) },
    };
    const prisma = {
      navItem: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    const controller = new NavController(prisma as any);
    await controller.replace({ items: [{ label: "Beranda", href: "/" }, { label: "Profil", href: "/profil", children: [{ label: "Sejarah", href: "/profil#sejarah" }] }] });
    expect(tx.navItem.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.navItem.create).toHaveBeenCalledTimes(3);
  });

  it("menu tidak valid ditolak", async () => {
    const prisma = { navItem: { findMany: jest.fn() }, $transaction: jest.fn() };
    const controller = new NavController(prisma as any);
    await expect(controller.replace({ items: [{ label: "", href: "/" }] })).rejects.toThrow();
  });
});

describe("SettingsController", () => {
  const settings = {
    brand: { kicker: "", name: "TPB", org: "UNU", logoUrl: "/media/logo.png" },
    pmbLink: "#pmb",
    footer: {
      newsletterTitle: "Newsletter", infoTitle: "Info", quickLinksTitle: "Tautan", galleryTitle: "Galeri", submitLabel: "Kirim",
      socials: { facebook: "", twitter: "", youtube: "", linkedin: "" },
      contact: { phone: "", email: "a@b.test", address: "Purwokerto" },
      quickLinks: [], copyright: "", tagline: "",
    },
  };

  it("belum dikonfigurasi -> settings null (tanpa fallback)", async () => {
    const prisma = { siteSetting: { findUnique: jest.fn().mockResolvedValue(null) } };
    const controller = new SettingsController(prisma as any);
    await expect(controller.get()).resolves.toEqual({ settings: null });
  });

  it("data tersimpan tidak valid -> null (tanpa fallback)", async () => {
    const prisma = { siteSetting: { findUnique: jest.fn().mockResolvedValue({ key: "main", data: { rusak: true } }) } };
    const controller = new SettingsController(prisma as any);
    await expect(controller.get()).resolves.toEqual({ settings: null });
  });

  it("simpan pengaturan memvalidasi dan upsert key main", async () => {
    const prisma = { siteSetting: { upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve(create)) } };
    const controller = new SettingsController(prisma as any);
    const out = await controller.save({ settings }, { user: { id: "u1" } } as any);
    expect(out.settings).toMatchObject({ pmbLink: "#pmb" });
    expect(prisma.siteSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { key: "main" } }));
  });

  it("pengaturan tidak valid ditolak", async () => {
    const prisma = { siteSetting: { upsert: jest.fn() } };
    const controller = new SettingsController(prisma as any);
    await expect(controller.save({ settings: { brand: { name: 1 } } }, { user: { id: "u1" } } as any)).rejects.toThrow();
    expect(prisma.siteSetting.upsert).not.toHaveBeenCalled();
  });
});
