export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, FileText, MessageCircle, QrCode, RefreshCw, Smartphone } from "lucide-react";

export const metadata: Metadata = {
  title: "MenuCodeQR - Menus digitaux et papier pour restaurants",
  description: "Découvrez notre offre hybride : menu papier sur-mesure, QR code interactif et commandes à table.",
};

const contact = {
  whatsappNumber: "221773615944",
  defaultMessage: "Bonjour, je souhaite une démonstration de votre menu QR pour mon restaurant.",
};
const testimonials = [
  { id: "example-paper", restaurantName: "Restaurant exemple", ownerName: "Exemple de gérant", comment: "Un menu papier à notre image et une carte numérique facile à partager avec nos clients.", rating: 5, avatarBase64: "" },
  { id: "example-table", restaurantName: "Café exemple", ownerName: "Exemple de gérante", comment: "Les clients consultent la carte et commandent directement depuis leur table avec le QR code.", rating: 5, avatarBase64: "" },
  { id: "example-prices", restaurantName: "Bistro exemple", ownerName: "Exemple de gérant", comment: "Nous pouvons mettre à jour nos prix en quelques clics, sans réimprimer toute la carte.", rating: 5, avatarBase64: "" },
];

function DemoPreview() {
  return <div className="relative flex min-h-80 items-center justify-center gap-5 overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50 p-6" aria-label="Aperçu d’un menu papier et d’un menu sur smartphone">
    <div className="w-44 rotate-[-5deg] rounded-lg border border-stone-200 bg-white p-4 shadow-md">
      <FileText className="mb-2 h-6 w-6 text-emerald-700" aria-hidden="true" />
      <p className="text-xs uppercase tracking-widest text-stone-500">Votre restaurant</p>
      <p className="mt-1 font-serif text-xl font-bold text-stone-900">La carte</p>
      <div className="mt-3 space-y-2 text-xs text-stone-600"><p>Entrées · Plats</p><p>Desserts · Boissons</p></div>
      <QrCode className="mt-4 h-9 w-9 text-emerald-800" aria-hidden="true" />
    </div>
    <div className="w-36 rotate-[5deg] rounded-[1.5rem] border-[5px] border-slate-600 bg-white p-3 shadow-lg">
      <Smartphone className="mx-auto mb-2 h-5 w-5 text-emerald-600" aria-hidden="true" />
      <p className="text-center text-xs font-bold text-slate-900">Menu QR</p>
      <div className="mt-3 rounded-lg bg-orange-50 p-2 text-xs text-orange-900">Plat du jour</div>
      <div className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900">Boissons</div>
      <div className="mt-3 rounded-lg bg-emerald-600 p-2 text-center text-xs font-semibold text-white">Commander</div>
    </div>
  </div>;
}

export default function HomePage() {
  const whatsapp = `https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(contact.defaultMessage)}`;
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 border-b border-slate-100 px-5 py-5">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-wide" aria-label="MenuCodeQR, accueil">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800"><QrCode className="h-6 w-6" aria-hidden="true" /></span>
          MenuCodeQR
        </Link>
        <Link href="/login" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50">Connexion</Link>
      </header>

      <section aria-labelledby="hero-title" className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Du papier au numérique</p>
          <h1 id="hero-title" className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">Bienvenue sur MenuCodeQR.</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">Une carte papier à votre image et un menu digital toujours à jour. Simplifiez les commandes à table et offrez à vos clients une expérience fluide.</p>
          <div className="mt-8 flex flex-col gap-3 sm:items-start">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-center font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"><MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />Commander un Menu Digital &amp; Papier</a>
            <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-semibold transition-colors hover:bg-slate-50">Accéder à mon espace<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </div>
        <div><DemoPreview /><p className="mt-4 text-center text-sm text-slate-500">Votre carte papier et votre menu sur smartphone, réunis.</p></div>
      </section>

      <section aria-labelledby="services-title" className="border-y border-emerald-100 bg-emerald-50/50 px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Nos atouts &amp; services</p>
          <h2 id="services-title" className="mt-3 text-3xl font-bold tracking-tight">L’offre hybride pour votre restaurant</h2>
          <p className="mt-4 max-w-2xl leading-7 text-slate-600">Associez un Menu Papier sur-mesure à un QR Code interactif. Vos clients choisissent leur façon de consulter la carte, et vous gardez la main sur votre menu.</p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><FileText className="mb-5 h-8 w-8 text-emerald-700" aria-hidden="true" /><h3 className="text-lg font-semibold">Menu Papier sur-mesure</h3><p className="mt-3 leading-7 text-slate-600">Une carte personnalisée qui met en valeur vos plats et l’identité de votre restaurant.</p></article>
            <article className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm"><QrCode className="mb-5 h-8 w-8 text-emerald-700" aria-hidden="true" /><h3 className="text-lg font-semibold">Commande à table par QR code</h3><p className="mt-3 leading-7 text-slate-600">Vos clients consultent la carte et commandent depuis leur téléphone, directement à leur table.</p></article>
            <article className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm"><RefreshCw className="mb-5 h-8 w-8 text-emerald-700" aria-hidden="true" /><h3 className="text-lg font-semibold">Modification des prix en direct</h3><p className="mt-3 leading-7 text-slate-600">Actualisez les prix de votre menu digital en quelques clics, quand vous le souhaitez.</p></article>
          </div>
        </div>
      </section>

      <section aria-labelledby="testimonials-title" className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Avis clients &amp; témoignages</p>
        <h2 id="testimonials-title" className="mt-3 text-3xl font-bold tracking-tight">Une carte pensée pour votre quotidien</h2>
        <p className="mt-3 text-sm text-slate-500">Exemples d’avis — aperçu de présentation.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {testimonials.map((review) => <figure key={review.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
            <p className="mb-4 text-lg text-amber-600" aria-label={`${review.rating} sur 5`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
            <blockquote className="leading-7 text-slate-600">{review.comment}</blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800" aria-hidden="true">{review.restaurantName.charAt(0)}</span>
              <div><p className="text-sm font-semibold">{review.restaurantName}</p><p className="text-xs text-slate-500">{review.ownerName}</p></div>
            </figcaption>
          </figure>)}
        </div>
      </section>
      <footer className="border-t border-slate-100 px-5 py-6 text-center text-sm text-slate-500">MenuCodeQR · Menu papier &amp; digital pour votre restaurant</footer>
    </main>
  );
}
