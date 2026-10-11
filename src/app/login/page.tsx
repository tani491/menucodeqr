export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense } from "react";
import { FileText, MessageCircle, QrCode, RefreshCw, Smartphone } from "lucide-react";
import LoginForm from "@/components/login/LoginForm";

// Intentional local fallback: no Firestore/API request is needed to display this page.
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
  return <div className="relative flex min-h-52 items-center justify-center gap-5 overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50 p-6" aria-label="Aperçu d’un menu papier et d’un menu sur smartphone">
    <div className="w-36 rotate-[-5deg] rounded-lg border border-stone-200 bg-white p-4 shadow-md">
      <FileText className="mb-2 h-6 w-6 text-emerald-700" aria-hidden="true" />
      <p className="text-xs uppercase tracking-widest text-stone-500">Votre restaurant</p>
      <p className="mt-1 font-serif text-xl font-bold text-stone-900">La carte</p>
      <div className="mt-3 space-y-2 text-xs text-stone-600"><p>Entrées · Plats</p><p>Desserts · Boissons</p></div>
      <QrCode className="mt-4 h-9 w-9 text-emerald-800" aria-hidden="true" />
    </div>
    <div className="w-32 rotate-[5deg] rounded-[1.5rem] border-[5px] border-slate-600 bg-white p-3 shadow-lg">
      <Smartphone className="mx-auto mb-2 h-5 w-5 text-emerald-600" aria-hidden="true" />
      <p className="text-center text-xs font-bold text-slate-900">Menu QR</p>
      <div className="mt-3 rounded-lg bg-orange-50 p-2 text-xs text-orange-900">Plat du jour</div>
      <div className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900">Boissons</div>
      <div className="mt-3 rounded-lg bg-emerald-600 p-2 text-center text-xs font-semibold text-white">Commander</div>
    </div>
  </div>;
}

function MarketingLanding() {
  const settings = contact;
  const whatsapp = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(settings.defaultMessage)}`;
  return (
    <aside className="w-full max-w-xl space-y-5 rounded-3xl border border-emerald-100 bg-white p-6 text-slate-900 shadow-sm lg:p-8" aria-label="Découvrez notre menu QR">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Du papier au numérique</p>
      <h2 className="text-2xl font-bold tracking-tight">Votre restaurant, votre menu numérique</h2>
      <p className="text-sm leading-relaxed text-slate-600">Une belle carte, des commandes simples et un menu qui évolue avec votre restaurant.</p>
      <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"><MessageCircle className="h-5 w-5" aria-hidden="true" />Demander une démo sur WhatsApp</a>
      <ul className="grid gap-3 text-sm">
        <li className="flex items-center gap-3 rounded-xl bg-stone-50 p-3"><FileText className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" /><span><strong>Menu Papier sur-mesure</strong><br /><span className="text-slate-600">Une carte personnalisée à l’image de votre restaurant.</span></span></li>
        <li className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3"><QrCode className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" /><span><strong>Commande à table QR code</strong><br /><span className="text-slate-600">Vos clients consultent et commandent depuis leur téléphone.</span></span></li>
        <li className="flex items-center gap-3 rounded-xl bg-sky-50 p-3"><RefreshCw className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" /><span><strong>Modification des prix en direct</strong><br /><span className="text-slate-600">Mettez votre carte à jour quand vous le souhaitez.</span></span></li>
      </ul>
      <DemoPreview />
      <section aria-label="Exemples d’avis" className="space-y-3">
        <h3 className="text-sm font-semibold">Exemples d’avis — aperçu de présentation</h3>
        {testimonials.map((review) => <figure key={review.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <figcaption className="flex items-center gap-3">
            {review.avatarBase64 ? <img src={review.avatarBase64} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800" aria-hidden="true">{review.restaurantName.charAt(0)}</span>}
            <div><p className="text-sm font-semibold">{review.restaurantName}</p><p className="text-xs text-slate-500">{review.ownerName}</p></div>
          </figcaption>
          <p className="my-1 text-amber-600" aria-label={`${review.rating} sur 5`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
          <blockquote className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{review.comment}</blockquote>
        </figure>)}
      </section>
    </aside>
  );
}
export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-8 lg:flex-row lg:items-start">
        <div className="w-full max-w-md lg:sticky lg:top-10">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <MarketingLanding />
      </div>
    </main>
  );
}
