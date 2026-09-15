import { useMemo } from "react";
import type { SystemTexts } from "@tpb/contracts";
import { useSite } from "./site";

export type SystemTextValues = {
  loading: string;
  notFoundTitle: string;
  notFoundBody: string;
  backLabel: string;
  errorTitle: string;
  errorBody: string;
  collectionError: string;
  collectionEmpty: string;
  newsAllTab: string;
  searchPlaceholder: string;
  titleSuffix: string;
  pmb: {
    title: string;
    doneTitle: string;
    doneBody: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    phonePlaceholder: string;
    schoolPlaceholder: string;
    programPlaceholder: string;
    messagePlaceholder: string;
    submitLabel: string;
    sendingLabel: string;
    cancelLabel: string;
    closeLabel: string;
  };
};

export const DEFAULT_SYSTEM_TEXTS: SystemTextValues = {
  loading: "Memuat konten…",
  notFoundTitle: "404 — Halaman tidak ditemukan",
  notFoundBody: "Periksa kembali alamat yang Anda tuju.",
  backLabel: "Kembali ke Beranda",
  errorTitle: "Gagal memuat halaman",
  errorBody: "Terjadi kesalahan saat memuat konten halaman.",
  collectionError: "Gagal memuat data. Coba muat ulang halaman.",
  collectionEmpty: "Belum ada data untuk ditampilkan.",
  newsAllTab: "Semua",
  searchPlaceholder: "Cari program, dosen, riset, berita… (min. 2 huruf)",
  titleSuffix: "TPB UNU Purwokerto",
  pmb: {
    title: "Pendaftaran PMB",
    doneTitle: "Pendaftaran terkirim",
    doneBody: "Tim PMB akan menghubungi Anda.",
    namePlaceholder: "Nama lengkap",
    emailPlaceholder: "Email",
    phonePlaceholder: "Nomor WhatsApp / telepon",
    schoolPlaceholder: "Asal sekolah",
    programPlaceholder: "Pilih program",
    messagePlaceholder: "Pesan",
    submitLabel: "Kirim",
    sendingLabel: "Mengirim…",
    cancelLabel: "Batal",
    closeLabel: "Tutup",
  },
};

const mergeStrings = <T extends Record<string, string>>(defaults: T, overrides: Record<string, unknown> | undefined): T => {
  const merged = { ...defaults };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (typeof value === "string" && value.trim() !== "") merged[key as keyof T] = value as T[keyof T];
  }
  return merged;
};

export function resolveSystemTexts(texts: SystemTexts | null | undefined): SystemTextValues {
  const source = (texts ?? {}) as Record<string, unknown>;
  const resolved: SystemTextValues = { ...DEFAULT_SYSTEM_TEXTS, pmb: { ...DEFAULT_SYSTEM_TEXTS.pmb } };
  for (const key of Object.keys(DEFAULT_SYSTEM_TEXTS)) {
    if (key === "pmb") continue;
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") (resolved as unknown as Record<string, string>)[key] = value;
  }
  resolved.pmb = mergeStrings(DEFAULT_SYSTEM_TEXTS.pmb, source.pmb as Record<string, unknown> | undefined);
  return resolved;
}

export function systemTextsOverrides(values: SystemTextValues): SystemTexts | undefined {
  const overrides: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_SYSTEM_TEXTS)) {
    if (key === "pmb") continue;
    const current = values[key as keyof SystemTextValues];
    if (typeof current === "string" && current !== DEFAULT_SYSTEM_TEXTS[key as keyof SystemTextValues]) overrides[key] = current;
  }
  const pmb: Record<string, string> = {};
  for (const [key, value] of Object.entries(values.pmb)) {
    if (value !== DEFAULT_SYSTEM_TEXTS.pmb[key as keyof SystemTextValues["pmb"]]) pmb[key] = value;
  }
  if (Object.keys(pmb).length) overrides.pmb = pmb;
  return Object.keys(overrides).length ? (overrides as SystemTexts) : undefined;
}

export function useSystemTexts(): SystemTextValues {
  const site = useSite();
  return useMemo(() => resolveSystemTexts(site.settings?.texts), [site.settings]);
}
