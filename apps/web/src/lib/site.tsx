import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { NavItemInput, SiteSettings } from "@tpb/contracts";
import { api } from "./api";

type SiteState = {
  status: "loading" | "ready" | "empty" | "error";
  settings: SiteSettings | null;
  nav: NavItemInput[];
  message?: string;
  reload: () => void;
};

export const SiteContext = createContext<SiteState>({ status: "loading", settings: null, nav: [], reload: async () => {} });

export function useSite(): SiteState {
  return useContext(SiteContext);
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<SiteState, "reload">>({ status: "loading", settings: null, nav: [] });

  const load = async () => {
    setState({ status: "loading", settings: null, nav: [] });
    try {
      const [settings, nav] = await Promise.all([api.getSettings(), api.getNav()]);
      if (settings == null) {
        setState({ status: "empty", settings: null, nav });
        return;
      }
      setState({ status: "ready", settings, nav });
    } catch (error: any) {
      setState({ status: "error", settings: null, nav: [], message: error?.message ?? "Gagal memuat pengaturan situs." });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return <SiteContext.Provider value={{ ...state, reload: load }}>{children}</SiteContext.Provider>;
}
