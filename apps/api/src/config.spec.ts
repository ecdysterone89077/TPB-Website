import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const KEYS = ["NODE_ENV", "PORT", "DATABASE_URL", "JWT_ACCESS_SECRET", "CORS_ORIGINS", "COOKIE_SECURE", "COOKIE_NAME", "MEDIA_DIR", "MEDIA_MAX_MB", "TRUST_PROXY", "JWT_ACCESS_TTL_SECONDS", "JWT_REFRESH_TTL_DAYS"] as const;
const ORIGINAL = { ...process.env };
const tempDirs: string[] = [];

const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "tpb-config-"));
  tempDirs.push(dir);
  return dir;
};

const loadConfig = (env: Record<string, string> = {}) => {
  const next: NodeJS.ProcessEnv = { ...ORIGINAL };
  for (const key of KEYS) next[key] = key in env ? env[key] : "";
  process.env = next;
  try {
    let loaded: any;
    jest.isolateModules(() => {
      loaded = jest.requireActual("./config").config;
    });
    return { config: loaded, error: null as Error | null };
  } catch (error) {
    return { config: null, error: error as Error };
  }
};

afterEach(() => {
  process.env = { ...ORIGINAL };
  jest.resetModules();
});

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe("config", () => {
  it("development: default lokal aman", () => {
    const { config, error } = loadConfig({ NODE_ENV: "development", DATABASE_URL: "mysql://u:p@localhost:3306/db", MEDIA_DIR: tempDir() });
    expect(error).toBeNull();
    expect(config.nodeEnv).toBe("development");
    expect(config.port).toBe(3000);
    expect(config.jwtAccessTtlSeconds).toBe(900);
    expect(config.jwtRefreshTtlDays).toBe(30);
    expect(config.cookieName).toBe("tpb_refresh");
    expect(config.cookieSecure).toBe(false);
    expect(config.mediaMaxMb).toBe(10);
    expect(config.trustProxy).toBe(false);
    expect(config.corsOrigins).toEqual(["http://localhost:5173"]);
  });

  it("test: DATABASE_URL kosong memakai fallback test", () => {
    const { config, error } = loadConfig({ NODE_ENV: "test", MEDIA_DIR: tempDir() });
    expect(error).toBeNull();
    expect(config.databaseUrl).toContain("mysql://test:test@localhost:3306/test");
  });

  it("NODE_ENV tidak dikenal -> error", () => {
    const { error } = loadConfig({ NODE_ENV: "staging", DATABASE_URL: "mysql://u:p@localhost:3306/db", MEDIA_DIR: tempDir() });
    expect(error?.message).toContain("NODE_ENV");
  });

  it("development tanpa DATABASE_URL -> error", () => {
    const { error } = loadConfig({ NODE_ENV: "development", MEDIA_DIR: tempDir() });
    expect(error?.message).toContain("DATABASE_URL");
  });

  it("production valid lolos", () => {
    const { config, error } = loadConfig({
      NODE_ENV: "production",
      DATABASE_URL: "mysql://u:p@db:3306/db",
      JWT_ACCESS_SECRET: "x".repeat(48),
      CORS_ORIGINS: "https://tpb.test",
      COOKIE_SECURE: "true",
      MEDIA_DIR: tempDir(),
      TRUST_PROXY: "2",
    });
    expect(error).toBeNull();
    expect(config.nodeEnv).toBe("production");
    expect(config.cookieSecure).toBe(true);
    expect(config.trustProxy).toBe(2);
  });

  it("production tanpa JWT secret -> error", () => {
    const { error } = loadConfig({ NODE_ENV: "production", DATABASE_URL: "mysql://u:p@db:3306/db", CORS_ORIGINS: "https://tpb.test", COOKIE_SECURE: "true", MEDIA_DIR: tempDir() });
    expect(error?.message).toContain("JWT_ACCESS_SECRET");
  });

  it("production JWT secret pendek -> error", () => {
    const { error } = loadConfig({ NODE_ENV: "production", DATABASE_URL: "mysql://u:p@db:3306/db", JWT_ACCESS_SECRET: "pendek", CORS_ORIGINS: "https://tpb.test", COOKIE_SECURE: "true", MEDIA_DIR: tempDir() });
    expect(error?.message).toContain("JWT_ACCESS_SECRET");
  });

  it("production CORS kosong / wildcard / tidak valid -> error", () => {
    const base = { NODE_ENV: "production", DATABASE_URL: "mysql://u:p@db:3306/db", JWT_ACCESS_SECRET: "x".repeat(48), COOKIE_SECURE: "true", MEDIA_DIR: tempDir() };
    expect(loadConfig({ ...base, CORS_ORIGINS: "" }).error?.message).toContain("CORS_ORIGINS");
    expect(loadConfig({ ...base, CORS_ORIGINS: "*" }).error?.message).toContain("CORS_ORIGINS");
    expect(loadConfig({ ...base, CORS_ORIGINS: "ftp://tpb.test" }).error?.message).toContain("CORS_ORIGINS");
  });

  it("production COOKIE_SECURE=false -> error", () => {
    const { error } = loadConfig({ NODE_ENV: "production", DATABASE_URL: "mysql://u:p@db:3306/db", JWT_ACCESS_SECRET: "x".repeat(48), CORS_ORIGINS: "https://tpb.test", COOKIE_SECURE: "false", MEDIA_DIR: tempDir() });
    expect(error?.message).toContain("COOKIE_SECURE");
  });

  it("production MEDIA_DIR relatif -> error", () => {
    const { error } = loadConfig({ NODE_ENV: "production", DATABASE_URL: "mysql://u:p@db:3306/db", JWT_ACCESS_SECRET: "x".repeat(48), CORS_ORIGINS: "https://tpb.test", COOKIE_SECURE: "true", MEDIA_DIR: "uploads-relatif" });
    expect(error?.message).toContain("MEDIA_DIR");
  });

  it("TRUST_PROXY tidak valid -> error", () => {
    const { error } = loadConfig({ NODE_ENV: "development", DATABASE_URL: "mysql://u:p@localhost:3306/db", MEDIA_DIR: tempDir(), TRUST_PROXY: "abc" });
    expect(error?.message).toContain("TRUST_PROXY");
  });

  it("batas angka divalidasi", () => {
    const base = { NODE_ENV: "development", DATABASE_URL: "mysql://u:p@localhost:3306/db", MEDIA_DIR: tempDir() };
    expect(loadConfig({ ...base, PORT: "70000" }).error?.message).toContain("PORT");
    expect(loadConfig({ ...base, JWT_ACCESS_TTL_SECONDS: "90000" }).error?.message).toContain("JWT_ACCESS_TTL_SECONDS");
    expect(loadConfig({ ...base, MEDIA_MAX_MB: "500" }).error?.message).toContain("MEDIA_MAX_MB");
  });
});
