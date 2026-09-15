import { UnauthorizedException } from "@nestjs/common";
import { hash } from "@node-rs/argon2";
import { AuthController } from "./controllers/auth.controller";
import { config } from "./config";

const COOKIE = config.cookieName;
const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);

const makeRes = () => ({ cookie: jest.fn(), clearCookie: jest.fn() });

const user = { id: "u1", email: "a@b.test", role: "ADMIN", name: "A", isActive: true };

const makePrisma = () => {
  const tx = {
    refreshToken: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: "new-token-id" }),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: "u1", ...data })),
    },
  };
  return {
    refreshToken: {
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: "rt1" }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((fn: any) => fn(tx)),
    tx,
  };
};

const makeJwt = () => ({ signAsync: jest.fn().mockResolvedValue("access-token") });

const req = (raw: string | undefined) => ({ cookies: raw === undefined ? {} : { [COOKIE]: raw } }) as any;

describe("AuthController — refresh & reuse detection", () => {
  it("token tidak dikenal -> 401 tanpa revoke family", async () => {
    const prisma = makePrisma();
    const controller = new AuthController(prisma as any, makeJwt() as any);
    await expect(controller.refresh(req("raw"), makeRes() as any)).rejects.toThrow(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it("replay token revoked -> cabut seluruh family + 401 + clear cookie", async () => {
    const prisma = makePrisma();
    prisma.refreshToken.findUnique.mockResolvedValue({ id: "t1", userId: "u1", revokedAt: new Date(), expiresAt: future(), user });
    const res = makeRes();
    const controller = new AuthController(prisma as any, makeJwt() as any);
    await expect(controller.refresh(req("raw"), res as any)).rejects.toThrow(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it("token revoked DAN kedaluwarsa -> 401 tanpa revoke family", async () => {
    const prisma = makePrisma();
    prisma.refreshToken.findUnique.mockResolvedValue({ id: "t1", userId: "u1", revokedAt: new Date(), expiresAt: past(), user });
    const controller = new AuthController(prisma as any, makeJwt() as any);
    await expect(controller.refresh(req("raw"), makeRes() as any)).rejects.toThrow(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it("token kedaluwarsa -> 401 tanpa revoke family", async () => {
    const prisma = makePrisma();
    prisma.refreshToken.findUnique.mockResolvedValue({ id: "t1", userId: "u1", revokedAt: null, expiresAt: past(), user });
    const controller = new AuthController(prisma as any, makeJwt() as any);
    await expect(controller.refresh(req("raw"), makeRes() as any)).rejects.toThrow(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it("pengguna nonaktif -> 401", async () => {
    const prisma = makePrisma();
    prisma.refreshToken.findUnique.mockResolvedValue({ id: "t1", userId: "u1", revokedAt: null, expiresAt: future(), user: { ...user, isActive: false } });
    const controller = new AuthController(prisma as any, makeJwt() as any);
    await expect(controller.refresh(req("raw"), makeRes() as any)).rejects.toThrow(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("tanpa cookie -> 401", async () => {
    const prisma = makePrisma();
    const controller = new AuthController(prisma as any, makeJwt() as any);
    await expect(controller.refresh(req(undefined), makeRes() as any)).rejects.toThrow(UnauthorizedException);
  });

  it("rotasi valid -> set cookie baru + link replacedById", async () => {
    const prisma = makePrisma();
    prisma.refreshToken.findUnique.mockResolvedValue({ id: "t1", userId: "u1", revokedAt: null, expiresAt: future(), user });
    const res = makeRes();
    const controller = new AuthController(prisma as any, makeJwt() as any);
    const out = await controller.refresh(req("raw"), res as any);
    expect(out).toEqual({ token: "access-token", expiresIn: expect.any(Number), user: { id: "u1", email: "a@b.test", role: "ADMIN", name: "A" } });
    expect(res.cookie).toHaveBeenCalledWith(COOKIE, expect.any(String), expect.objectContaining({ httpOnly: true }));
    expect(prisma.tx.refreshToken.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { replacedById: "new-token-id" } });
  });

  it("balapan rotasi (count 0) -> 401", async () => {
    const prisma = makePrisma();
    prisma.refreshToken.findUnique.mockResolvedValue({ id: "t1", userId: "u1", revokedAt: null, expiresAt: future(), user });
    prisma.tx.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    const controller = new AuthController(prisma as any, makeJwt() as any);
    await expect(controller.refresh(req("raw"), makeRes() as any)).rejects.toThrow(UnauthorizedException);
  });
});

describe("AuthController — bootstrap, login, logout, me", () => {
  it("bootstrap saat belum ada user -> role ADMIN + token", async () => {
    const prisma = makePrisma();
    const res = makeRes();
    const controller = new AuthController(prisma as any, makeJwt() as any);
    const out = await controller.bootstrap({ name: "Admin", email: "Admin@TPB.test", password: "Rahasia12345" }, res as any);
    expect(prisma.tx.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.tx.user.create.mock.calls[0][0].data).toMatchObject({ email: "admin@tpb.test", role: "ADMIN" });
    expect(out.token).toBe("access-token");
    expect(res.cookie).toHaveBeenCalled();
  });

  it("bootstrap saat user sudah ada -> 401", async () => {
    const prisma = makePrisma();
    prisma.tx.user.count.mockResolvedValue(1);
    const controller = new AuthController(prisma as any, makeJwt() as any);
    await expect(controller.bootstrap({ name: "Admin", email: "admin@tpb.test", password: "Rahasia12345" }, makeRes() as any)).rejects.toThrow(UnauthorizedException);
  });

  it("login benar -> token + cookie + update lastLoginAt", async () => {
    const prisma = makePrisma();
    const passwordHash = await hash("Rahasia12345");
    prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash });
    const res = makeRes();
    const controller = new AuthController(prisma as any, makeJwt() as any);
    const out = await controller.login({ email: "A@B.test", password: "Rahasia12345" }, res as any);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "a@b.test" } });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { lastLoginAt: expect.any(Date) } });
    expect(out.token).toBe("access-token");
  });

  it("login password salah / email tidak ada -> 401", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash: await hash("LainSekali123") });
    const controller = new AuthController(prisma as any, makeJwt() as any);
    await expect(controller.login({ email: "a@b.test", password: "Rahasia12345" }, makeRes() as any)).rejects.toThrow(UnauthorizedException);
    const prisma2 = makePrisma();
    const controller2 = new AuthController(prisma2 as any, makeJwt() as any);
    await expect(controller2.login({ email: "x@y.test", password: "Rahasia12345" }, makeRes() as any)).rejects.toThrow(UnauthorizedException);
  });

  it("login user nonaktif -> 401", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ ...user, isActive: false, passwordHash: await hash("Rahasia12345") });
    const controller = new AuthController(prisma as any, makeJwt() as any);
    await expect(controller.login({ email: "a@b.test", password: "Rahasia12345" }, makeRes() as any)).rejects.toThrow(UnauthorizedException);
  });

  it("logout mencabut token cookie dan memberi 401 saat diulang refresh", async () => {
    const prisma = makePrisma();
    const res = makeRes();
    const controller = new AuthController(prisma as any, makeJwt() as any);
    await expect(controller.logout(req("raw"), res as any)).resolves.toEqual({ ok: true });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({ where: { tokenHash: expect.any(String), revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it("logout tanpa cookie tetap ok tanpa query", async () => {
    const prisma = makePrisma();
    const controller = new AuthController(prisma as any, makeJwt() as any);
    await expect(controller.logout(req(undefined), makeRes() as any)).resolves.toEqual({ ok: true });
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it("logout-all mencabut seluruh token user", async () => {
    const prisma = makePrisma();
    const res = makeRes();
    const controller = new AuthController(prisma as any, makeJwt() as any);
    await expect(controller.logoutAll({ user } as any, res as any)).resolves.toEqual({ ok: true });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({ where: { userId: "u1", revokedAt: null }, data: { revokedAt: expect.any(Date) } });
  });

  it("me mengembalikan profil dari DB", async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash: "x" });
    const controller = new AuthController(prisma as any, makeJwt() as any);
    const out = await controller.me({ user } as any);
    expect(out.user).toEqual({ id: "u1", email: "a@b.test", name: "A", role: "ADMIN", isActive: true });
  });

  it("me user hilang/nonaktif -> 401", async () => {
    const prisma = makePrisma();
    const controller = new AuthController(prisma as any, makeJwt() as any);
    await expect(controller.me({ user } as any)).rejects.toThrow(UnauthorizedException);
    const prisma2 = makePrisma();
    prisma2.user.findUnique.mockResolvedValue({ ...user, isActive: false });
    const controller2 = new AuthController(prisma2 as any, makeJwt() as any);
    await expect(controller2.me({ user } as any)).rejects.toThrow(UnauthorizedException);
  });

  it("me tanpa user di request -> 401", async () => {
    const prisma = makePrisma();
    const controller = new AuthController(prisma as any, makeJwt() as any);
    await expect(controller.me({} as any)).rejects.toThrow(UnauthorizedException);
  });
});
