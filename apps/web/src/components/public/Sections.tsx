import type { SiteContent } from "@tpb/contracts";
import { DriveImage } from "../DriveImage";
import { Band } from "./ui";

export function Stats({ items, anchor }: { items: SiteContent["stats"]; anchor?: string }) {
  return (
    <section id={anchor} className="scroll-mt-24 bg-midnight py-14 lg:py-16">
      <div className="mx-auto grid max-w-[1360px] grid-cols-2 gap-4 px-5 lg:grid-cols-4 lg:px-10">
        {items.map((item) => (
          <div key={`${item.label}-${item.value}`} className="reveal rounded-3xl border border-white/10 bg-white/5 p-6 transition duration-300 hover:border-gold/40 lg:p-7">
            <p className="font-display text-4xl font-extrabold text-gold lg:text-5xl">{item.value}<span className="text-white/85">{item.suffix}</span></p>
            <p className="mt-2 text-sm leading-snug text-white/60">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function About({ about, anchor = "profil" }: { about: SiteContent["about"]; anchor?: string }) {
  return (
    <Band id={anchor} kicker={about.kicker} title={about.title} intro={about.body} tone="cream">
      <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div className="reveal overflow-hidden rounded-[2.5rem] border border-midnight/10 bg-midnight">
          <DriveImage src={about.image} alt="" className="aspect-[4/3] h-full w-full object-cover" />
        </div>
        <div className="space-y-6">
          <div className="reveal rounded-3xl bg-gradient-to-br from-midnight to-midnight-600 p-7 text-white shadow-[0_24px_50px_-34px_rgba(14,16,68,0.8)]">
            <p className="font-display text-5xl font-extrabold text-gold">{about.sinceYear}</p>
            <p className="mt-2 text-sm text-white/70">{about.sinceNote}</p>
          </div>
          <ul className="grid gap-3">
            {about.points.map((point) => (
              <li key={point} className="reveal card card-hover flex items-start gap-3 p-5 text-sm leading-relaxed text-midnight/75">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-leaf-600/10 text-xs text-leaf-600">✦</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Band>
  );
}

export function Programs({ programs, onDaftar, anchor = "akademik" }: { programs: SiteContent["programs"]; onDaftar: () => void; anchor?: string }) {
  return (
    <Band id={anchor} tone="white" kicker={programs.kicker} title={programs.title}>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {programs.cards.map((card, index) => (
          <article key={`${card.tag}-${card.title}`} className="reveal group overflow-hidden rounded-3xl border border-midnight/10 bg-white shadow-[0_18px_40px_-32px_rgba(14,16,68,0.5)] transition duration-300 hover:-translate-y-1 hover:border-midnight/20 hover:shadow-[0_30px_60px_-34px_rgba(14,16,68,0.55)]">
            <div className="relative h-52 overflow-hidden bg-midnight/10">
              {card.img ? <DriveImage src={card.img} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /> : null}
              <span className="absolute left-4 top-4 rounded-full bg-gold px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-midnight">{card.tag}</span>
              <span aria-hidden className="absolute bottom-4 right-4 font-display text-4xl font-extrabold text-white/25">0{index + 1}</span>
            </div>
            <div className="p-6">
              <h3 className="font-display text-2xl font-bold leading-snug text-midnight">{card.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-midnight/65">{card.body}</p>
            </div>
          </article>
        ))}
      </div>
      <button onClick={onDaftar} className="mt-9 rounded-full bg-midnight px-8 py-4 text-sm font-extrabold text-white transition duration-300 hover:-translate-y-0.5 hover:bg-midnight-700">{programs.cta}</button>
    </Band>
  );
}

export function Research({ research, anchor = "penelitian" }: { research: SiteContent["research"]; anchor?: string }) {
  return (
    <Band id={anchor} kicker={research.kicker} title={research.title} intro={research.body}>
      <div className="grid gap-5 lg:grid-cols-2">
        {research.areas.map((area) => (
          <article key={area.no} className="reveal rounded-3xl border border-white/10 bg-midnight p-7 text-white shadow-[0_24px_50px_-34px_rgba(14,16,68,0.7)] transition duration-300 hover:-translate-y-1 hover:border-gold/40">
            <span className="font-mono text-sm text-gold">{area.no}</span>
            <h3 className="mt-4 font-display text-2xl font-bold leading-snug">{area.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/65">{area.body}</p>
          </article>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {research.metrics.map((metric) => (
          <div key={`${metric.v}-${metric.l}`} className="reveal rounded-2xl border border-midnight/10 bg-white p-5 transition duration-300 hover:-translate-y-0.5 hover:border-leaf-600/40">
            <p className="font-display text-3xl font-extrabold text-leaf-600">{metric.v}</p>
            <p className="mt-1 text-xs text-midnight/55">{metric.l}</p>
          </div>
        ))}
      </div>
    </Band>
  );
}

export function Community({ community, anchor = "pengabdian" }: { community: SiteContent["community"]; anchor?: string }) {
  return (
    <Band id={anchor} tone="white" kicker={community.kicker} title={community.title} intro={community.body}>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <DriveImage src={community.image} alt="" className="reveal aspect-[4/3] w-full rounded-[2.5rem] border border-midnight/10 object-cover" />
        <ul className="grid gap-3">
          {community.items.map((item) => (
            <li key={item} className="reveal card card-hover border-l-4 border-l-leaf-600 p-5 text-sm leading-relaxed text-midnight/75">{item}</li>
          ))}
        </ul>
      </div>
    </Band>
  );
}

export function StudentLife({ studentLife, onDaftar, anchor = "kemahasiswaan" }: { studentLife: SiteContent["studentLife"]; onDaftar: () => void; anchor?: string }) {
  return (
    <Band id={anchor} kicker={studentLife.kicker} title={studentLife.title}>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {studentLife.cards.map((card) => (
          <article key={`${card.tag}-${card.title}`} className="reveal card card-hover">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-leaf-600">{card.tag}</span>
            <h3 className="mt-3 font-display text-xl font-bold text-midnight">{card.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-midnight/65">{card.body}</p>
          </article>
        ))}
      </div>
      <button onClick={onDaftar} className="mt-9 rounded-full bg-gold px-8 py-4 text-sm font-extrabold text-midnight transition duration-300 hover:-translate-y-0.5 hover:bg-gold-600">{studentLife.cta}</button>
    </Band>
  );
}
