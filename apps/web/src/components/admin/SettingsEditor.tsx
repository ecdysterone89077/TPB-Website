import { useCallback, useEffect, useState } from "react";
import type { NavItemInput, SiteSettings } from "@tpb/contracts";
import { api } from "../../lib/api";
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
const area = (key: string, label: string): FieldSpec => ({ key, label, kind: "textarea" });
const link = (key: string, label: string): FieldSpec => ({ key, label, kind: "link" });
const listObj = (key: string, label: string, itemFields: FieldSpec[]): FieldSpec => ({ key, label, kind: "listObject", itemFields, itemLabel: "Tautan", defaultItem: () => ({ label: "Tautan baru", href: "#top" }) });

const BRAND_FIELDS: FieldSpec[] = [t("brand.kicker", "Teks kecil di atas nama"), t("brand.name", "Nama instansi/prodi"), t("brand.org", "Nama universitas"), { key: "brand.logoUrl", label: "Logo", kind: "image" }];
const LINK_FIELDS: FieldSpec[] = [link("pmbLink", "Tautan pendaftaran (PMB)")];
const FOOTER_FIELDS: FieldSpec[] = [
  t("footer.newsletterTitle", "Judul buletin"), t("footer.submitLabel", "Tulisan tombol kirim"), t("footer.infoTitle", "Judul info kontak"), t("footer.contact.phone", "Telepon"), link("footer.contact.phoneHref", "Tautan telepon (opsional)"), t("footer.contact.email", "Email"), t("footer.contact.address", "Alamat"), area("footer.copyright", "Teks hak cipta"), t("footer.tagline", "Tagline"),
  link("footer.socials.facebook", "Facebook"), link("footer.socials.twitter", "Twitter/X"), link("footer.socials.youtube", "YouTube"), link("footer.socials.linkedin", "LinkedIn"),
  t("footer.quickLinksTitle", "Judul tautan cepat"), listObj("footer.quickLinks", "Tautan cepat", [t("label", "Tulisan"), link("href", "Tautan")]),
];

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
        <input className="admin-input flex-1" value={node.href} placeholder="/halaman atau https://..." onChange={(event) => updateNode([...path, index], { href: event.target.value })} />
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
      <p className="mt-2 text-xs text-slate-500">Contoh tautan: <code>/</code> (beranda), <code>/profil</code>, <code>/beranda#dosen</code>, atau <code>https://…</code>. Maksimal 3 tingkat.</p>
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [loadedSettings, loadedNav] = await Promise.all([api.getSettings(), api.getNav()]);
      setSettings(loadedSettings);
      setNav(loadedNav);
    } catch (e: any) {
      setError(e?.message ?? "Gagal memuat pengaturan.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!settings) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await api.saveSettings(settings);
      const savedNav = await api.saveNav(nav);
      setSettings(saved);
      setNav(savedNav);
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
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan Situs</h1>
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
      {fields.map((field) => (
        <div key={field.key} className={field.kind === "listObject" || field.kind === "textarea" || field.kind === "image" ? "md:col-span-2" : ""}>
          <label className="mb-1 block text-xs font-semibold text-slate-600">{field.label}</label>
          <FieldInput spec={field} value={getIn(data, field.key)} onChange={(value) => setSettings(setIn(structuredClone(data), field.key, value) as unknown as SiteSettings)} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan Situs</h1>
        <div className="flex gap-2">
          <button onClick={load} className="button-secondary">Muat ulang</button>
          <button onClick={save} disabled={busy} className="button-primary disabled:opacity-50">{busy ? "Menyimpan…" : "Simpan pengaturan"}</button>
        </div>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold text-slate-900">Identitas & Pendaftaran</h2>
        {renderFields([...BRAND_FIELDS, ...LINK_FIELDS])}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold text-slate-900">Menu Navigasi</h2>
        <NavEditor items={nav} onChange={setNav} />
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold text-slate-900">Footer & Kontak</h2>
        {renderFields(FOOTER_FIELDS, 3)}
      </section>
    </div>
  );
}
