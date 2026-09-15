import type { Block } from "@tpb/contracts";
import { HOME_SLUG, hrefForPage } from "../../lib/router";
import { blockLabel } from "./builder/specs";

export type NavLinkMode = "page" | "url" | "phone" | "email";

export type NavLinkValue = {
  mode: NavLinkMode;
  slug: string;
  anchor: string;
  value: string;
};

export function emptyNavLink(): NavLinkValue {
  return { mode: "page", slug: HOME_SLUG, anchor: "", value: "" };
}

export function parseNavHref(href: string): NavLinkValue {
  const raw = (href ?? "").trim();
  if (/^mailto:/i.test(raw)) return { mode: "email", slug: HOME_SLUG, anchor: "", value: raw.slice(7) };
  if (/^tel:/i.test(raw)) return { mode: "phone", slug: HOME_SLUG, anchor: "", value: raw.slice(4) };
  if (/^https?:\/\//i.test(raw)) return { mode: "url", slug: HOME_SLUG, anchor: "", value: raw };
  if (raw.startsWith("#")) return { mode: "page", slug: HOME_SLUG, anchor: raw.slice(1), value: "" };
  if (raw.startsWith("/")) {
    const [pathPart, hashPart = ""] = raw.split("#");
    const slug = pathPart.replace(/^\/+/, "").replace(/\/+$/, "");
    return { mode: "page", slug: slug || HOME_SLUG, anchor: hashPart, value: "" };
  }
  return { mode: "url", slug: HOME_SLUG, anchor: "", value: raw };
}

export function buildNavHref(link: NavLinkValue): string {
  if (link.mode === "url") return link.value.trim();
  if (link.mode === "phone") return `tel:${link.value.replace(/\s+/g, "")}`;
  if (link.mode === "email") return `mailto:${link.value.replace(/\s+/g, "")}`;
  const anchor = link.anchor.trim();
  const href = hrefForPage(link.slug.trim() || HOME_SLUG);
  return anchor ? `${href}#${anchor}` : href;
}

export type AnchorChoice = { value: string; label: string };

export function anchorChoices(blocks: Block[]): AnchorChoice[] {
  const seen = new Set<string>();
  const choices: AnchorChoice[] = [];
  for (const block of blocks) {
    if (!block.anchor || !block.isVisible || seen.has(block.anchor)) continue;
    seen.add(block.anchor);
    choices.push({ value: block.anchor, label: `${blockLabel(block.type)} — #${block.anchor}` });
  }
  return choices;
}
