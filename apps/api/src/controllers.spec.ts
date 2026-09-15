import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { PmbController } from "./controllers/pmb.controller";
import { PostsController } from "./controllers/posts.controller";
import { parse } from "./zod";
import { AboutSchema, AkademikSchema, BrandSchema, CommunitySchema, HeroSchema, PmbInputSchema, PostInputSchema, ProfilSchema, ProgramsSchema } from "@tpb/contracts";

describe("controller behavior with mocked Prisma", () => {
  it("PMB mengembalikan registration yang sama untuk idempotency key yang sudah ada", async () => {
    const existing = { id: "r1", idempotencyKey: "550e8400-e29b-41d4-a716-446655440000" };
    const prisma = {
      pmbRegistration: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
      },
    };
    const controller = new PmbController(prisma as any);
    const result = await controller.create({
      name: "A",
      email: "a@example.com",
      phone: "081234567890",
      idempotencyKey: existing.idempotencyKey,
    });
    expect(result).toEqual({ registration: existing });
    expect(prisma.pmbRegistration.create).not.toHaveBeenCalled();
  });

  it("PMB membuat registration baru bila key belum ada", async () => {
    const created = { id: "r2" };
    const prisma = {
      pmbRegistration: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const controller = new PmbController(prisma as any);
    const result = await controller.create({
      name: "A",
      email: "a@example.com",
      phone: "081234567890",
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440001",
    });
    expect(result).toEqual({ registration: created });
    expect(prisma.pmbRegistration.create).toHaveBeenCalledTimes(1);
  });

  it("posts list publik hanya meminta post published yang belum dihapus", async () => {
    const prisma = { post: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    const jwt = { verify: jest.fn().mockReturnValue({ id: "u1", role: "EDITOR" }) };
    const controller = new PostsController(prisma as any, jwt as any);
    await controller.list(undefined as any, {}, { user: undefined } as any);
    expect(prisma.post.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, status: "published" },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      skip: 0,
      take: 50,
    });
  });

  it("posts all tanpa user ditolak", async () => {
    const controller = new PostsController({ post: { findMany: jest.fn(), count: jest.fn() }, user: { findUnique: jest.fn() } } as any, { verify: jest.fn() } as any);
    await expect(controller.list("1", {}, { user: undefined } as any)).rejects.toThrow(UnauthorizedException);
  });

  it("schema post menolak tanggal invalid dan parse memberi BadRequestException", () => {
    expect(() => parse(PostInputSchema, { title: "x", category: "Umum", date: "not-a-date" })).toThrow(BadRequestException);
  });

  it("schema PMB menolak email invalid dan phone terlalu pendek", () => {
    expect(() => parse(PmbInputSchema, { name: "A", email: "invalid", phone: "123" })).toThrow(BadRequestException);
  });

  it("schema post menerima URL absolut, path /media, dan null sebagai gambar", () => {
    expect(parse(PostInputSchema, { title: "x", category: "Umum", image: "https://tpb.test/a.png" }).image).toBe("https://tpb.test/a.png");
    expect(parse(PostInputSchema, { title: "x", category: "Umum", image: "/media/a.png" }).image).toBe("/media/a.png");
    expect(parse(PostInputSchema, { title: "x", category: "Umum", image: null }).image).toBeNull();
  });

  it("schema post menolak gambar dengan skema selain http(s) atau path absolut", () => {
    expect(() => parse(PostInputSchema, { title: "x", category: "Umum", image: "javascript:alert(1)" })).toThrow(BadRequestException);
    expect(() => parse(PostInputSchema, { title: "x", category: "Umum", image: "relatif/a.png" })).toThrow(BadRequestException);
    expect(() => parse(PostInputSchema, { title: "x", category: "Umum", image: "//evil.test/x.png" })).toThrow(BadRequestException);
    expect(() => parse(PostInputSchema, { title: "x", category: "Umum", image: "/\\evil.test/x.png" })).toThrow(BadRequestException);
    expect(() => parse(PostInputSchema, { title: "x", category: "Umum", image: "https://" })).toThrow(BadRequestException);
    expect(() => parse(PostInputSchema, { title: "x", category: "Umum", image: "/media/x.png " })).toThrow(BadRequestException);
  });
});

