export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, FileText, QrCode, RefreshCw, Smartphone } from "lucide-react";
import { WhatsAppIcon, whatsappContactUrl } from "@/components/WhatsAppContact";

export const metadata: Metadata = {
  title: "MenuLive — Carte papier sur-mesure & menu digital",
  description: "Une création physique haut de gamme alliée à la rapidité de la commande sur smartphone. Découvrez MenuLive pour votre restaurant.",
  openGraph: {
    title: "MenuLive — Carte papier sur-mesure & menu digital",
    description: "Une belle carte papier. Un menu digital toujours à jour.",
    type: "website",
  },
};

const pillars = [
  { icon: FileText, title: "Impression Papier Premium", description: "Cartes A4/A3 pelliculées et personnalisées, pensées pour votre restaurant." },
  { icon: Smartphone, title: "Menu QR Code Interactif", description: "Vos clients consultent la carte et commandent en salle, depuis leur smartphone." },
  { icon: RefreshCw, title: "Gestion en temps réel", description: "Modifiez vos prix depuis votre espace. Votre menu digital est aussitôt à jour." },
];

const testimonials = [
  { id: "paper", name: "Restaurant exemple", owner: "Exemple de gérant", comment: "Une carte papier à notre image et un menu digital facile à partager avec nos clients." },
  { id: "table", name: "Café exemple", owner: "Exemple de gérante", comment: "Les clients consultent la carte et commandent directement depuis leur table." },
  { id: "prices", name: "Bistro exemple", owner: "Exemple de gérant", comment: "Nous mettons nos prix à jour en quelques clics, sans réimprimer toute la carte." },
];

