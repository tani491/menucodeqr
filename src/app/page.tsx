export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, FileText, RefreshCw, Smartphone } from "lucide-react";
import Image from "next/image";
import { headers } from "next/headers";
import QRCode from "qrcode";
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

async function MenuPreview() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || (host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");
  const destination = host ? `${protocol}://${host}/` : whatsappContactUrl;
  const qrImage = await QRCode.toDataURL(destination, { width: 160, margin: 2, errorCorrectionLevel: "M" });
  const dishes = [
    { name: "Pastel à la viande", description: "Pastels dorés, viande épicée et sauce tomate.", price: "2 000 FCFA" },
    { name: "Pastel au poisson", description: "Une entrée croustillante à partager.", price: "2 500 FCFA" },
    { name: "Pastel aux légumes", description: "Légumes de saison et herbes fraîches.", price: "1 500 FCFA" },
  ];
  return (
    <figure className="mx-auto min-w-0 w-full max-w-lg">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-1 py-5 sm:gap-5 sm:px-3 sm:py-7">
        <div className="min-w-0 rotate-[-4deg] border border-[#E5E7EB] bg-[#FCFBF8] px-3 py-5 shadow-[0_12px_35px_-20px_rgba(17,24,39,0.25)] sm:px-5 sm:py-7">
          <p className="text-center text-[8px] uppercase tracking-[0.18em] text-[#6B7280] sm:text-[9px]">La Playa</p>
          <p className="mt-2 text-center font-serif text-2xl tracking-tight sm:text-3xl">La carte</p>
          <div className="mt-4 overflow-hidden rounded-sm border border-[#E5E7EB] p-1">
            <Image src="/menu-preview-pastels.webp" alt="Pastels dorés, sauce tomate et salade fraîche" width={960} height={640} sizes="(max-width: 640px) 40vw, 220px" className="aspect-[4/3] w-full object-cover" />
          </div>
          <div className="mt-4 space-y-3 sm:space-y-4">
            <div><p className="text-[8px] uppercase tracking-[0.14em] text-[#0F5132] sm:text-[9px]">À partager</p><p className="mt-1 font-serif text-[11px] sm:text-sm">Les entrées de saison</p></div>
            <div><p className="text-[8px] uppercase tracking-[0.14em] text-[#0F5132] sm:text-[9px]">À savourer</p><p className="mt-1 font-serif text-[11px] sm:text-sm">Les plats de la maison</p></div>
            <div><p className="text-[8px] uppercase tracking-[0.14em] text-[#0F5132] sm:text-[9px]">Pour finir</p><p className="mt-1 font-serif text-[11px] sm:text-sm">Une touche de douceur</p></div>
          </div>
          <a href="/" className="mt-4 flex flex-col items-center gap-1.5 border-t border-[#E5E7EB] pt-3 text-center text-[#6B7280] sm:mt-5" aria-label="Découvrir MenuLive avec le QR code">
            <Image src={qrImage} alt="QR code scannable vers l’accueil MenuLive" width={48} height={48} unoptimized className="h-12 w-12 bg-white" />
            <span className="text-[8px] leading-3 sm:text-[9px]">Scannez pour découvrir MenuLive.</span>
          </a>
        </div>

        <div className="relative min-w-0 rotate-[4deg] rounded-[1.8rem] border border-[#6B7280] bg-[#111827] p-[5px] shadow-[0_18px_40px_-22px_rgba(17,24,39,0.4)] sm:rounded-[2.1rem] sm:p-[7px]">
          <div className="absolute -left-[2px] top-16 h-7 w-[2px] rounded-l bg-[#6B7280]" aria-hidden="true" />
          <div className="absolute -right-[2px] top-24 h-9 w-[2px] rounded-r bg-[#6B7280]" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[1.5rem] bg-[#F9FAFB] sm:rounded-[1.7rem]">
            <div className="relative flex h-7 items-center justify-between bg-white px-3 text-[7px] font-semibold sm:h-8 sm:text-[8px]" aria-hidden="true">
              <span>9:41</span><span className="absolute left-1/2 top-1.5 h-3 w-12 -translate-x-1/2 rounded-full bg-[#111827] sm:h-3.5 sm:w-14"><span className="absolute right-1.5 top-1 h-1 w-1 rounded-full bg-[#374151]" /></span><span>▮▮ ▰</span>
            </div>
            <div className="relative">
              <Image src="/menu-preview-pastels.webp" alt="" width={960} height={640} sizes="(max-width: 640px) 45vw, 240px" className="h-16 w-full object-cover sm:h-20" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#111827]/40 to-transparent" />
              <div className="absolute -bottom-4 left-2 flex h-9 w-9 items-center justify-center rounded-lg border-2 border-white bg-[#EFF6FF] font-serif text-sm text-[#2563EB] shadow-sm sm:h-11 sm:w-11 sm:text-base" aria-label="Logo du restaurant La Playa">LP</div>
            </div>
            <div className="border-b border-[#E5E7EB] bg-white px-2 pb-3 pt-6 sm:px-3">
              <div className="flex items-center justify-between gap-1"><p className="text-[11px] font-bold text-[#2563EB] sm:text-sm">la playa</p><span className="whitespace-nowrap rounded-full border border-[#E5E7EB] px-1.5 py-1 text-[6px] sm:text-[8px]"><strong className="text-[#2563EB]">FR</strong><span className="px-1 text-[#9CA3AF]">|</span>EN</span></div>
              <p className="mt-1 text-[7px] text-[#6B7280] sm:text-[8px]">Votre menu, à votre table.</p>
            </div>
            <div className="flex flex-wrap gap-1 border-b border-[#E5E7EB] bg-white px-2 py-2 sm:px-3">
              {["Entrées 3", "Plats 3", "Desserts 3", "Boissons"].map((category, index) => <span key={category} className={`rounded-full border px-1.5 py-1 text-[6px] font-medium sm:px-2 sm:text-[7px] ${index === 0 ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-[#E5E7EB] text-[#4B5563]"}`}>{category}</span>)}
            </div>
            <div className="space-y-1.5 px-1.5 pb-3 pt-2 sm:space-y-2 sm:px-2 sm:pb-4">
              <p className="px-0.5 text-[8px] font-semibold sm:text-[10px]">Entrées <span className="font-normal text-[#6B7280]">· 3 plats</span></p>
              {dishes.map((dish) => <div key={dish.name} className="flex items-start gap-1.5 rounded-lg border border-[#E5E7EB] bg-white p-1.5 sm:gap-2 sm:p-2">
                <Image src="/menu-preview-pastels.webp" alt={dish.name} width={960} height={640} sizes="64px" className="h-10 w-9 shrink-0 rounded-md object-cover sm:h-14 sm:w-12" />
                <div className="min-w-0"><p className="text-[7px] font-bold leading-[1.3] sm:text-[9px]">{dish.name}</p><p className="mt-0.5 text-[6px] leading-[1.4] text-[#6B7280] sm:text-[7px]">{dish.description}</p><p className="mt-1 text-[7px] font-bold text-[#2563EB] sm:text-[9px]">{dish.price}</p></div>
              </div>)}
              <p className="pt-1 text-center text-[6px] text-[#6B7280] sm:text-[7px]">Aperçu du menu digital</p>
            </div>
            <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-[#111827]/70" aria-hidden="true" />
          </div>
        </div>
      </div>
      <figcaption className="relative mt-5 px-4 pb-2 text-center text-xs leading-5 tracking-wide text-[#6B7280] sm:mt-7">Deux supports, une même identité.</figcaption>
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

      <section aria-labelledby="hero-title" className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-20 pt-[calc(3rem+env(safe-area-inset-top,0px))] sm:gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:px-8 lg:pb-28 lg:pt-20">
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
