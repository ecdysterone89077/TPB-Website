import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { AdminController } from "./controllers/admin.controller";

const makePrisma = () => {
  const prisma: any = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      delete: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({ id: "u5", role: "EDITOR", isActive: true }),
    },
  };
  prisma.$transaction = jest.fn((fn: any) => fn(prisma));
  return prisma;
};

const admin = { id: "admin-1", email: "admin@uji.test", role: "ADMIN" as const, name: "Admin" };

describe("AdminController — proteksi admin", () => {
  it("menolak menghapus akun sendiri dengan 400", async () => {
    const prisma = makePrisma();
    const controller = new AdminController(prisma as any);
    await expect(controller.deleteUser(admin.id, { user: admin } as any)).rejects.toThrow(BadRequestException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("menolak menghapus admin aktif terakhir dengan 400", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "u2", role: "ADMIN", isActive: true });
    prisma.user.count.mockResolvedValue(0);
    const controller = new AdminController(prisma as any);
    await expect(controller.deleteUser("u2", { user: admin } as any)).rejects.toThrow(BadRequestException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("mengizinkan hapus admin lain selama masih ada admin aktif lain", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "u2", role: "ADMIN", isActive: true });
    prisma.user.count.mockResolvedValue(1);
    const controller = new AdminController(prisma as any);
    await expect(controller.deleteUser("u2", { user: admin } as any)).resolves.toEqual({ ok: true });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u2" } });
  });

  it("mengizinkan hapus pengguna non-admin tanpa menghitung admin", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "u3", role: "EDITOR", isActive: true });
    const controller = new AdminController(prisma as any);
    await expect(controller.deleteUser("u3", { user: admin } as any)).resolves.toEqual({ ok: true });
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it("pengguna tidak ditemukan -> NotFoundException", async () => {
    const prisma = makePrisma();
    const controller = new AdminController(prisma as any);
    await expect(controller.deleteUser("u9", { user: admin } as any)).rejects.toThrow(NotFoundException);
  });

  it("update demote pengguna tidak ditemukan -> NotFoundException", async () => {
    const prisma = makePrisma();
    const controller = new AdminController(prisma as any);
    await expect(controller.updateUser("u9", { role: "EDITOR" })).rejects.toThrow(NotFoundException);
  });

  it("menolak menurunkan admin aktif terakhir dengan 400", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "u2", role: "ADMIN", isActive: true });
    prisma.user.count.mockResolvedValue(0);
    const controller = new AdminController(prisma as any);
    await expect(controller.updateUser("u2", { role: "EDITOR" })).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("menolak menonaktifkan admin aktif terakhir dengan 400", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "u2", role: "ADMIN", isActive: true });
    prisma.user.count.mockResolvedValue(0);
    const controller = new AdminController(prisma as any);
    await expect(controller.updateUser("u2", { isActive: false })).rejects.toThrow(BadRequestException);
  });

  it("menurunkan admin saat masih ada admin aktif lain -> boleh", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "u2", role: "ADMIN", isActive: true });
    prisma.user.count.mockResolvedValue(1);
    const controller = new AdminController(prisma as any);
    await expect(controller.updateUser("u2", { role: "EDITOR" })).resolves.toEqual({ user: expect.any(Object) });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u2" }, data: { role: "EDITOR" } });
  });

  it("update nama saja tidak memeriksa admin terakhir", async () => {
    const prisma = makePrisma();
    const controller = new AdminController(prisma as any);
    await controller.updateUser("u5", { name: "Nama Baru" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u5" }, data: { name: "Nama Baru" } });
  });

  it("promosi role menjadi ADMIN tidak memeriksa admin terakhir", async () => {
    const prisma = makePrisma();
    const controller = new AdminController(prisma as any);
    await controller.updateUser("u5", { role: "ADMIN" });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("proteksi last-admin memakai transaksi Serializable", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "u5", role: "EDITOR", isActive: true });
    const controller = new AdminController(prisma as any);
    await controller.updateUser("u5", { role: "EDITOR" });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("konflik serialisasi (P2034) -> ConflictException 409", async () => {
    const prisma = makePrisma();
    prisma.$transaction.mockRejectedValue({ code: "P2034" });
    const controller = new AdminController(prisma as any);
    await expect(controller.deleteUser("u2", { user: admin } as any)).rejects.toThrow(ConflictException);
    await expect(controller.updateUser("u2", { isActive: false })).rejects.toThrow(ConflictException);
  });

  it("update non-demote id hilang (P2025) -> NotFoundException", async () => {
    const prisma = makePrisma();
    prisma.user.update.mockRejectedValue({ code: "P2025" });
    const controller = new AdminController(prisma as any);
    await expect(controller.updateUser("u9", { name: "X" })).rejects.toThrow(NotFoundException);
  });
});

const makeFullPrisma = () => ({
  user: {
    findMany: jest.fn().mockResolvedValue([
      { id: "u1", email: "a@b.test", name: "A", role: "ADMIN", isActive: true, createdAt: new Date("2026-01-01T00:00:00Z"), lastLoginAt: null },
    ]),
    count: jest.fn().mockResolvedValue(1),
    create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: "u2", ...data, createdAt: new Date(), lastLoginAt: null })),
  },
  auditLog: {
    findMany: jest.fn().mockResolvedValue([
      { id: "a1", userId: "u1", action: "POST /v1/x", entity: "/v1/x", entityId: null, metadata: null, ip: "127.0.0.1", createdAt: new Date("2026-01-02T00:00:00Z"), user: { email: "a@b.test" } },
    ]),
    count: jest.fn().mockResolvedValue(1),
  },
  post: { count: jest.fn().mockResolvedValue(2) },
  pmbRegistration: { count: jest.fn().mockResolvedValue(1) },
  subscriber: { count: jest.fn().mockResolvedValue(3) },
  mediaAsset: {
    count: jest.fn().mockResolvedValue(4),
    findMany: jest.fn().mockResolvedValue([
      { id: "m1", url: "/media/x.png", filename: "x.png", mimeType: "image/png", size: 10, alt: null, createdAt: new Date("2026-01-03T00:00:00Z") },
    ]),
    findUnique: jest.fn().mockResolvedValue({ id: "m1", url: "/media/x.png" }),
    delete: jest.fn().mockResolvedValue({}),
  },
});

