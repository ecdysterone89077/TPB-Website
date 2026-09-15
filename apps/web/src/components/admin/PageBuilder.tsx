import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BlockSchema, SiteBundleSchema, type AdminUser, type Block, type BlockType } from "@tpb/contracts";
import { api } from "../../lib/api";
import { resetAnchorCache } from "../../lib/anchors";
import { BlockRenderer } from "../public/Blocks";
import { bundleFileName, bundlePreview, missingBundleMedia } from "./contentBundle";
import { GROUP_ORDER, BLOCK_SPECS, blockLabel } from "./builder/specs";
import type { FieldSpec } from "./builder/specs";
import { FieldInput, ListObject, ListText } from "./builder/fields";
import { RichTextEditor } from "./builder/RichTextEditor";
import { humanizeServerError, validateBlocks } from "./builder/validation";

type AdminPageData = Awaited<ReturnType<typeof api.getAdminPage>>;

const newBlock = (type: BlockType): Block => BlockSchema.parse({ type, data: BLOCK_SPECS[type].defaults() }) as Block;

const spanClass = (field: FieldSpec) => (field.kind === "textarea" || field.kind === "listText" || field.kind === "listObject" || field.kind === "richText" || field.kind === "html" || field.kind === "image" || field.kind === "custom" ? "md:col-span-2" : "");

function CustomField({ field, value, onChange }: { field: FieldSpec; value: unknown; onChange: (value: unknown) => void }) {
  if (field.custom === "arrayText") {
    return <ListText spec={{ key: field.key, label: field.label, kind: "listText", itemLabel: "Teks" }} value={value} onChange={onChange} />;
  }
  if (field.custom === "arrayMetrics") {
    return (
      <ListObject
        spec={{
          key: field.key,
          label: field.label,
          kind: "listObject",
          itemLabel: "Angka",
          itemFields: [
            { key: "value", label: "Angka", kind: "number" },
            { key: "suffix", label: "Akhiran (mis. +, %)", kind: "text" },
            { key: "label", label: "Keterangan", kind: "text" },
          ],
          defaultItem: () => ({ value: 0, suffix: "+", label: "Keterangan" }),
        }}
        value={value}
        onChange={onChange}
      />
    );
  }
  return <FieldInput spec={field} value={value} onChange={onChange} />;
}

function BlockForm({ block, onChange }: { block: Block; onChange: (next: Block) => void }) {
  const spec = BLOCK_SPECS[block.type];
  const isWholeData = Array.isArray(block.data) || (spec.fields.length === 1 && spec.fields[0].custom === "table");
  const data = (isWholeData ? {} : block.data) as Record<string, unknown>;
  const setField = (key: string, value: unknown) => onChange({ ...block, data: { ...data, [key]: value } } as Block);
  const setWhole = (value: unknown) => onChange({ ...block, data: value } as Block);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {spec.fields.map((field) => (
        <div key={field.key} className={spanClass(field)}>
          <label className="mb-1 block text-xs font-semibold text-slate-600">{field.label}</label>
          {field.kind === "richText" ? (
            <RichTextEditor value={data[field.key] as never} onChange={(doc) => setField(field.key, doc)} />
          ) : field.kind === "custom" ? (
            <CustomField field={field} value={isWholeData ? block.data : data[field.key]} onChange={isWholeData ? setWhole : (value) => setField(field.key, value)} />
          ) : (
            <FieldInput spec={field} value={data[field.key]} onChange={(value) => setField(field.key, value)} />
          )}
          {field.hint && field.kind !== "html" && field.kind !== "video" && <p className="mt-1 text-xs text-slate-500">{field.hint}</p>}
        </div>
      ))}
    </div>
  );
}

