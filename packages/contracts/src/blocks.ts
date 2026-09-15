import { z } from "zod";
import { SiteContentSchema, isSafeHref } from "./content.js";

const S = SiteContentSchema.shape;

/** URL gambar: http(s) berhost atau path absolut (/media/...); ""/null = tanpa gambar. */
const ImageValueSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => !/\s/.test(v) && (/^https?:\/\/[^\s/]+/i.test(v) || (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\"))), { message: "Gambar harus URL http(s) atau path absolut /..." });
export const MediaRefSchema = z.union([ImageValueSchema, z.literal(""), z.null()]);
export type MediaRef = z.infer<typeof MediaRefSchema>;

const HTTP_URL = /^https?:\/\/[^\s/]+/i;

const SafeHrefSchema = z.string().trim().min(1).max(2000).refine(isSafeHref, { message: "Tautan harus http(s), path absolut, anchor #, mailto:, atau tel:." });
const HttpUrlSchema = z.string().trim().min(1).max(2000).refine((v) => !/\s/.test(v) && HTTP_URL.test(v), { message: "URL harus http(s) dengan host yang valid." });

/* ------------------------------------------------------- rich text (TipTap) */

export const RichTextMarkSchema = z
  .object({
    type: z.enum(["bold", "italic", "underline", "strike", "code", "link"]),
    attrs: z.record(z.unknown()).optional(),
  })
  .superRefine((mark, ctx) => {
    if (mark.type !== "link") return;
    const href = (mark.attrs as Record<string, unknown> | undefined)?.href;
    if (typeof href !== "string" || !isSafeHref(href)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tautan tidak valid.", path: ["attrs", "href"] });
    }
  });

export type RichTextNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

const RichTextNodeSchema: z.ZodType<RichTextNode> = z.lazy(() =>
  z.object({
    type: z.enum(["doc", "paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "codeBlock", "horizontalRule", "hardBreak", "text"]),
    attrs: z.record(z.unknown()).optional(),
    content: z.array(RichTextNodeSchema).max(5000).optional(),
    marks: z.array(RichTextMarkSchema).max(20).optional(),
    text: z.string().max(20000).optional(),
  }),
);

export const RichTextSchema = z.object({
  type: z.literal("doc"),
  content: z.array(RichTextNodeSchema).max(2000).optional(),
});
export type RichText = z.infer<typeof RichTextSchema>;

/* ------------------------------------------------------------ blok generik */

export const HeadingBlockSchema = z.object({
  text: z.string().trim().min(1).max(300),
  level: z.number().int().min(2).max(4).default(2),
  align: z.enum(["left", "center"]).default("left"),
});

export const RichTextBlockSchema = z.object({ doc: RichTextSchema });

export const ImageBlockSchema = z.object({
  image: MediaRefSchema,
  alt: z.string().max(300).default(""),
  caption: z.string().max(500).default(""),
  link: SafeHrefSchema.or(z.literal("")).default(""),
});

export const VideoBlockSchema = z.object({
  url: z.union([HttpUrlSchema, z.literal("")]),
  mode: z.enum(["popup", "inline"]).default("popup"),
  thumb: MediaRefSchema.optional(),
  caption: z.string().max(500).default(""),
});

export const ButtonBlockSchema = z.object({
  label: z.string().trim().min(1).max(120),
  href: SafeHrefSchema,
  style: z.enum(["primary", "secondary", "gold"]).default("primary"),
  openInNewTab: z.boolean().default(false),
  align: z.enum(["left", "center"]).default("left"),
});

export const DividerBlockSchema = z.object({});

export const SpacerBlockSchema = z.object({ size: z.enum(["sm", "md", "lg"]).default("md") });

export const AccordionBlockSchema = z.object({
  items: z
    .array(z.object({ title: z.string().trim().min(1).max(300), body: z.string().max(5000).default("") }))
    .min(1)
    .max(50),
});

export const TableBlockSchema = z.object({
  headers: z.array(z.string().max(300)).min(1).max(10),
  rows: z.array(z.array(z.string().max(2000)).max(10)).max(100),
});

export const EmbedBlockSchema = z.object({
  url: HttpUrlSchema,
  height: z.number().int().min(120).max(1200).default(420),
  title: z.string().max(200).default(""),
});

export const GalleryBlockSchema = z.object({
  items: z
    .array(
      z.object({
        image: z.string().trim().min(1).max(2000),
        kind: z.enum(["image", "video"]).default("image"),
        caption: z.string().max(500).default(""),
        title: z.string().max(300).default(""),
        thumb: MediaRefSchema.optional(),
      }),
    )
    .max(100),
  columns: z.number().int().min(2).max(4).default(3),
});

export const HtmlBlockSchema = z.object({ code: z.string().max(20000) });

/* ------------------------------------------- blok preset (gaya situs lama) */

export const HeroBlockSchema = S.hero;
export const MarqueeBlockSchema = S.marquee;
export const StatsBlockSchema = S.stats;
export const AboutBlockSchema = S.about;
export const ProgramsBlockSchema = S.programs;
export const ResearchBlockSchema = S.research;
export const CommunityBlockSchema = S.community;
export const StudentLifeBlockSchema = S.studentLife;
export const TimelineBlockSchema = S.profil.shape.sejarah;
export const VisiMisiBlockSchema = S.profil.shape.visiMisi;
export const StrukturBlockSchema = S.profil.shape.struktur;
export const QuoteBlockSchema = S.profil.shape.sambutan;
export const KurikulumBlockSchema = S.akademik.shape.kurikulum;
export const KalenderBlockSchema = S.akademik.shape.kalender;
export const DosenBlockSchema = S.akademik.shape.dosen;
export const LaboratoriumBlockSchema = S.akademik.shape.laboratorium;
export const PublikasiBlockSchema = S.penelitian.shape.publikasi;
export const JurnalBlockSchema = S.penelitian.shape.jurnal;
export const KolaborasiBlockSchema = S.penelitian.shape.kolaborasi;
export const ProgramDesaBlockSchema = S.pengabdian.shape.programDesa;
export const KemitraanBlockSchema = S.pengabdian.shape.kemitraan;
export const KegiatanBlockSchema = S.pengabdian.shape.kegiatan;
export const HimpunanBlockSchema = S.kemahasiswaan.shape.himpunan;
export const BeasiswaBlockSchema = S.kemahasiswaan.shape.beasiswa;
export const PrestasiBlockSchema = S.kemahasiswaan.shape.prestasi;
export const AlumniBlockSchema = S.kemahasiswaan.shape.alumni;
export const NewsBlockSchema = S.news;
export const CtaBlockSchema = S.cta;

/* --------------------------------------------------------------- block list */

export const BlockTypeSchema = z.enum([
  "heading",
  "richText",
  "image",
  "video",
  "button",
  "divider",
  "spacer",
  "accordion",
  "table",
  "embed",
  "gallery",
  "html",
  "hero",
  "marquee",
  "stats",
  "about",
  "programs",
  "research",
  "community",
  "studentLife",
  "timeline",
  "visiMisi",
  "struktur",
  "quote",
  "kurikulum",
  "kalender",
  "dosen",
  "laboratorium",
  "publikasi",
  "jurnal",
  "kolaborasi",
  "programDesa",
  "kemitraan",
  "kegiatan",
  "himpunan",
  "beasiswa",
  "prestasi",
  "alumni",
  "news",
  "cta",
]);
export type BlockType = z.infer<typeof BlockTypeSchema>;

export const AnchorSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "Jangkar hanya huruf kecil, angka, dan tanda hubung." });

const variant = <T extends BlockType, D extends z.ZodTypeAny>(type: T, data: D) =>
  z.object({
    id: z.string().uuid().optional(),
    type: z.literal(type),
    data,
    isVisible: z.boolean().default(true),
    anchor: AnchorSchema.optional(),
  });

export const BlockSchema = z.discriminatedUnion("type", [
  variant("heading", HeadingBlockSchema),
  variant("richText", RichTextBlockSchema),
  variant("image", ImageBlockSchema),
  variant("video", VideoBlockSchema),
  variant("button", ButtonBlockSchema),
  variant("divider", DividerBlockSchema),
  variant("spacer", SpacerBlockSchema),
  variant("accordion", AccordionBlockSchema),
  variant("table", TableBlockSchema),
  variant("embed", EmbedBlockSchema),
  variant("gallery", GalleryBlockSchema),
  variant("html", HtmlBlockSchema),
  variant("hero", HeroBlockSchema),
  variant("marquee", MarqueeBlockSchema),
  variant("stats", StatsBlockSchema),
  variant("about", AboutBlockSchema),
  variant("programs", ProgramsBlockSchema),
  variant("research", ResearchBlockSchema),
  variant("community", CommunityBlockSchema),
  variant("studentLife", StudentLifeBlockSchema),
  variant("timeline", TimelineBlockSchema),
  variant("visiMisi", VisiMisiBlockSchema),
  variant("struktur", StrukturBlockSchema),
  variant("quote", QuoteBlockSchema),
  variant("kurikulum", KurikulumBlockSchema),
  variant("kalender", KalenderBlockSchema),
  variant("dosen", DosenBlockSchema),
  variant("laboratorium", LaboratoriumBlockSchema),
  variant("publikasi", PublikasiBlockSchema),
  variant("jurnal", JurnalBlockSchema),
  variant("kolaborasi", KolaborasiBlockSchema),
  variant("programDesa", ProgramDesaBlockSchema),
  variant("kemitraan", KemitraanBlockSchema),
  variant("kegiatan", KegiatanBlockSchema),
  variant("himpunan", HimpunanBlockSchema),
  variant("beasiswa", BeasiswaBlockSchema),
  variant("prestasi", PrestasiBlockSchema),
  variant("alumni", AlumniBlockSchema),
  variant("news", NewsBlockSchema),
  variant("cta", CtaBlockSchema),
]);
export type Block = z.infer<typeof BlockSchema>;

export const BlocksSchema = z.array(BlockSchema).max(200);
