import type { SiteBundle, SiteBundleMedia } from "@tpb/contracts";

export function bundleFileName(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `tpb-konten-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.json`;
}

export function missingBundleMedia(media: SiteBundleMedia[], knownUrls: string[]): string[] {
  const known = new Set(knownUrls);
  return media.filter((item) => item.url.startsWith("/") && !known.has(item.url)).map((item) => item.url);
}

export function bundlePreview(bundle: SiteBundle, existingSlugs: string[]): { pages: number; newPages: number; posts: number } {
  const known = new Set(existingSlugs);
  return {
    pages: bundle.pages.length,
    newPages: bundle.pages.filter((page) => !known.has(page.slug)).length,
    posts: bundle.posts.length,
  };
}