function SortableBlock({ block, index, total, expanded, hasError, onToggle, onMove, onDuplicate, onRemove, onToggleVisible, onChange }: {
  block: Block;
  index: number;
  total: number;
  expanded: boolean;
  hasError: boolean;
  onToggle: () => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onToggleVisible: () => void;
  onChange: (next: Block) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id ?? `blok-${index}` });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const spec = BLOCK_SPECS[block.type];
  return (
    <div ref={setNodeRef} style={style} className={`rounded-2xl border bg-white shadow-sm ${hasError ? "border-red-300" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button {...attributes} {...listeners} className="cursor-grab rounded px-1 text-slate-400" aria-label="Geser untuk mengurutkan" title="Geser / tarik untuk mengurutkan">⠿</button>
        <span className="text-lg">{spec.icon}</span>
        <button onClick={onToggle} className="flex-1 text-left text-sm font-bold text-slate-800">{spec.label}<span className="ml-2 text-xs font-normal text-slate-400">{block.anchor ? `#${block.anchor}` : ""}</span></button>
        <div className="flex items-center gap-1">
          <button onClick={onToggleVisible} className="button-secondary" title={block.isVisible ? "Sembunyikan dari situs" : "Tampilkan di situs"} aria-label="Sembunyikan/tampilkan">{block.isVisible ? "👁" : "🚫"}</button>
          <button onClick={() => onMove(-1)} disabled={index === 0} className="button-secondary disabled:opacity-30" aria-label="Naik">↑</button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="button-secondary disabled:opacity-30" aria-label="Turun">↓</button>
          <button onClick={onDuplicate} className="button-secondary" aria-label="Duplikat">⧉</button>
          <button onClick={onRemove} className="button-danger" aria-label="Hapus blok">✕</button>
        </div>
      </div>
      {expanded && (
        <div className="space-y-3 border-t border-slate-100 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Nama jangkar / link (opsional)</label>
              <input className="admin-input w-full" placeholder="mis. dosen" value={block.anchor ?? ""} onChange={(event) => { const normalized = event.target.value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""); onChange({ ...block, anchor: normalized === "" ? undefined : normalized } as Block); }} />
              <p className="mt-1 text-xs text-slate-500">Dipakai sebagai tujuan tautan (mis. /beranda#dosen).</p>
            </div>
          </div>
          <BlockForm block={block} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

function Palette({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (type: BlockType) => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[105] grid place-items-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Tambah bagian baru</h3>
          <button onClick={onClose} className="button-secondary">Tutup</button>
        </div>
        {GROUP_ORDER.map((group) => {
          const entries = (Object.entries(BLOCK_SPECS) as [BlockType, (typeof BLOCK_SPECS)[BlockType]][]).filter(([, spec]) => spec.group === group);
          if (!entries.length) return null;
          return (
            <div key={group} className="mt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{group}</h4>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map(([type, spec]) => (
                  <button key={type} onClick={() => { onAdd(type); onClose(); }} className="rounded-xl border border-slate-200 p-3 text-left hover:border-slate-400 hover:bg-slate-50">
                    <span className="text-xl">{spec.icon}</span>
                    <span className="mt-1 block text-sm font-bold text-slate-800">{spec.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{spec.description}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PageBuilder({ user }: { user: AdminUser }) {
  const [pages, setPages] = useState<Awaited<ReturnType<typeof api.getAdminPages>>["pages"]>([]);
  const [page, setPage] = useState<AdminPageData | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [preview, setPreview] = useState(false);
  const [meta, setMeta] = useState({ title: "", slug: "", seoTitle: "", seoDescription: "" });
  const [revisions, setRevisions] = useState<{ id: string; createdAt: string }[] | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const loadPages = useCallback(async () => {
    const collected: Awaited<ReturnType<typeof api.getAdminPages>>["pages"] = [];
    let offset = 0;
    for (let index = 0; index < 10; index++) {
      const result = await api.getAdminPages({ limit: 100, offset });
      collected.push(...result.pages);
      if (!result.pagination.hasMore) break;
      offset += result.pagination.limit;
    }
    setPages(collected);
    return collected;
  }, []);

  const openPage = useCallback(async (id: string) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const data = await api.getAdminPage(id);
      setPage(data);
      setBlocks(data.blocks);
      setMeta({ title: data.title, slug: data.slug, seoTitle: data.seoTitle ?? "", seoDescription: data.seoDescription ?? "" });
      setDirty(false);
      setExpandedKey(data.blocks[0]?.id ?? "blok-0");
    } catch (e: any) {
      setError(e?.message ?? "Gagal memuat halaman.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const list = await loadPages();
        if (list.length) await openPage(list[0].id);
        else setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "Gagal memuat daftar halaman.");
        setLoading(false);
      }
    })();
  }, [loadPages, openPage]);

  const updateBlock = (index: number, next: Block) => {
    setBlocks((current) => current.map((block, i) => (i === index ? next : block)));
    setDirty(true);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex((block, index) => (block.id ?? `blok-${index}`) === active.id);
    const to = blocks.findIndex((block, index) => (block.id ?? `blok-${index}`) === over.id);
    if (from < 0 || to < 0) return;
    setBlocks(arrayMove(blocks, from, to));
    setDirty(true);
  };

  const blockKeyAt = (block: Block, index: number) => block.id ?? `blok-${index}`;

  const validation = useMemo(() => validateBlocks(blocks), [blocks]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const save = async (): Promise<boolean> => {
    if (!page) return false;
    if (!validation.ok) {
      setError(`Periksa dulu: ${validation.messages.join(" | ")}`);
      return false;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const metaPage = await api.updatePage(page.id, { title: meta.title, slug: meta.slug, seoTitle: meta.seoTitle, seoDescription: meta.seoDescription, ogImage: page.ogImage });
      const saved = await api.savePageBlocks(page.id, blocks);
      setBlocks(saved);
      setPage({ ...metaPage, blocks: saved });
      setDirty(false);
      setNotice("Draf tersimpan. Klik \"Terbitkan\" agar tampil di situs.");
      await loadPages();
      return true;
    } catch (e: any) {
      setError(humanizeServerError(e?.message ?? "Gagal menyimpan.", blocks));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!page) return;
    if (dirty || !validation.ok) {
      const saved = await save();
      if (!saved) return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.publishPage(page.id);
      resetAnchorCache();
      setPage((current) => (current ? { ...current, status: "published" } : current));
      setNotice("Halaman diterbitkan — perubahan sudah tampil di situs.");
      await loadPages();
    } catch (e: any) {
      setError(e?.message ?? "Gagal menerbitkan.");
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    if (!page) return;
    setBusy(true);
    setError("");
    try {
      await api.unpublishPage(page.id);
      resetAnchorCache();
      setPage({ ...page, status: "draft" });
      setNotice("Halaman disembunyikan dari situs (draft).");
      await loadPages();
    } catch (e: any) {
      setError(e?.message ?? "Gagal menyembunyikan halaman.");
    } finally {
      setBusy(false);
    }
  };

  const createPage = async () => {
    const title = window.prompt("Judul halaman baru (mis. Profil Prodi)");
    if (!title?.trim()) return;
    const slug = window.prompt("Alamat halaman (huruf kecil, tanpa spasi). Contoh: profil", title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")) ?? "";
    if (!slug.trim()) return;
    setBusy(true);
    setError("");
    try {
      const created = await api.createPage({ title: title.trim(), slug: slug.trim() });
      await loadPages();
      await openPage(created.id);
      setNotice("Halaman dibuat. Tambahkan bagian lalu terbitkan.");
    } catch (e: any) {
      setError(e?.message ?? "Gagal membuat halaman.");
    } finally {
      setBusy(false);
    }
  };

  const deletePage = async () => {
    if (!page) return;
    if (!window.confirm(`Hapus halaman "${page.title}" beserta seluruh isinya?`)) return;
    setBusy(true);
    try {
      await api.deletePage(page.id);
      resetAnchorCache();
      const list = await loadPages();
      if (list.length) await openPage(list[0].id);
      else setPage(null);
      setNotice("Halaman dihapus.");
    } catch (e: any) {
      setError(e?.message ?? "Gagal menghapus halaman.");
    } finally {
      setBusy(false);
    }
  };

  const openRevisions = async () => {
    if (!page) return;
    try {
      const r = await api.listPageRevisions(page.id);
      setRevisions(r.revisions);
    } catch (e: any) {
      setError(e?.message ?? "Gagal memuat riwayat.");
    }
  };

  const restore = async (revisionId: string) => {
    if (!page || !window.confirm("Pulihkan versi ini? Halaman akan kembali berstatus draf.")) return;
    setBusy(true);
    try {
      const restored = await api.restoreRevision(page.id, revisionId);
      resetAnchorCache();
      setPage(restored);
      setBlocks(restored.blocks);
      setMeta({ title: restored.title, slug: restored.slug, seoTitle: restored.seoTitle ?? "", seoDescription: restored.seoDescription ?? "" });
      setRevisions(null);
      setDirty(false);
      setExpandedKey(restored.blocks[0]?.id ?? null);
      setNotice("Versi lama dipulihkan (status draf). Periksa lalu terbitkan kembali.");
    } catch (e: any) {
      setError(e?.message ?? "Gagal memulihkan versi.");
    } finally {
      setBusy(false);
    }
  };

  const listAllMedia = async () => {
    const items: Awaited<ReturnType<typeof api.listMedia>>["media"] = [];
    let offset = 0;
    for (let index = 0; index < 50; index++) {
      const result = await api.listMedia({ limit: 100, offset });
      items.push(...result.media);
      if (!result.pagination.hasMore) break;
      offset += result.pagination.limit;
    }
    return items;
  };

  const exportContent = async () => {
    if (dirty && !window.confirm("Ada perubahan belum disimpan yang tidak ikut diekspor. Lanjutkan?")) return;
    setError("");
    setNotice("");
    setExportBusy(true);
    try {
      const data = await api.exportContent();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = bundleFileName(new Date());
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`Konten diekspor: ${link.download}`);
    } catch (e: any) {
      setError(e?.message ?? "Gagal mengekspor konten.");
    } finally {
      setExportBusy(false);
    }
  };

  const importContent = async () => {
    if (!importFile) return;
    setError("");
    setNotice("");
    if (importFile.size > 10 * 1024 * 1024) {
      setError("Ukuran berkas melebihi 10 MB. Pisahkan konten lalu impor bertahap.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await importFile.text());
    } catch {
      setError("File bukan JSON yang valid.");
      return;
    }
    let result: ReturnType<typeof SiteBundleSchema.safeParse>;
    try {
      result = SiteBundleSchema.safeParse(parsed);
    } catch {
      setError("Bundel tidak dapat dibaca (struktur terlalu dalam).");
      return;
    }
    if (!result.success) {
      const issue = result.error.issues[0];
      setError(`Bundel tidak valid: ${issue ? `${issue.path.join(".") || "(root)"} — ${issue.message}` : "periksa kembali file."}`);
      return;
    }
    try {
      setImportBusy(true);
      const media = await listAllMedia();
      const missing = missingBundleMedia(result.data.media, media.map((item) => item.url));
      const preview = bundlePreview(result.data, pages.map((item) => item.slug));
      const lines = [
        `Impor konten dari "${importFile.name}"?`,
        ...(dirty ? ["- Peringatan: perubahan yang belum disimpan akan hilang."] : []),
        `- ${preview.pages} halaman (${preview.newPages} baru), ${preview.posts} berita.`,
        `- Menu navigasi diganti seluruhnya (${result.data.nav.length} menu utama).`,
        result.data.settings ? "- Pengaturan situs akan ditimpa." : "- Pengaturan situs tidak ikut (bundel tanpa settings).",
        missing.length
          ? `- ${missing.length} media belum terdaftar di pustaka: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", …" : ""}.`
          : "- Semua media sudah terdaftar di pustaka.",
        "Halaman, blok, dan berita dengan slug sama akan ditimpa. Lanjutkan?",
      ];
      if (!window.confirm(lines.join("\n"))) {
        setNotice("Impor dibatalkan.");
        return;
      }
      const summary = await api.importContent(result.data);
      resetAnchorCache();
      const refreshed = await loadPages();
      const target = refreshed.find((item) => item.id === page?.id) ?? refreshed[0];
      if (target) await openPage(target.id);
      setImportFile(null);
      if (fileInput.current) fileInput.current.value = "";
      const missingSummary = summary.mediaMissing.length
        ? ` ${summary.mediaMissing.length} media belum ada: ${summary.mediaMissing.slice(0, 5).join(", ")}${summary.mediaMissing.length > 5 ? ", …" : ""}.`
        : "";
      setNotice(`Impor selesai: ${summary.pagesCreated} halaman baru, ${summary.pagesUpdated} halaman diperbarui, ${summary.postsCreated} berita baru, ${summary.postsUpdated} berita diperbarui, ${summary.navUpdated} menu, ${summary.settingsUpdated} pengaturan.${missingSummary}`);
    } catch (e: any) {
      setError(e?.message ?? "Gagal mengimpor konten.");
    } finally {
      setImportBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Memuat halaman…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Konten Halaman</h1>
        <div className="flex flex-wrap gap-2">
          {user.role === "ADMIN" && (
            <>
              <button onClick={exportContent} disabled={exportBusy} className="button-secondary disabled:opacity-50">{exportBusy ? "Mengekspor…" : "Ekspor konten"}</button>
              <button onClick={() => fileInput.current?.click()} className="button-secondary">Impor konten</button>
              <input ref={fileInput} type="file" accept="application/json,.json" aria-label="File bundel konten" className="hidden" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} />
              {importFile && <button onClick={importContent} disabled={importBusy} className="button-primary disabled:opacity-50">{importBusy ? "Mengimpor…" : `Terapkan impor (${importFile.name})`}</button>}
              {importFile && <button onClick={() => { setImportFile(null); setNotice(""); if (fileInput.current) fileInput.current.value = ""; }} className="button-secondary">Batal impor</button>}
            </>
          )}
          <button onClick={createPage} className="button-secondary">+ Halaman baru</button>
          {page && <button onClick={deletePage} className="button-danger">Hapus halaman</button>}
        </div>
      </div>

      {pages.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {pages.map((item) => (
            <button key={item.id} onClick={() => { if (dirty && !window.confirm("Ada perubahan belum disimpan. Pindah halaman?")) return; void openPage(item.id); }} className={`rounded-full px-4 py-2 text-sm font-semibold ${page?.id === item.id ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>
              {item.title} {item.status === "draft" ? "· draf" : ""}
            </button>
          ))}
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

      {!page ? (
        <div className="rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-sm">
          Belum ada halaman. Klik <b>+ Halaman baru</b> untuk mulai (mis. “Beranda”).
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Judul halaman</label>
                <input className="admin-input w-full" value={meta.title} onChange={(event) => { setMeta({ ...meta, title: event.target.value }); setDirty(true); }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Alamat halaman (slug)</label>
                <input className="admin-input w-full" value={meta.slug} onChange={(event) => { setMeta({ ...meta, slug: event.target.value }); setDirty(true); }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Judul untuk Google (opsional)</label>
                <input className="admin-input w-full" value={meta.seoTitle} onChange={(event) => { setMeta({ ...meta, seoTitle: event.target.value }); setDirty(true); }} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Deskripsi untuk Google (opsional)</label>
                <input className="admin-input w-full" value={meta.seoDescription} onChange={(event) => { setMeta({ ...meta, seoDescription: event.target.value }); setDirty(true); }} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${page.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{page.status === "published" ? "Tayang di situs" : "Draf (belum tayang)"}</span>
              {dirty && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Ada perubahan belum disimpan</span>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPalette(true)} className="button-primary">+ Tambah bagian</button>
            <button onClick={save} disabled={busy} className="button-secondary disabled:opacity-50">{busy ? "Menyimpan…" : "Simpan draf"}</button>
            {page.status === "published"
              ? <button onClick={unpublish} disabled={busy} className="button-secondary disabled:opacity-50">Sembunyikan dari situs</button>
              : <button onClick={publish} disabled={busy} className="bg-emerald-600 px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">Terbitkan</button>}
            <button onClick={() => setPreview(true)} className="button-secondary">Pratinjau</button>
            <button onClick={openRevisions} className="button-secondary">Riwayat versi</button>
          </div>

          {blocks.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              Halaman masih kosong. Klik <b>+ Tambah bagian</b> untuk menambahkan konten.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={blocks.map((block, index) => block.id ?? `blok-${index}`)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {blocks.map((block, index) => (
                    <SortableBlock
                      key={blockKeyAt(block, index)}
                      block={block}
                      index={index}
                      total={blocks.length}
                      expanded={expandedKey === blockKeyAt(block, index)}
                      hasError={validation.errorIndexes.has(index)}
                      onToggle={() => setExpandedKey(expandedKey === blockKeyAt(block, index) ? null : blockKeyAt(block, index))}
                      onMove={(direction) => { setBlocks(arrayMove(blocks, index, index + direction)); setDirty(true); }}
                      onDuplicate={() => { const copy = BlockSchema.parse({ ...block, id: undefined }) as Block; setBlocks([...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)]); setDirty(true); }}
                      onRemove={() => { if (window.confirm(`Hapus bagian "${blockLabel(block.type)}"?`)) { setBlocks(blocks.filter((_, i) => i !== index)); setDirty(true); } }}
                      onToggleVisible={() => updateBlock(index, { ...block, isVisible: !block.isVisible } as Block)}
                      onChange={(next) => updateBlock(index, next)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </>
      )}

      <Palette open={palette} onClose={() => setPalette(false)} onAdd={(type) => { setBlocks((current) => [...current, newBlock(type)]); setDirty(true); setExpandedKey(null); }} />

      {preview && page && (
        <div className="fixed inset-0 z-[108] overflow-auto bg-slate-900/70 p-4" onClick={() => setPreview(false)}>
          <div className="mx-auto max-w-5xl rounded-2xl bg-cream" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between rounded-t-2xl bg-slate-900 px-4 py-2 text-white">
              <span className="text-sm font-bold">Pratinjau (belum terbit)</span>
              <button onClick={() => setPreview(false)} className="rounded bg-white/10 px-3 py-1 text-sm">Tutup</button>
            </div>
            <div>{blocks.filter((block) => block.isVisible).map((block, index) => <BlockRenderer key={block.id ?? `pratinjau-${index}`} block={block} onDaftar={() => {}} />)}</div>
          </div>
        </div>
      )}

      {revisions && (
        <div className="fixed inset-0 z-[108] grid place-items-center bg-slate-900/60 p-4" onClick={() => setRevisions(null)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Riwayat versi</h3>
              <button onClick={() => setRevisions(null)} className="button-secondary">Tutup</button>
            </div>
            {revisions.length === 0 ? <p className="mt-3 text-sm text-slate-500">Belum ada versi terbit.</p> : (
              <ul className="mt-3 space-y-2">
                {revisions.map((revision) => (
                  <li key={revision.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                    <span className="text-sm text-slate-700">{new Date(revision.createdAt).toLocaleString("id-ID")}</span>
                    <button onClick={() => restore(revision.id)} className="button-secondary">Pulihkan</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
