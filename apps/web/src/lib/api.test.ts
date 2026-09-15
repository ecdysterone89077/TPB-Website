import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let lastUrl = "";

function stubFetch(body: unknown, status = 200): void {
  lastUrl = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      lastUrl = String(input);
      return jsonResp(body, status);
    }),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("api.listPublic", () => {
  it("membentuk query paginasi dan mengembalikan posts", async () => {
    stubFetch({ posts: [{ id: "1" }] });

    const posts = await api.listPublic({ limit: 10, offset: 20 });

    expect(posts).toEqual([{ id: "1" }]);
    expect(lastUrl).toContain("/posts?limit=10&offset=20");
  });

  it("melempar pesan error dari server", async () => {
    stubFetch({ message: "gagal" }, 500);

    await expect(api.getPages()).rejects.toThrow("gagal");
  });

  it("menampilkan path field yang gagal validasi dari issues", async () => {
    stubFetch(
      { message: "Data tidak valid.", issues: [{ path: "dosen.people.3.photo", message: "String must contain at least 1 character(s)" }] },
      400,
    );

    await expect(api.registerPmb({} as never)).rejects.toThrow(/dosen\.people\.3\.photo/);
  });

  it("menormalisasi path array dan memotong maksimal 3 issues", async () => {
    stubFetch(
      {
        message: "Data tidak valid.",
        issues: [
          { path: ["dosen", "people", 3, "photo"], message: "salah" },
          { path: "b", message: "x" },
          { path: "c", message: "y" },
          { path: "d", message: "z" },
        ],
      },
      400,
    );

    try {
      await api.registerPmb({} as never);
      throw new Error("seharusnya gagal");
    } catch (error: any) {
      expect(error.message).toContain("dosen.people.3.photo: salah");
      expect(error.message).toContain("c: y");
      expect(error.message).not.toContain("d: z");
    }
  });
});

describe("api.listAll", () => {
  it("menambah flag all=1 dengan separator yang benar", async () => {
    stubFetch({ posts: [], pagination: { limit: 5, offset: 0, total: 0, hasMore: false } });

    await api.listAll({ limit: 5 });

    expect(lastUrl).toContain("/posts?limit=5&all=1");
  });
});

describe("api.getAnchors", () => {
  it("mengambil peta anchor dari endpoint publik", async () => {
    stubFetch({ anchors: { dosen: "profil" } });

    await expect(api.getAnchors()).resolves.toEqual({ dosen: "profil" });
    expect(lastUrl).toContain("/anchors");
  });
});
