import { useEffect, useState, type ChangeEvent } from "react";
import { DriveImage } from "../../DriveImage";
import { api } from "../../../lib/api";
import type { MediaAsset } from "@tpb/contracts";
import type { FieldSpec } from "./specs";

const asString = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

export function MediaPicker({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (url: string) => void }) {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api.listMedia({ limit: 100 });
      setMedia(r.media);
    } catch (e: any) {
      setError(e?.message ?? "Gagal memuat media.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
  }, [open]);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const asset = await api.uploadMedia(file);
      setFile(null);
      onSelect(asset.url);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Gagal mengunggah.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-900/60 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900">Pilih gambar dari pustaka</h3>
          <button onClick={onClose} className="button-secondary">Tutup</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)} className="text-sm" />
          <button onClick={upload} disabled={!file || busy} className="button-primary disabled:opacity-50">{busy ? "Mengunggah…" : "Unggah baru"}</button>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {loading ? <p className="mt-4 text-sm text-slate-500">Memuat…</p> : media.length === 0 ? <p className="mt-4 text-sm text-slate-500">Belum ada media. Unggah gambar terlebih dahulu.</p> : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {media.filter((m) => m.mimeType.startsWith("image/")).map((item) => (
              <button key={item.id} onClick={() => { onSelect(item.url); onClose(); }} className="overflow-hidden rounded-xl border border-slate-200 text-left hover:border-slate-400">
                <img src={item.url} alt={item.alt || item.filename} className="h-28 w-full object-cover" loading="lazy" />
                <span className="block truncate px-2 py-1 text-xs text-slate-600">{item.filename}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type FieldProps = { spec: FieldSpec; value: unknown; onChange: (value: unknown) => void; id?: string };

export function ListText({ spec, value, onChange }: FieldProps) {
  const items = Array.isArray(value) ? (value as string[]) : [];
  const update = (next: string[]) => onChange(next);
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input className="admin-input flex-1" value={item} placeholder={spec.itemLabel ?? "Teks"} onChange={(event) => update(items.map((v, i) => (i === index ? event.target.value : v)))} />
          <button type="button" onClick={() => update(items.map((v, i) => (i === index - 1 ? items[index] : i === index ? items[index - 1] : v)))} disabled={index === 0} className="button-secondary disabled:opacity-30" aria-label="Naik">↑</button>
          <button type="button" onClick={() => update(items.map((v, i) => (i === index + 1 ? items[index] : i === index ? items[index + 1] : v)))} disabled={index === items.length - 1} className="button-secondary disabled:opacity-30" aria-label="Turun">↓</button>
          <button type="button" onClick={() => update(items.filter((_, i) => i !== index))} className="button-danger" aria-label="Hapus">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => update([...items, ""])} className="button-secondary">+ Tambah {spec.itemLabel ?? "baris"}</button>
    </div>
  );
}

export function ListObject({ spec, value, onChange }: FieldProps) {
  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const update = (next: Record<string, unknown>[]) => onChange(next);
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">{spec.itemLabel ?? "Item"} #{index + 1}</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => update(items.map((v, i) => (i === index - 1 ? items[index] : i === index ? items[index - 1] : v)))} disabled={index === 0} className="button-secondary disabled:opacity-30" aria-label="Naik">↑</button>
              <button type="button" onClick={() => update(items.map((v, i) => (i === index + 1 ? items[index] : i === index ? items[index + 1] : v)))} disabled={index === items.length - 1} className="button-secondary disabled:opacity-30" aria-label="Turun">↓</button>
              <button type="button" onClick={() => update([...items.slice(0, index + 1), { ...item }, ...items.slice(index + 1)])} className="button-secondary" aria-label="Duplikat">⧉</button>
              <button type="button" onClick={() => update(items.filter((_, i) => i !== index))} className="button-danger" aria-label="Hapus">✕</button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(spec.itemFields ?? []).map((field) => (
              <div key={field.key} className={field.kind === "textarea" || field.kind === "listText" || field.kind === "image" ? "md:col-span-2" : ""}>
                <label className="mb-1 block text-xs font-semibold text-slate-600">{field.label}</label>
                <FieldInput spec={field} value={item[field.key]} onChange={(v) => update(items.map((x, i) => (i === index ? { ...x, [field.key]: v } : x)))} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => update([...items, spec.defaultItem ? spec.defaultItem() : {}])} className="button-secondary">+ Tambah {spec.itemLabel ?? "item"}</button>
    </div>
  );
}

function TableEditor({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
  const data = (value ?? { headers: ["Kolom 1"], rows: [[]] }) as { headers: string[]; rows: string[][] };
  const setHeader = (index: number, text: string) => onChange({ ...data, headers: data.headers.map((h, i) => (i === index ? text : h)) });
  const setCell = (rowIndex: number, colIndex: number, text: string) => onChange({ ...data, rows: data.rows.map((row, r) => (r === rowIndex ? row.map((cell, c) => (c === colIndex ? text : cell)) : row)) });
  const addColumn = () => onChange({ headers: [...data.headers, `Kolom ${data.headers.length + 1}`], rows: data.rows.map((row) => [...row, ""]) });
  const removeColumn = (index: number) => onChange({ headers: data.headers.filter((_, i) => i !== index), rows: data.rows.map((row) => row.filter((_, i) => i !== index)) });
  const addRow = () => onChange({ ...data, rows: [...data.rows, data.headers.map(() => "")] });
  const removeRow = (index: number) => onChange({ ...data, rows: data.rows.filter((_, i) => i !== index) });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {data.headers.map((header, index) => (
              <th key={index} className="p-1">
                <div className="flex gap-1">
                  <input className="admin-input w-full" value={header} onChange={(event) => setHeader(index, event.target.value)} />
                  <button type="button" onClick={() => removeColumn(index)} disabled={data.headers.length <= 1} className="button-danger disabled:opacity-30">✕</button>
                </div>
              </th>
            ))}
            <th className="p-1"><button type="button" onClick={addColumn} className="button-secondary">+ Kolom</button></th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {data.headers.map((_, colIndex) => <td key={colIndex} className="p-1"><input className="admin-input w-full" value={row[colIndex] ?? ""} onChange={(event) => setCell(rowIndex, colIndex, event.target.value)} /></td>)}
              <td className="p-1"><button type="button" onClick={() => removeRow(rowIndex)} className="button-danger">✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addRow} className="button-secondary mt-2">+ Baris</button>
    </div>
  );
}

export function FieldInput({ spec, value, onChange, id }: FieldProps) {
  const [picker, setPicker] = useState(false);

  if (spec.kind === "textarea") {
    return <textarea id={id} className="admin-textarea" rows={3} maxLength={spec.maxLength} value={asString(value)} placeholder={spec.placeholder ?? spec.hint} onChange={(event) => onChange(event.target.value)} />;
  }
  if (spec.kind === "number") {
    return <input id={id} type="number" className="admin-input" value={Number.isFinite(Number(value)) ? Number(value) : 0} onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))} />;
  }
  if (spec.kind === "boolean") {
    return <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />{spec.hint ?? "Ya"}</label>;
  }
  if (spec.kind === "select") {
    return (
      <select id={id} className="admin-input" value={asString(value)} onChange={(event) => { const raw = event.target.value; onChange(/^\d+$/.test(raw) && spec.options?.some((o) => o.value === raw) ? Number(raw) : raw); }}>
        {(spec.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  }
  if (spec.kind === "image") {
    const src = asString(value);
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input id={id} className="admin-input flex-1" value={src} placeholder="URL gambar atau /media/... " onChange={(event) => onChange(event.target.value)} />
          <button type="button" onClick={() => setPicker(true)} className="button-secondary">Pilih dari Media</button>
          {src && <button type="button" onClick={() => onChange("")} className="button-danger">Kosongkan</button>}
        </div>
        {src && <DriveImage src={src} alt="" className="h-28 w-44 rounded-lg object-cover" />}
        <MediaPicker open={picker} onClose={() => setPicker(false)} onSelect={(url) => onChange(url)} />
      </div>
    );
  }
  if (spec.kind === "video") {
    return (
      <div className="space-y-2">
        <input className="admin-input w-full" value={asString(value)} placeholder={spec.hint ?? "https://youtube.com/..."} onChange={(event) => onChange(event.target.value)} />
        <p className="text-xs text-slate-500">Contoh: https://www.youtube.com/watch?v=XXXX atau https://www.instagram.com/reel/XXXX</p>
      </div>
    );
  }
  if (spec.kind === "listText") return <ListText spec={spec} value={value} onChange={onChange} />;
  if (spec.kind === "listObject") return <ListObject spec={spec} value={value} onChange={onChange} />;
  if (spec.kind === "custom" && spec.custom === "table") return <TableEditor value={value} onChange={onChange} />;
  if (spec.kind === "html") {
    return (
      <div className="space-y-2">
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Mode lanjutan: tulis HTML sederhana. Skrip berbahaya otomatis dibuang saat disimpan.</p>
        <textarea className="admin-textarea font-mono text-xs" rows={6} value={asString(value)} onChange={(event) => onChange(event.target.value)} />
      </div>
    );
  }
  return <input id={id} className="admin-input w-full" maxLength={spec.maxLength} value={asString(value)} placeholder={spec.placeholder ?? spec.hint} onChange={(event) => onChange(event.target.value)} />;
}
