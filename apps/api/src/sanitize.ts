import sanitize from "sanitize-html";
import type { Block } from "@tpb/contracts";

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a",
  "h2", "h3", "h4", "blockquote", "code", "pre", "hr",
  "table", "thead", "tbody", "tr", "th", "td", "img", "iframe", "figure", "figcaption", "span",
];

const ALLOWED_IFRAME_HOSTS = [
  "www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com",
  "www.google.com", "maps.google.com", "www.instagram.com", "instagram.com",
];

/** Sanitasi HTML blok `html` (mode lanjutan) — allowlist ketat, tanpa script/event handler. */
export function sanitizeHtml(code: string): string {
  return sanitize(code, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel", "title"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "loading", "title", "referrerpolicy"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"], iframe: ["https"] },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: "noopener noreferrer", ...(attribs.target === "_blank" ? { target: "_blank" } : {}) },
      }),
    },
    exclusiveFilter: (frame) =>
      frame.tag === "iframe" &&
      !ALLOWED_IFRAME_HOSTS.some((host) => {
        try {
          return new URL(frame.attribs.src).hostname === host;
        } catch {
          return false;
        }
      }),
  });
}

/** Bersihkan blok sebelum disimpan; hanya blok `html` yang diubah. */
export function sanitizeBlock(block: Block): Block {
  if (block.type === "html") return { ...block, data: { code: sanitizeHtml(block.data.code) } };
  return block;
}
