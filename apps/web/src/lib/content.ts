import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { SiteContentSchema, type SiteContent } from "@tpb/contracts";
import { normalizeDriveUrl } from "./drive";

type ContentState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; content: SiteContent };

type ContentCtx = ContentState & { reload: () => Promise<void> };

const Ctx = createContext<ContentCtx>({ status: "loading", reload: async () => {} });

function deepNormalizeDrive(input: any): any {
  if (typeof input === "string" && input.includes("drive.google.com")) return normalizeDriveUrl(input);
  if (Array.isArray(input)) return input.map(deepNormalizeDrive);
  if (input && typeof input === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input)) out[k] = deepNormalizeDrive(v);
    return out;
  }
  return input;
}

export function useContent(): ContentCtx {
  return useContext(Ctx);
}

export function ContentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContentState>({ status: "loading" });

  const load = async () => {
    setState({ status: "loading" });
    try {
      const content = await api.getContent();
      if (content == null) {
        setState({ status: "empty" });
        return;
      }
      const parsed = SiteContentSchema.safeParse(content);
      if (!parsed.success) {
        setState({ status: "error", message: "Konten situs tersimpan tidak valid. Perbaiki melalui panel admin." });
        return;
      }
      setState({ status: "ready", content: deepNormalizeDrive(parsed.data) as SiteContent });
    } catch (e: any) {
      setState({ status: "error", message: e?.message ?? "Gagal memuat konten." });
    }
  };

  useEffect(() => { load(); }, []);

  return createElement(Ctx.Provider, { value: { ...state, reload: load } }, children);
}