describe("AdminController — handler lain", () => {
  it("listUsers memetakan tanggal dan tidak membocorkan passwordHash", async () => {
    const prisma = makeFullPrisma();
    const controller = new AdminController(prisma as any);
    const out = await controller.listUsers({});
    expect(out.users[0].email).toBe("a@b.test");
    expect(out.users[0].lastLoginAt).toBeNull();
    expect(JSON.stringify(out)).not.toContain("passwordHash");
    expect(out.pagination.total).toBe(1);
  });

  it("createUser menyimpan email lowercase dan menyembunyikan passwordHash", async () => {
    const prisma = makeFullPrisma();
    const controller = new AdminController(prisma as any);
    const out = await controller.createUser({ name: "Baru", email: "Baru@TPB.test", password: "Rahasia12345", role: "EDITOR" });
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.user.create.mock.calls[0][0].data.email).toBe("baru@tpb.test");
    expect(out.user.passwordHash).toBeUndefined();
  });

  it("dashboard summary mengembalikan hitungan", async () => {
    const prisma = makeFullPrisma();
    const controller = new AdminController(prisma as any);
    const out = await controller.dashboardSummary();
    expect(out).toMatchObject({ posts: 2, newPmb: 1, subscribers: 3, media: 4 });
    expect(out.audit).toHaveLength(1);
  });

  it("listAudit memetakan entri dan waktu ISO", async () => {
    const prisma = makeFullPrisma();
    const controller = new AdminController(prisma as any);
    const out = await controller.listAudit({});
    expect(out.audit[0].action).toBe("POST /v1/x");
    expect(out.audit[0].createdAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("listMedia memetakan entri", async () => {
    const prisma = makeFullPrisma();
    const controller = new AdminController(prisma as any);
    const out = await controller.listMedia({});
    expect(out.media[0].url).toBe("/media/x.png");
    expect(out.pagination.total).toBe(4);
  });

  it("removeMedia menghapus aset", async () => {
    const prisma = makeFullPrisma();
    const controller = new AdminController(prisma as any);
    await expect(controller.removeMedia("m1")).resolves.toEqual({ ok: true });
    expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
  });

  it("uploadMedia tanpa berkas -> 400", async () => {
    const prisma = makeFullPrisma();
    const controller = new AdminController(prisma as any);
    await expect(controller.uploadMedia(undefined)).rejects.toThrow(BadRequestException);
  });

  it("uploadMedia berkas bukan gambar -> 400", async () => {
    const prisma = makeFullPrisma();
    const controller = new AdminController(prisma as any);
    const file = { buffer: Buffer.from("<html><body>x</body></html>"), originalname: "x.png", size: 25 } as any;
    await expect(controller.uploadMedia(file)).rejects.toThrow(BadRequestException);
  });
});
