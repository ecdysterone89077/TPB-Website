import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import type { RichText } from "@tpb/contracts";

const ToolbarButton = ({ active, onClick, children, label }: { active?: boolean; onClick: () => void; children: React.ReactNode; label: string }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label} className={`rounded px-2.5 py-1 text-sm font-bold ${active ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}>{children}</button>
);

export function RichTextEditor({ value, onChange }: { value: RichText; onChange: (doc: RichText) => void }) {
  const editor = useEditor({
    extensions: [StarterKit, Underline, Link.configure({ openOnClick: false, autolink: false, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } })],
    content: value,
    onUpdate: ({ editor: instance }) => onChange(instance.getJSON() as RichText),
    editorProps: { attributes: { class: "rich-text min-h-[140px] rounded-b-lg bg-white px-4 py-3 outline-none" } },
  });

  if (!editor) return <p className="text-sm text-slate-500">Memuat editor…</p>;

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Alamat tautan (https://… atau /halaman atau #anchor)", previous ?? "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (trimmed === "" || trimmed === "https://") { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  };

  return (
    <div className="rounded-lg border border-slate-300">
      <div className="flex flex-wrap gap-1 rounded-t-lg border-b border-slate-200 bg-slate-50 p-1.5">
        <ToolbarButton label="Tebal" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolbarButton>
        <ToolbarButton label="Miring" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolbarButton>
        <ToolbarButton label="Garis bawah" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></ToolbarButton>
        <ToolbarButton label="Judul besar" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
        <ToolbarButton label="Judul kecil" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>
        <ToolbarButton label="Daftar butir" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>• Daftar</ToolbarButton>
        <ToolbarButton label="Daftar nomor" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. Daftar</ToolbarButton>
        <ToolbarButton label="Kutipan" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</ToolbarButton>
        <ToolbarButton label="Tautan" active={editor.isActive("link")} onClick={setLink}>🔗</ToolbarButton>
        <ToolbarButton label="Hapus format" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>⌫</ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