function MenuPreview() {
  return (
    <figure className="mx-auto w-full max-w-md">
      <div className="relative h-[380px] sm:h-[420px]" role="img" aria-label="Une carte papier personnalisée accompagnée de son menu sur smartphone">
        <div className="absolute left-0 top-5 w-[65%] rotate-[-6deg] border border-[#E5E7EB] bg-[#FCFBF8] px-6 py-8 shadow-[0_12px_35px_-20px_rgba(17,24,39,0.25)] sm:px-8">
          <p className="text-center text-[9px] uppercase tracking-[0.25em] text-[#6B7280]">Votre restaurant</p>
          <p className="mt-4 text-center font-serif text-4xl tracking-tight">La carte</p>
          <div className="mx-auto mt-5 h-px w-10 bg-[#D1D5DB]" />
          <p className="mt-6 text-[9px] uppercase tracking-[0.2em] text-[#0F5132]">À partager</p>
          <p className="mt-2 font-serif text-sm">Les entrées de saison</p>
          <p className="mt-5 text-[9px] uppercase tracking-[0.2em] text-[#0F5132]">À savourer</p>
          <p className="mt-2 font-serif text-sm">Les plats de la maison</p>
          <p className="mt-5 text-[9px] uppercase tracking-[0.2em] text-[#0F5132]">Pour finir</p>
          <p className="mt-2 font-serif text-sm">Une touche de douceur</p>
          <div className="mt-7 flex items-center gap-2 border-t border-[#E5E7EB] pt-4 text-[#6B7280]"><QrCode className="h-6 w-6 shrink-0" aria-hidden="true" /><span className="text-[9px]">La carte, aussi sur votre téléphone.</span></div>
        </div>
        <div className="absolute bottom-3 right-0 w-[43%] max-w-44 rotate-[5deg] rounded-[1.75rem] border border-[#9CA3AF] bg-white p-2 shadow-[0_18px_40px_-22px_rgba(17,24,39,0.3)]">
          <div className="mx-auto mb-4 mt-1 h-1 w-10 rounded-full bg-[#D1D5DB]" />
          <div className="px-3 pb-4">
            <p className="text-[9px] uppercase tracking-[0.18em] text-[#6B7280]">Votre restaurant</p>
            <p className="mt-2 font-serif text-2xl">Le menu</p>
            <p className="mt-1 text-[10px] text-[#6B7280]">À votre table.</p>
            <div className="mt-5 space-y-4">
              {["Entrées", "Plats", "Desserts"].map((category) => <div key={category} className="border-b border-[#F3F4F6] pb-3"><p className="text-xs font-medium">{category}</p><div className="mt-2 h-1 w-4/5 rounded-full bg-[#F3F4F6]" /><div className="mt-1 h-1 w-3/5 rounded-full bg-[#F3F4F6]" /></div>)}
            </div>
            <p className="mt-5 rounded-lg bg-[#0F5132] px-2 py-2.5 text-center text-[10px] font-medium text-white">Commander à table</p>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-xs tracking-wide text-[#6B7280]">Deux supports. Une même identité.</figcaption>
    </figure>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-[#111827]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7 lg:px-8">
        <Link href="/" aria-label="MenuLive, accueil" className="font-serif text-3xl tracking-tight">MenuLive<span className="text-[#0F5132]">.</span></Link>
        <Link href="/login" className="inline-flex items-center gap-2 text-sm text-[#4B5563] transition-colors hover:text-[#111827]">Mon espace<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
      </header>

      <section aria-labelledby="hero-title" className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:px-8 lg:pb-28 lg:pt-20">
        <div>
          <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.2em] text-[#6B7280]">Le soin du papier. La simplicité du digital.</p>
          <h1 id="hero-title" className="max-w-2xl font-serif text-[2.65rem] leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.4rem]">La carte papier sur-mesure &amp; le menu digital de votre restaurant.</h1>
          <p className="mt-7 max-w-lg text-base leading-8 text-[#6B7280] sm:text-lg">Une création physique haut de gamme alliée à la rapidité de la commande sur smartphone.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#111827] px-6 text-sm font-medium text-white transition-colors hover:bg-[#374151] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111827]">Accéder à mon espace</Link>
            <a href={whatsappContactUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#D1D5DB] px-5 text-sm font-medium transition-colors hover:border-[#111827] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111827]"><WhatsAppIcon className="h-4 w-4" />Demander une démo WhatsApp</a>
          </div>
        </div>
        <MenuPreview />
      </section>

      <section aria-labelledby="pillars-title" className="bg-[#F9FAFB] px-6 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 max-w-xl"><p className="text-[11px] uppercase tracking-[0.2em] text-[#6B7280]">L’essentiel, bien pensé</p><h2 id="pillars-title" className="mt-4 font-serif text-3xl tracking-tight sm:text-4xl">Une belle carte. Une gestion simple.</h2></div>
          <div className="grid gap-10 md:grid-cols-3 md:gap-12">
            {pillars.map(({ icon: Icon, title, description }) => <article key={title} className="border-t border-[#E5E7EB] pt-7"><Icon className="mb-6 h-6 w-6 text-[#0F5132]" strokeWidth={1.4} aria-hidden="true" /><h3 className="text-base font-medium">{title}</h3><p className="mt-3 max-w-sm text-sm leading-7 text-[#6B7280]">{description}</p></article>)}
          </div>
        </div>
      </section>

      <section aria-labelledby="testimonials-title" className="mx-auto max-w-6xl px-6 py-20 lg:px-8 lg:py-24">
        <div className="mb-12"><h2 id="testimonials-title" className="font-serif text-3xl tracking-tight sm:text-4xl">Pensé pour les restaurateurs.</h2><p className="mt-3 text-xs text-[#6B7280]">Exemples de témoignages, à titre d’illustration.</p></div>
        <div className="grid gap-10 md:grid-cols-3 md:gap-12">
          {testimonials.map((review) => <figure key={review.id}><p className="mb-5 text-sm tracking-[0.18em] text-[#B08D57]" aria-label="5 sur 5">★★★★★</p><blockquote className="text-sm leading-7 text-[#4B5563]">« {review.comment} »</blockquote><figcaption className="mt-5"><p className="text-xs font-medium">{review.name}</p><p className="mt-1 text-xs text-[#6B7280]">{review.owner}</p></figcaption></figure>)}
        </div>
      </section>
      <footer className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-[#E5E7EB] px-6 pb-24 pt-7 text-xs text-[#6B7280] sm:flex-row sm:justify-between lg:px-8"><p className="font-serif text-lg text-[#111827]">MenuLive.</p><p>La carte papier &amp; le menu digital de votre restaurant.</p></footer>
    </main>
  );
}
