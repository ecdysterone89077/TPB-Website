import type { Block } from "@tpb/contracts";
import { About, Community, Programs, Research, Stats, StudentLife } from "./Sections";
import { CTA, News } from "./ContentSections";
import {
  AlumniSection, BeasiswaSection, DosenSection, HimpunanSection, JurnalSection, KalenderSection, KegiatanSection,
  KemitraanSection, KolaborasiSection, KurikulumSection, LaboratoriumSection, PrestasiSection, ProgramDesaSection,
  PublikasiSection, QuoteSection, StrukturSection, TimelineSection, VisiMisiSection,
} from "./DetailBlocks";

export default function HeavyBlockView({ block, onDaftar }: { block: Block; onDaftar: () => void }) {
  switch (block.type) {
    case "stats": return <Stats items={block.data} anchor={block.anchor} />;
    case "about": return <About about={block.data} anchor={block.anchor} />;
    case "programs": return <Programs programs={block.data} onDaftar={onDaftar} anchor={block.anchor} />;
    case "research": return <Research research={block.data} anchor={block.anchor} />;
    case "community": return <Community community={block.data} anchor={block.anchor} />;
    case "studentLife": return <StudentLife studentLife={block.data} onDaftar={onDaftar} anchor={block.anchor} />;
    case "timeline": return <TimelineSection data={block.data} anchor={block.anchor} />;
    case "visiMisi": return <VisiMisiSection data={block.data} anchor={block.anchor} />;
    case "struktur": return <StrukturSection data={block.data} anchor={block.anchor} />;
    case "quote": return <QuoteSection data={block.data} anchor={block.anchor} />;
    case "kurikulum": return <KurikulumSection data={block.data} anchor={block.anchor} />;
    case "kalender": return <KalenderSection data={block.data} anchor={block.anchor} />;
    case "dosen": return <DosenSection data={block.data} anchor={block.anchor} />;
    case "laboratorium": return <LaboratoriumSection data={block.data} anchor={block.anchor} />;
    case "publikasi": return <PublikasiSection data={block.data} anchor={block.anchor} />;
    case "jurnal": return <JurnalSection data={block.data} anchor={block.anchor} />;
    case "kolaborasi": return <KolaborasiSection data={block.data} anchor={block.anchor} />;
    case "programDesa": return <ProgramDesaSection data={block.data} anchor={block.anchor} />;
    case "kemitraan": return <KemitraanSection data={block.data} anchor={block.anchor} />;
    case "kegiatan": return <KegiatanSection data={block.data} anchor={block.anchor} />;
    case "himpunan": return <HimpunanSection data={block.data} anchor={block.anchor} />;
    case "beasiswa": return <BeasiswaSection data={block.data} anchor={block.anchor} />;
    case "prestasi": return <PrestasiSection data={block.data} anchor={block.anchor} />;
    case "alumni": return <AlumniSection data={block.data} anchor={block.anchor} />;
    case "news": return <News news={block.data} anchor={block.anchor} />;
    case "cta": return <CTA cta={block.data} onDaftar={onDaftar} anchor={block.anchor} />;
    default: return null;
  }
}
