import type { BlockType, RichText } from "@tpb/contracts";

export type FieldKind = "text" | "textarea" | "number" | "select" | "boolean" | "image" | "link" | "video" | "listText" | "listObject" | "richText" | "html" | "custom";

export type FieldSpec = {
  key: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  itemLabel?: string;
  itemFields?: FieldSpec[];
  defaultItem?: () => Record<string, unknown>;
  custom?: "table" | "arrayText" | "arrayMetrics";
};

export type BlockSpec = {
  label: string;
  icon: string;
  group: string;
  description: string;
  fields: FieldSpec[];
  defaults: () => unknown;
};

const t = (key: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, label, kind: "text", ...extra });
const area = (key: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, label, kind: "textarea", ...extra });
const num = (key: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, label, kind: "number", ...extra });
const img = (key: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, label, kind: "image", ...extra });
const link = (key: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, label, kind: "link", ...extra });
const listText = (key: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, label, kind: "listText", ...extra });
const listObj = (key: string, label: string, itemFields: FieldSpec[], extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, label, kind: "listObject", itemFields, ...extra });
const select = (key: string, label: string, options: { value: string; label: string }[], extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, label, kind: "select", options, ...extra });
const flag = (key: string, label: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({ key, label, kind: "boolean", ...extra });

const kickerTitle = [t("kicker", "Label kecil (kicker)"), t("title", "Judul bagian")];
const metricFields = [t("v", "Angka / nilai"), t("l", "Keterangan")];
const cardFields = [t("tag", "Label kecil"), t("title", "Judul kartu"), area("body", "Isi kartu")];
const photoCardFields = [t("name", "Nama"), t("field", "Bidang / keterangan"), img("photo", "Foto (opsional)"), listText("details", "Detail (opsional)", { itemLabel: "Detail" })];
const emptyDoc = (): RichText => ({ type: "doc", content: [{ type: "paragraph" }] });

export const BLOCK_SPECS: Record<BlockType, BlockSpec> = {
  heading: {
    label: "Judul", icon: "🅷", group: "Teks & Media", description: "Judul besar untuk memisahkan bagian.",
    fields: [t("text", "Teks judul"), select("level", "Ukuran", [{ value: "2", label: "Besar" }, { value: "3", label: "Sedang" }, { value: "4", label: "Kecil" }]), select("align", "Perataan", [{ value: "left", label: "Kiri" }, { value: "center", label: "Tengah" }])],
    defaults: () => ({ text: "Judul baru", level: 2, align: "left" }),
  },
  richText: {
    label: "Teks bebas", icon: "📝", group: "Teks & Media", description: "Tulisan panjang dengan tebal, miring, daftar, dan tautan.",
    fields: [{ key: "doc", label: "Isi teks", kind: "richText" }],
    defaults: () => ({ doc: emptyDoc() }),
  },
  image: {
    label: "Gambar", icon: "🖼️", group: "Teks & Media", description: "Satu gambar dengan keterangan (opsional).",
    fields: [img("image", "Gambar"), t("alt", "Teks alternatif (aksesibilitas)"), t("caption", "Keterangan gambar"), link("link", "Tautan saat gambar diklik (opsional)")],
    defaults: () => ({ image: "", alt: "", caption: "", link: "" }),
  },
  video: {
    label: "Video", icon: "🎬", group: "Teks & Media", description: "Video YouTube/Instagram: tampil sebagai popup atau tempel langsung.",
    fields: [
      { key: "url", label: "URL video", kind: "video", hint: "Tempel tautan YouTube atau Instagram." },
      select("mode", "Cara tampil", [{ value: "popup", label: "Popup (klik untuk putar)" }, { value: "inline", label: "Tempel langsung di halaman" }]),
      img("thumb", "Gambar pratinjau (opsional)"),
      t("caption", "Keterangan (opsional)"),
    ],
    defaults: () => ({ url: "https://www.youtube.com/watch?v=", mode: "popup", thumb: "", caption: "" }),
  },
  button: {
    label: "Tombol", icon: "🔗", group: "Teks & Media", description: "Tombol dengan tautan.",
    fields: [t("label", "Tulisan tombol"), link("href", "Tautan"), select("style", "Warna", [{ value: "primary", label: "Biru tua" }, { value: "gold", label: "Emas" }, { value: "secondary", label: "Putih" }]), flag("openInNewTab", "Buka di tab baru"), select("align", "Posisi", [{ value: "left", label: "Kiri" }, { value: "center", label: "Tengah" }])],
    defaults: () => ({ label: "Klik di sini", href: "#top", style: "primary", openInNewTab: false, align: "left" }),
  },
  divider: { label: "Garis pemisah", icon: "➖", group: "Teks & Media", description: "Garis tipis pemisah bagian.", fields: [], defaults: () => ({}) },
  spacer: { label: "Jarak kosong", icon: "⬜", group: "Teks & Media", description: "Ruang kosong antar bagian.", fields: [select("size", "Ukuran", [{ value: "sm", label: "Kecil" }, { value: "md", label: "Sedang" }, { value: "lg", label: "Besar" }])], defaults: () => ({ size: "md" }) },
  accordion: {
    label: "Tanya–Jawab", icon: "❓", group: "Teks & Media", description: "Daftar pertanyaan yang bisa dibuka-tutup.",
    fields: [listObj("items", "Daftar pertanyaan", [t("title", "Pertanyaan"), area("body", "Jawaban")], { itemLabel: "Pertanyaan", defaultItem: () => ({ title: "Pertanyaan baru", body: "" }) })],
    defaults: () => ({ items: [{ title: "Pertanyaan baru", body: "" }] }),
  },
  table: {
    label: "Tabel", icon: "🧮", group: "Teks & Media", description: "Tabel sederhana (judul kolom + baris).",
    fields: [{ key: "table", label: "Isi tabel", kind: "custom", custom: "table" }],
    defaults: () => ({ headers: ["Kolom 1", "Kolom 2"], rows: [["", ""], ["", ""]] }),
  },
  embed: {
    label: "Sematkan (peta/iframe)", icon: "🗺️", group: "Teks & Media", description: "Menyematkan peta Google atau halaman lain.",
    fields: [link("url", "URL yang disematkan", { hint: "Contoh peta: https://www.google.com/maps/..." }), num("height", "Tinggi (piksel)"), t("title", "Judul (aksesibilitas)")],
    defaults: () => ({ url: "https://www.google.com/maps", height: 420, title: "Peta" }),
  },
  gallery: {
    label: "Galeri foto/video", icon: "📸", group: "Teks & Media", description: "Grid foto/video dengan popup saat diklik.",
    fields: [
      listObj("items", "Daftar media", [img("image", "Gambar / URL video"), select("kind", "Jenis", [{ value: "image", label: "Gambar" }, { value: "video", label: "Video" }]), t("title", "Judul (opsional)"), t("caption", "Keterangan (opsional)"), img("thumb", "Pratinjau video (opsional)")], { itemLabel: "Media", defaultItem: () => ({ image: "", kind: "image", title: "", caption: "", thumb: "" }) }),
      select("columns", "Jumlah kolom", [{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]),
    ],
    defaults: () => ({ items: [], columns: 3 }),
  },
  html: {
    label: "HTML kustom (lanjutan)", icon: "⚙️", group: "Lanjutan", description: "Hanya untuk yang paham HTML. Isi otomatis dibersihkan dari skrip berbahaya.",
    fields: [{ key: "code", label: "Kode HTML", kind: "html", hint: "Contoh: <p>Halo</p>" }],
    defaults: () => ({ code: "<p>Tulis di sini…</p>" }),
  },

  hero: {
    label: "Bagian pembuka (Hero)", icon: "🏠", group: "Bagian Halaman", description: "Bagian besar paling atas halaman.",
    fields: [t("badge", "Lencana kecil"), t("line1", "Judul baris 1"), t("highlight", "Judul sorotan (emas)"), t("line2", "Judul baris 3"), area("subtitle", "Kalimat pembuka"), t("primaryLabel", "Tulisan tombol utama"), link("primaryHref", "Tautan tombol utama"), t("secondaryLabel", "Tulisan tombol kedua"), link("secondaryHref", "Tautan tombol kedua"), img("image", "Gambar latar")],
    defaults: () => ({ badge: "", line1: "Selamat Datang", highlight: "di TPB", line2: "UNU Purwokerto", subtitle: "", primaryLabel: "Daftar Sekarang", primaryHref: "#pmb", secondaryLabel: "Pelajari", secondaryHref: "#profil", image: "" }),
  },
  marquee: { label: "Teks berjalan", icon: "🎞️", group: "Bagian Halaman", description: "Pita teks berjalan.", fields: [{ key: "items", label: "Daftar teks berjalan", kind: "custom", custom: "arrayText" }], defaults: () => ["Teknik Pertanian", "Biosistem"] },
  stats: { label: "Statistik angka", icon: "📊", group: "Bagian Halaman", description: "Deretan angka penting.", fields: [{ key: "stats", label: "Daftar angka", kind: "custom", custom: "arrayMetrics" }], defaults: () => [] },
  about: { label: "Tentang (gambar + poin)", icon: "🏛️", group: "Bagian Halaman", description: "Cerita singkat dengan gambar dan poin.", fields: [...kickerTitle, area("body", "Isi cerita"), t("sinceYear", "Tahun berdiri"), t("sinceNote", "Catatan tahun"), img("image", "Gambar"), listText("points", "Poin penting", { itemLabel: "Poin" })], defaults: () => ({ kicker: "", title: "Tentang Prodi", body: "", sinceYear: "2024", sinceNote: "", image: "", points: [] }) },
  programs: { label: "Kartu program", icon: "🎓", group: "Bagian Halaman", description: "Kartu-kartu program/pilar keilmuan.", fields: [...kickerTitle, t("cta", "Tulisan tombol"), listObj("cards", "Daftar kartu", [...cardFields, img("img", "Gambar kartu"), t("color", "Warna (opsional)")], { itemLabel: "Kartu", defaultItem: () => ({ tag: "", title: "Kartu baru", body: "", img: "", color: "" }) })], defaults: () => ({ kicker: "", title: "Pilar Keilmuan", cta: "Daftar", cards: [] }) },
  research: { label: "Riset (area + metrik)", icon: "🔬", group: "Bagian Halaman", description: "Area riset dan angka capaian.", fields: [...kickerTitle, area("body", "Pengantar"), listObj("areas", "Area riset", [t("no", "Nomor"), t("title", "Judul"), area("body", "Isi")], { itemLabel: "Area", defaultItem: () => ({ no: "", title: "Area baru", body: "" }) }), listObj("metrics", "Metrik", metricFields, { itemLabel: "Metrik", defaultItem: () => ({ v: "0", l: "Keterangan" }) })], defaults: () => ({ kicker: "", title: "Riset & Inovasi", body: "", areas: [], metrics: [] }) },
  community: { label: "Pengabdian (gambar + daftar)", icon: "🤝", group: "Bagian Halaman", description: "Kegiatan pengabdian masyarakat.", fields: [...kickerTitle, area("body", "Pengantar"), img("image", "Gambar"), listText("items", "Daftar kegiatan", { itemLabel: "Kegiatan" })], defaults: () => ({ kicker: "", title: "Pengabdian Masyarakat", body: "", image: "", items: [] }) },
  studentLife: { label: "Kehidupan mahasiswa (kartu)", icon: "🎒", group: "Bagian Halaman", description: "Kartu kegiatan mahasiswa.", fields: [...kickerTitle, t("cta", "Tulisan tombol"), listObj("cards", "Daftar kartu", cardFields, { itemLabel: "Kartu", defaultItem: () => ({ tag: "", title: "Kartu baru", body: "" }) })], defaults: () => ({ kicker: "", title: "Kehidupan Mahasiswa", cta: "Daftar", cards: [] }) },

  timeline: { label: "Sejarah (linimasa)", icon: "🕰️", group: "Profil & Akademik", description: "Linimasa peristiwa.", fields: [...kickerTitle, area("intro", "Pengantar"), listObj("timeline", "Peristiwa", [t("year", "Tahun"), area("text", "Keterangan")], { itemLabel: "Peristiwa", defaultItem: () => ({ year: "2024", text: "" }) })], defaults: () => ({ kicker: "", title: "Sejarah", intro: "", timeline: [] }) },
  visiMisi: { label: "Visi & Misi", icon: "🧭", group: "Profil & Akademik", description: "Visi, misi, dan tujuan.", fields: [...kickerTitle, area("visi", "Visi"), listText("misi", "Misi", { itemLabel: "Misi" }), listText("tujuan", "Tujuan (opsional)", { itemLabel: "Tujuan" })], defaults: () => ({ kicker: "", title: "Visi & Misi", visi: "", misi: [], tujuan: [] }) },
  struktur: { label: "Struktur organisasi", icon: "👥", group: "Profil & Akademik", description: "Daftar jabatan dan nama.", fields: [...kickerTitle, listObj("people", "Orang", [t("role", "Jabatan"), t("name", "Nama")], { itemLabel: "Orang", defaultItem: () => ({ role: "Jabatan", name: "Nama" }) })], defaults: () => ({ kicker: "", title: "Struktur", people: [] }) },
  quote: { label: "Sambutan / kutipan", icon: "💬", group: "Profil & Akademik", description: "Kutipan dengan foto dan nama.", fields: [...kickerTitle, img("image", "Foto"), area("quote", "Kutipan"), t("name", "Nama"), t("role", "Jabatan")], defaults: () => ({ kicker: "", title: "Sambutan", image: "", quote: "", name: "", role: "" }) },
  kurikulum: { label: "Kurikulum", icon: "📚", group: "Profil & Akademik", description: "SKS dan peminatan.", fields: [...kickerTitle, area("intro", "Pengantar"), listObj("sks", "Angka SKS", metricFields, { itemLabel: "Angka", defaultItem: () => ({ v: "144", l: "SKS" }) }), listText("clusters", "Peminatan", { itemLabel: "Peminatan" })], defaults: () => ({ kicker: "", title: "Kurikulum", intro: "", sks: [], clusters: [] }) },
  kalender: { label: "Kalender akademik", icon: "📅", group: "Profil & Akademik", description: "Jadwal kegiatan akademik.", fields: [...kickerTitle, listObj("items", "Kegiatan", [t("d", "Waktu"), area("e", "Kegiatan")], { itemLabel: "Kegiatan", defaultItem: () => ({ d: "Januari", e: "" }) })], defaults: () => ({ kicker: "", title: "Kalender Akademik", items: [] }) },
  dosen: { label: "Daftar dosen", icon: "🧑‍🏫", group: "Profil & Akademik", description: "Kartu dosen dengan foto.", fields: [...kickerTitle, area("intro", "Pengantar"), listObj("people", "Dosen", photoCardFields, { itemLabel: "Dosen", defaultItem: () => ({ name: "Nama dosen", field: "Bidang", photo: "", details: [] }) })], defaults: () => ({ kicker: "", title: "Dosen", intro: "", people: [] }) },
  laboratorium: { label: "Laboratorium", icon: "🧪", group: "Profil & Akademik", description: "Daftar laboratorium.", fields: [...kickerTitle, listObj("labs", "Laboratorium", [t("name", "Nama"), area("desc", "Keterangan")], { itemLabel: "Lab", defaultItem: () => ({ name: "Laboratorium", desc: "" }) })], defaults: () => ({ kicker: "", title: "Laboratorium", labs: [] }) },

  publikasi: { label: "Publikasi", icon: "📄", group: "Penelitian & Pengabdian", description: "Daftar publikasi ilmiah.", fields: [...kickerTitle, listObj("pubs", "Publikasi", [t("title", "Judul"), t("venue", "Jurnal/forum"), t("year", "Tahun")], { itemLabel: "Publikasi", defaultItem: () => ({ title: "Judul publikasi", venue: "", year: "2024" }) })], defaults: () => ({ kicker: "", title: "Publikasi", pubs: [] }) },
  jurnal: { label: "Jurnal (kartu)", icon: "📰", group: "Penelitian & Pengabdian", description: "Kartu jurnal/terbitan.", fields: [...kickerTitle, area("intro", "Pengantar"), listObj("cards", "Kartu jurnal", [t("title", "Judul"), area("body", "Isi"), t("note", "Catatan")], { itemLabel: "Jurnal", defaultItem: () => ({ title: "Jurnal", body: "", note: "" }) })], defaults: () => ({ kicker: "", title: "Jurnal", intro: "", cards: [] }) },
  kolaborasi: { label: "Kolaborasi / mitra", icon: "🌐", group: "Penelitian & Pengabdian", description: "Daftar mitra kolaborasi.", fields: [...kickerTitle, area("intro", "Pengantar"), listText("partners", "Mitra", { itemLabel: "Mitra" })], defaults: () => ({ kicker: "", title: "Kolaborasi", intro: "", partners: [] }) },
  programDesa: { label: "Program desa", icon: "🏘️", group: "Penelitian & Pengabdian", description: "Daftar desa binaan.", fields: [...kickerTitle, listObj("desa", "Desa", [t("name", "Nama desa"), area("body", "Kegiatan")], { itemLabel: "Desa", defaultItem: () => ({ name: "Desa", body: "" }) })], defaults: () => ({ kicker: "", title: "Program Desa", desa: [] }) },
  kemitraan: { label: "Kemitraan", icon: "🤝", group: "Penelitian & Pengabdian", description: "Daftar mitra kemitraan.", fields: [...kickerTitle, listText("mitra", "Mitra", { itemLabel: "Mitra" })], defaults: () => ({ kicker: "", title: "Kemitraan", mitra: [] }) },
  kegiatan: { label: "Kegiatan (linimasa)", icon: "📌", group: "Penelitian & Pengabdian", description: "Daftar kegiatan.", fields: [...kickerTitle, listObj("items", "Kegiatan", [t("t", "Nama kegiatan"), area("d", "Keterangan")], { itemLabel: "Kegiatan", defaultItem: () => ({ t: "Kegiatan", d: "" }) })], defaults: () => ({ kicker: "", title: "Kegiatan", items: [] }) },

  himpunan: { label: "Himpunan mahasiswa", icon: "🎪", group: "Kemahasiswaan", description: "Info himpunan dan divisi.", fields: [...kickerTitle, area("intro", "Pengantar"), listText("divisi", "Divisi", { itemLabel: "Divisi" })], defaults: () => ({ kicker: "", title: "Himpunan", intro: "", divisi: [] }) },
  beasiswa: { label: "Beasiswa", icon: "🎁", group: "Kemahasiswaan", description: "Daftar beasiswa.", fields: [...kickerTitle, listObj("items", "Beasiswa", [t("name", "Nama"), area("body", "Keterangan")], { itemLabel: "Beasiswa", defaultItem: () => ({ name: "Beasiswa", body: "" }) })], defaults: () => ({ kicker: "", title: "Beasiswa", items: [] }) },
  prestasi: { label: "Prestasi", icon: "🏆", group: "Kemahasiswaan", description: "Daftar prestasi.", fields: [...kickerTitle, listText("items", "Prestasi", { itemLabel: "Prestasi" })], defaults: () => ({ kicker: "", title: "Prestasi", items: [] }) },
  alumni: { label: "Alumni", icon: "🎓", group: "Kemahasiswaan", description: "Kutipan alumni dan statistik.", fields: [...kickerTitle, area("quote", "Kutipan"), t("name", "Nama"), t("role", "Keterangan"), listObj("stats", "Statistik", metricFields, { itemLabel: "Statistik", defaultItem: () => ({ v: "0", l: "Keterangan" }) })], defaults: () => ({ kicker: "", title: "Alumni", quote: "", name: "", role: "", stats: [] }) },

  news: { label: "Berita", icon: "🗞️", group: "Bagian Halaman", description: "Daftar berita terbaru (otomatis dari menu Berita).", fields: [...kickerTitle], defaults: () => ({ kicker: "Berita", title: "Berita Terbaru" }) },
  cta: { label: "Ajakan (CTA)", icon: "📣", group: "Bagian Halaman", description: "Blok ajakan dengan dua tombol.", fields: [t("title", "Judul"), area("body", "Kalimat"), t("primary", "Tulisan tombol utama"), t("secondary", "Tulisan tombol kedua"), link("secondaryHref", "Tautan tombol kedua")], defaults: () => ({ title: "Siap bergabung?", body: "", primary: "Daftar", secondary: "Hubungi", secondaryHref: "#kontak" }) },
};

export const GROUP_ORDER = ["Bagian Halaman", "Profil & Akademik", "Penelitian & Pengabdian", "Kemahasiswaan", "Teks & Media", "Lanjutan"];

export const specFor = (type: BlockType): BlockSpec => BLOCK_SPECS[type];

export const blockLabel = (type: BlockType): string => BLOCK_SPECS[type]?.label ?? type;
