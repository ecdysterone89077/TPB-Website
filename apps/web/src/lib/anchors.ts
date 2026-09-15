import { api } from "./api";
import { hrefForPage, isAdminRoute, navigate, scrollToHash } from "./router";

let cache: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

export function resetAnchorCache() {
  cache = null;
  inflight = null;
}

export function loadAnchors(): Promise<Record<string, string>> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api
      .getAnchors()
      .then((anchors) => {
        cache = anchors;
        return anchors;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export async function resolveAnchorHref(currentSlug: string, anchor: string): Promise<string | null> {
  if (!anchor) return null;
  if (document.getElementById(anchor)) return null;
  const anchors = await loadAnchors().catch(() => null);
  const slug = anchors?.[anchor];
  if (typeof slug !== "string" || !slug || slug === currentSlug) return null;
  return `${hrefForPage(slug)}#${anchor}`;
}

export function scrollOrResolve(slug: string, hash: string) {
  if (!hash || hash === "#") return;
  const anchor = hash.slice(1);
  if (document.getElementById(anchor)) {
    scrollToHash(hash);
    return;
  }
  const source = `${window.location.pathname}${window.location.hash}`;
  void resolveAnchorHref(slug, anchor).then((href) => {
    if (!href || isAdminRoute()) return;
    if (`${window.location.pathname}${window.location.hash}` !== source) return;
    navigate(href, { replace: true });
  });
}
