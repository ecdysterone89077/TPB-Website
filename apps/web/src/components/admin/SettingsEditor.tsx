import { useCallback, useEffect, useRef, useState } from "react";
import { isSafeHref, type Block, type NavItemInput, type SiteSettings } from "@tpb/contracts";
import { api } from "../../lib/api";
import { HOME_SLUG } from "../../lib/router";
import { resolveSystemTexts, systemTextsOverrides } from "../../lib/systemTexts";
import { anchorChoices, buildNavHref, emptyNavLink, parseNavHref, type NavLinkMode, type NavLinkValue } from "./navLink";
import type { FieldSpec } from "./builder/specs";
import { FieldInput } from "./builder/fields";

const getIn = (obj: unknown, path: string): unknown => path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), obj);
const setIn = (obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> => {
  const [head, ...rest] = path.split(".");
  if (!rest.length) return { ...obj, [head]: value };
  const child = (obj[head] as Record<string, unknown> | undefined) ?? {};
  return { ...obj, [head]: setIn(child, rest.join("."), value) };
};

const t = (key: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, label, kind: "text", ...extra });
const area = (key: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, label, kind: "textarea", ...extra });
const link = (key: string, label: string): FieldSpec => ({ key, label, kind: "link" });
const listObj = (key: string, label: string, itemFields: FieldSpec[]): FieldSpec => ({ key, label, kind: "listObject", itemFields, itemLabel: "Tautan", defaultItem: () => ({ label: "Tautan baru", href: "#top" }) });

const BRAND_FIELDS: FieldSpec[] = [t("brand.kicker", "Teks kecil di atas nama"), t("brand.name", "Nama instansi/prodi"), t("brand.org", "Nama universitas"), { key: "brand.logoUrl", label: "Logo", kind: "image" }];
const LINK_FIELDS: FieldSpec[] = [link("pmbLink", "Tautan pendaftaran (PMB)")];
const FOOTER_FIELDS: FieldSpec[] = [
  t("footer.newsletterTitle", "Judul buletin"), t("footer.submitLabel", "Tulisan tombol kirim"), t("footer.infoTitle", "Judul info kontak"), t("footer.contact.phone", "Telepon"), link("footer.contact.phoneHref", "Tautan telepon (opsional)"), t("footer.contact.email", "Email"), t("footer.contact.address", "Alamat"), area("footer.copyright", "Teks hak cipta"), t("footer.tagline", "Tagline"),
  link("footer.socials.facebook", "Facebook"), link("footer.socials.twitter", "Twitter/X"), link("footer.socials.youtube", "YouTube"), link("footer.socials.linkedin", "LinkedIn"),
  t("footer.quickLinksTitle", "Judul tautan cepat"), listObj("footer.quickLinks", "Tautan cepat", [t("label", "Tulisan"), link("href", "Tautan")]),
];
const SYSTEM_TEXT_FIELDS: FieldSpec[] = [
  t("texts.loading", "Teks layar memuat", { maxLength: 200 }),
  t("texts.notFoundTitle", "Judul halaman 404", { maxLength: 200 }),
  area("texts.notFoundBody", "Isi pesan 404", { maxLength: 500 }),
  t("texts.backLabel", "Tulisan tombol kembali", { maxLength: 80 }),
  t("texts.errorTitle", "Judul error halaman", { maxLength: 200 }),
  area("texts.errorBody", "Isi pesan error halaman", { maxLength: 500 }),
  t("texts.collectionError", "Pesan gagal memuat data", { maxLength: 300 }),
  t("texts.collectionEmpty", "Pesan saat data kosong", { maxLength: 300 }),
  t("texts.newsAllTab", "Label tab “Semua” berita", { maxLength: 80 }),
  t("texts.searchPlaceholder", "Placeholder pencarian", { maxLength: 300 }),
  t("texts.titleSuffix", "Akhiran judul situs", { maxLength: 160 }),
];
const PMB_TEXT_FIELDS: FieldSpec[] = [
  t("texts.pmb.title", "Judul modal PMB", { maxLength: 160 }),
  t("texts.pmb.namePlaceholder", "Placeholder nama", { maxLength: 160 }),
  t("texts.pmb.emailPlaceholder", "Placeholder email", { maxLength: 160 }),
  t("texts.pmb.phonePlaceholder", "Placeholder telepon/WhatsApp", { maxLength: 160 }),
  t("texts.pmb.schoolPlaceholder", "Placeholder asal sekolah", { maxLength: 160 }),
  t("texts.pmb.programPlaceholder", "Placeholder pilihan program", { maxLength: 160 }),
  t("texts.pmb.messagePlaceholder", "Placeholder pesan", { maxLength: 160 }),
  t("texts.pmb.submitLabel", "Tulisan tombol kirim", { maxLength: 80 }),
  t("texts.pmb.sendingLabel", "Tulisan saat mengirim", { maxLength: 80 }),
  t("texts.pmb.cancelLabel", "Tulisan tombol batal", { maxLength: 80 }),
  t("texts.pmb.doneTitle", "Judul pendaftaran terkirim", { maxLength: 160 }),
  t("texts.pmb.doneBody", "Pesan setelah pendaftaran terkirim", { maxLength: 300 }),
  t("texts.pmb.closeLabel", "Tulisan tombol tutup", { maxLength: 80 }),
];

