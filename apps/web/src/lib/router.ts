import { useEffect, useState } from "react";

export const HOME_SLUG = "beranda";

export function slugFromPath(pathname: string): string {
  const clean = pathname.replace(/\/+$/, "");
  if (!clean) return HOME_SLUG;
  return decodeURIComponent(clean.replace(/^\//, ""));
}

export function hrefForPage(slug: string): string {
  return slug === HOME_SLUG ? "/" : `/${slug}`;
}

export function usePathname(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onChange = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);
  return path;
}

export function navigate(to: string) {
  withinPageAnchor(to);
  if (window.location.pathname + window.location.hash === to) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.dispatchEvent(new Event("tpb:navigate"));
}

export function isAdminRoute(): boolean {
  return window.location.hash === "#admin";
}

export function useAdminRoute(): boolean {
  const [admin, setAdmin] = useState(() => isAdminRoute());
  useEffect(() => {
    const apply = () => setAdmin(isAdminRoute());
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  return admin;
}

export function scrollToHash(hash: string) {
  if (!hash || hash === "#") return;
  const target = document.getElementById(hash.slice(1));
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function withinPageAnchor(href: string) {
  if (!href.startsWith("#")) return;
  const target = document.getElementById(href.slice(1));
  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
}