const brand = { kicker: "", name: "TPB", org: "UNU", logoUrl: "https://tpb.test/logo.png" };
const hero = { badge: "", line1: "a", highlight: "b", line2: "c", subtitle: "", primaryLabel: "Daftar", primaryHref: "#pmb", secondaryLabel: "", image: "https://tpb.test/hero.jpg" };
const about = { kicker: "", title: "", body: "", sinceYear: "2024", sinceNote: "", image: "https://tpb.test/about.jpg", points: [] };
const programs = { kicker: "", title: "", cta: "", cards: [{ tag: "", title: "", body: "", img: "https://tpb.test/kartu.jpg", color: "" }] };
const community = { kicker: "", title: "", body: "", image: "https://tpb.test/masyarakat.jpg", items: [] };
const profil = {
  sejarah: { kicker: "", title: "", intro: "", timeline: [] },
  visiMisi: { kicker: "", title: "", visi: "", misi: [] },
  struktur: { kicker: "", title: "", people: [] },
  sambutan: { kicker: "", title: "", image: "https://tpb.test/sambutan.jpg", quote: "", name: "", role: "" },
};
const akademik = (photo?: unknown, omit = false) => ({
  kurikulum: { kicker: "", title: "", intro: "", sks: [], clusters: [] },
  kalender: { kicker: "", title: "", items: [] },
  dosen: { kicker: "", title: "", intro: "", people: [{ name: "A", field: "B", ...(omit ? {} : { photo }) }] },
  laboratorium: { kicker: "", title: "", labs: [] },
});

describe("field gambar modul menerima kosong (tanpa gambar)", () => {
  it('menerima "" dan null pada seluruh field gambar', () => {
    for (const v of ["", null]) {
      expect(parse(BrandSchema, { ...brand, logoUrl: v }).logoUrl).toBe(v);
      expect(parse(HeroSchema, { ...hero, image: v }).image).toBe(v);
      expect(parse(AboutSchema, { ...about, image: v }).image).toBe(v);
      expect(parse(ProgramsSchema, { ...programs, cards: [{ ...programs.cards[0], img: v }] }).cards[0].img).toBe(v);
      expect(parse(CommunitySchema, { ...community, image: v }).image).toBe(v);
      expect(parse(ProfilSchema, { ...profil, sambutan: { ...profil.sambutan, image: v } }).sambutan.image).toBe(v);
      expect(parse(AkademikSchema, akademik(v)).dosen.people[0].photo).toBe(v);
    }
  });

  it("foto dosen boleh dihilangkan tanpa key photo", () => {
    expect(parse(AkademikSchema, akademik(undefined, true)).dosen.people[0].photo).toBeUndefined();
  });

  it("spasi dan string lebih dari 2000 karakter tetap ditolak", () => {
    expect(() => parse(HeroSchema, { ...hero, image: " " })).toThrow(BadRequestException);
    expect(() => parse(HeroSchema, { ...hero, image: `https://tpb.test/${"a".repeat(2000)}` })).toThrow(BadRequestException);
  });

  it("tipe gambar salah memberi pesan spesifik (bukan Invalid input)", () => {
    try {
      parse(HeroSchema, { ...hero, image: 123 });
      throw new Error("seharusnya gagal");
    } catch (error) {
      const res = (error as BadRequestException).getResponse() as any;
      expect(res.issues[0].message).toContain("string");
    }
  });

  it("batas panjang 2000 diterima dan 2001 ditolak", () => {
    expect(parse(HeroSchema, { ...hero, image: `https://tpb.test/${"a".repeat(1983)}` }).image).toHaveLength(2000);
    expect(() => parse(HeroSchema, { ...hero, image: `https://tpb.test/${"a".repeat(1984)}` })).toThrow(BadRequestException);
  });
});