export function NavLinkField({ href, onChange }: { href: string; onChange: (href: string) => void }) {
  const [value, setValue] = useState<NavLinkValue>(() => parseNavHref(href));
  const [pages, setPages] = useState<{ id: string; slug: string; title: string }[]>([]);
  const [blocksByPage, setBlocksByPage] = useState<Record<string, Block[]>>({});
  const [error, setError] = useState("");
  const [loadingAnchors, setLoadingAnchors] = useState(false);
  const lastEmitted = useRef(href);

  useEffect(() => {
    if (href === lastEmitted.current) return;
    lastEmitted.current = href;
    setValue(parseNavHref(href));
  }, [href]);

  useEffect(() => {
    let alive = true;
    api.getAdminPages({ limit: 100 })
      .then((result) => { if (alive) setPages(result.pages.map((page) => ({ id: page.id, slug: page.slug, title: page.title }))); })
      .catch((e: any) => { if (alive) setError(e?.message ?? "Gagal memuat daftar halaman."); });
    return () => { alive = false; };
  }, []);

  const pageId = pages.find((page) => page.slug === value.slug)?.id ?? "";
  useEffect(() => {
    if (!pageId || blocksByPage[pageId]) return;
    let alive = true;
    setLoadingAnchors(true);
    api.getAdminPage(pageId)
      .then((page) => { if (alive) setBlocksByPage((current) => ({ ...current, [page.id]: page.blocks })); })
      .catch((e: any) => { if (alive) setError(e?.message ?? "Gagal memuat bagian halaman."); })
      .finally(() => { if (alive) setLoadingAnchors(false); });
    return () => { alive = false; };
  }, [pageId, blocksByPage]);

  const apply = (next: NavLinkValue) => {
    lastEmitted.current = buildNavHref(next);
    setValue(next);
    onChange(lastEmitted.current);
  };
  const changeMode = (mode: NavLinkMode) => {
    if (mode === value.mode) return;
    apply(mode === "page" ? emptyNavLink() : { mode, slug: HOME_SLUG, anchor: "", value: "" });
  };

  const knownPage = pages.some((page) => page.slug === value.slug);
  const pageOptions = knownPage ? pages : [{ id: "", slug: value.slug, title: pages.length ? `${value.slug} (tidak ada di daftar)` : value.slug }, ...pages];
  const anchors = anchorChoices(blocksByPage[pageId] ?? []);
  const anchorOptions = value.anchor && !anchors.some((choice) => choice.value === value.anchor) ? [{ value: value.anchor, label: `#${value.anchor}` }, ...anchors] : anchors;
  const invalid = !isSafeHref(buildNavHref(value));

  return (
    <div className="flex min-w-[260px] flex-1 flex-wrap items-center gap-2">
      <select className="admin-input" value={value.mode} onChange={(event) => changeMode(event.target.value as NavLinkMode)} aria-label="Jenis tautan">
        <option value="page">Halaman situs</option>
        <option value="url">URL eksternal</option>
        <option value="phone">Telepon</option>
        <option value="email">Email</option>
      </select>
      {value.mode === "page" ? (
        <>
          <select className="admin-input" value={value.slug} onChange={(event) => apply({ ...value, slug: event.target.value, anchor: "" })} aria-label="Halaman">
            {pageOptions.map((page) => <option key={`${page.id}-${page.slug}`} value={page.slug}>{page.title}</option>)}
          </select>
          <select className="admin-input" value={value.anchor} onChange={(event) => apply({ ...value, anchor: event.target.value })} aria-label="Bagian halaman">
            <option value="">— tanpa bagian —</option>
            {anchorOptions.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select>
          {loadingAnchors && <span className="text-xs text-slate-500">Memuat bagian…</span>}
        </>
      ) : (
        <input
          className="admin-input flex-1"
          value={value.value}
          placeholder={value.mode === "url" ? "https://contoh.com" : value.mode === "phone" ? "+628123456789" : "nama@contoh.com"}
          onChange={(event) => apply({ ...value, value: event.target.value })}
        />
      )}
      {invalid && <span className="text-xs text-red-600">Tautan belum valid.</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

function NavEditor({ items, onChange }: { items: NavItemInput[]; onChange: (items: NavItemInput[]) => void }) {
  const updateNode = (path: number[], patch: Partial<NavItemInput>) => {
    const next = structuredClone(items) as NavItemInput[];
    let list = next;
    for (const index of path.slice(0, -1)) list = (list[index].children ??= []) as NavItemInput[];
    Object.assign(list[path[path.length - 1]], patch);
    onChange(next);
  };
  const removeNode = (path: number[]) => {
    const next = structuredClone(items) as NavItemInput[];
    let list = next;
    for (const index of path.slice(0, -1)) list = (list[index].children ??= []) as NavItemInput[];
    const target = list[path[path.length - 1]];
    if (!window.confirm(`Hapus menu "${target.label}" beserta sub-menunya?`)) return;
    list.splice(path[path.length - 1], 1);
    onChange(next);
  };
  const addNode = (path: number[] | null) => {
    const next = structuredClone(items) as NavItemInput[];
    if (path === null) next.push({ label: "Menu baru", href: "/", openInNewTab: false });
    else {
      let list = next;
      for (const index of path) list = (list[index].children ??= []) as NavItemInput[];
      list.push({ label: "Sub-menu baru", href: "/", openInNewTab: false });
    }
    onChange(next);
  };
  const moveNode = (path: number[], direction: -1 | 1) => {
    const next = structuredClone(items) as NavItemInput[];
    let list = next;
    for (const index of path.slice(0, -1)) list = (list[index].children ??= []) as NavItemInput[];
    const index = path[path.length - 1];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    onChange(next);
  };
  const renderList = (list: NavItemInput[], path: number[], depth: number) => list.map((node, index) => (
    <div key={path.concat(index).join("-")} className={depth ? "ml-5 border-l border-slate-200 pl-3" : ""}>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input className="admin-input flex-1" value={node.label} placeholder="Tulisan menu" onChange={(event) => updateNode([...path, index], { label: event.target.value })} />
        <NavLinkField href={node.href} onChange={(href) => updateNode([...path, index], { href })} />
        <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={node.openInNewTab === true} onChange={(event) => updateNode([...path, index], { openInNewTab: event.target.checked })} />tab baru</label>
        <button type="button" onClick={() => moveNode([...path, index], -1)} disabled={index === 0} className="button-secondary disabled:opacity-30" aria-label="Naik">↑</button>
        <button type="button" onClick={() => moveNode([...path, index], 1)} disabled={index === list.length - 1} className="button-secondary disabled:opacity-30" aria-label="Turun">↓</button>
        {depth < 2 && <button type="button" onClick={() => addNode([...path, index])} className="button-secondary" title="Tambah sub-menu">+ sub</button>}
        <button type="button" onClick={() => removeNode([...path, index])} className="button-danger" aria-label="Hapus menu">✕</button>
      </div>
      {node.children?.length ? renderList(node.children, [...path, index], depth + 1) : null}
    </div>
  ));
  return (
    <div>
      {renderList(items, [], 0)}
      <button type="button" onClick={() => addNode(null)} className="button-secondary mt-3">+ Tambah menu</button>
      <p className="mt-2 text-xs text-slate-500">Pilih halaman dan bagiannya dari daftar; pilih URL eksternal/telepon/email untuk tautan luar. Maksimal 3 tingkat.</p>
    </div>
  );
}

export function SettingsEditor() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [nav, setNav] = useState<NavItemInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [loadedSettings, loadedNav] = await Promise.all([api.getSettings(), api.getNav()]);
      setSettings(loadedSettings ? { ...loadedSettings, texts: resolveSystemTexts(loadedSettings.texts) } : loadedSettings);
      setNav(loadedNav);
      setDirty(false);
    } catch (e: any) {
      setError(e?.message ?? "Gagal memuat pengaturan.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const updateSettings = (next: SiteSettings) => { setSettings(next); setDirty(true); };
  const updateNav = (items: NavItemInput[]) => { setNav(items); setDirty(true); };

  const save = async () => {
    if (!settings) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = { ...settings, texts: systemTextsOverrides(resolveSystemTexts(settings.texts)) };
      const saved = await api.saveSettings(payload);
      const savedNav = await api.saveNav(nav);
      setSettings({ ...saved, texts: resolveSystemTexts(saved.texts) });
      setNav(savedNav);
      setDirty(false);
      setNotice("Pengaturan dan menu tersimpan — langsung berlaku di situs.");
    } catch (e: any) {
      setError(e?.message ?? "Gagal menyimpan pengaturan.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Memuat pengaturan…</p>;
  if (!settings) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan Tampilan</h1>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-sm">
          Pengaturan global (brand, kontak, menu) belum ada di database. Muat data dari halaman lama dengan <code>pnpm content:migrate:write</code> atau isi manual.
          <div className="mt-3"><button onClick={load} className="button-secondary">Muat ulang</button></div>
        </div>
      </div>
    );
  }

  const data = settings as unknown as Record<string, unknown>;
  const renderFields = (fields: FieldSpec[], columns = 2) => (
    <div className={`grid gap-3 ${columns === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      {fields.map((field) => {
        const fieldId = field.kind === "listObject" ? undefined : `setting-${field.key}`;
        return (
          <div key={field.key} className={field.kind === "listObject" || field.kind === "textarea" || field.kind === "image" ? "md:col-span-2" : ""}>
            <label htmlFor={fieldId} className="mb-1 block text-xs font-semibold text-slate-600">{field.label}</label>
            <FieldInput id={fieldId} spec={field} value={getIn(data, field.key)} onChange={(value) => updateSettings(setIn(structuredClone(data), field.key, value) as unknown as SiteSettings)} />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan Tampilan</h1>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Ada perubahan belum disimpan</span>}
          <button onClick={load} className="button-secondary">Muat ulang</button>
          <button onClick={save} disabled={busy} className="button-primary disabled:opacity-50">{busy ? "Menyimpan…" : "Simpan pengaturan"}</button>
        </div>
      </div>
      <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        Semua yang tampil di situs diatur di sini: nama dan logo, menu, footer, serta teks sistem. Setelah mengubah, klik <b>Simpan pengaturan</b>.
      </p>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold text-slate-900">Identitas & Pendaftaran</h2>
        {renderFields([...BRAND_FIELDS, ...LINK_FIELDS])}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold text-slate-900">Menu Navigasi</h2>
        <NavEditor items={nav} onChange={updateNav} />
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold text-slate-900">Footer & Kontak</h2>
        {renderFields(FOOTER_FIELDS, 3)}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-bold text-slate-900">Teks Sistem</h2>
        <p className="mb-4 text-xs text-slate-500">Nilai bawaan situs sudah terisi sebagai awalan. Ubah yang perlu saja; kosongkan kolom untuk kembali ke teks bawaan. Perubahan langsung berlaku setelah disimpan.</p>
        {renderFields(SYSTEM_TEXT_FIELDS)}
        <h3 className="mb-3 mt-6 font-semibold text-slate-800">Modal PMB</h3>
        {renderFields(PMB_TEXT_FIELDS)}
      </section>
    </div>
  );
}
