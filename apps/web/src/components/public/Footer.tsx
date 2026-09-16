import { useEffect, useState } from "react";
import type { SiteContent } from "@tpb/contracts";
import { api } from "../../lib/api";
import { Crest } from "./ui";

export function Footer({ footer }: { footer: SiteContent["footer"] }) {
  const [email, setEmail] = useState(""); const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const subscribe = async (event: React.FormEvent) => { event.preventDefault(); if (!email.trim()) return; setStatus("sending"); try { await api.subscribe(email); setEmail(""); setStatus("sent"); } catch { setStatus("error"); } };
  const socials = footer.socials;
  return (
    <footer className="relative overflow-hidden bg-midnight text-white">
      <div className="mx-auto grid max-w-[1360px] gap-14 px-5 py-20 lg:grid-cols-[1.5fr_1fr_1fr] lg:px-10">
        <div>
          <Crest className="h-12 w-12 drop-shadow-sm" />
          <h3 className="mt-7 font-display text-3xl font-extrabold leading-tight">{footer.newsletterTitle}</h3>
          <form onSubmit={subscribe} className="mt-7 flex max-w-md items-center rounded-full border border-white/15 bg-white/5 p-1.5 backdrop-blur">
            <input type="email" required aria-label="Alamat email untuk berlangganan" value={email} onChange={(event) => setEmail(event.target.value)} className="flex-1 bg-transparent px-5 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none" />
            <button disabled={status === "sending"} className="rounded-full bg-gold px-6 py-2.5 text-xs font-extrabold text-midnight transition hover:bg-gold-600">{status === "sending" ? "…" : status === "sent" ? "Terkirim ✓" : status === "error" ? "Gagal ✕" : footer.submitLabel}</button>
          </form>
          {socials.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              {socials.map((s) => (
                <a key={`${s.label}-${s.href}`} href={s.href} target="_blank" rel="noreferrer" className="social-chip">
                  {/instagram\.com/i.test(s.href) && <svg viewBox="0 0 24 24" className="h-4 w-4 text-gold" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>}
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4 className="font-display text-xl font-bold">{footer.infoTitle}</h4>
          <ul className="mt-6 space-y-4 text-sm text-white/70">
            <li>{footer.contact.phoneHref ? <a href={footer.contact.phoneHref} target="_blank" rel="noreferrer" className="transition hover:text-white">{footer.contact.phone}</a> : footer.contact.phone}</li>
            <li>{footer.contact.email}</li>
            <li className="leading-relaxed">{footer.contact.address}</li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-xl font-bold">{footer.quickLinksTitle}</h4>
          <ul className="mt-6 space-y-3.5 text-sm text-white/70">
            {footer.quickLinks.map((link) => <li key={`${link.label}-${link.href}`}><a href={link.href} className="transition hover:text-white">{link.label}</a></li>)}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-2 px-5 py-6 text-xs text-white/50 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <p>{footer.copyright}</p>
          <p className="font-mono uppercase tracking-[0.2em] text-white/40">{footer.tagline}</p>
        </div>
      </div>
    </footer>
  );
}

export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => { const onScroll = () => setShow(window.scrollY > 600); window.addEventListener("scroll", onScroll, { passive: true }); return () => window.removeEventListener("scroll", onScroll); }, []);
  return <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Kembali ke atas" className={`fixed bottom-7 right-7 z-40 grid h-12 w-12 place-items-center rounded-full bg-gold text-midnight shadow-lg transition-all ${show ? "opacity-100" : "pointer-events-none opacity-0"}`}>↑</button>;
}
