"use client";

import { useEffect, useState } from "react";
import { marketingRequest, type MarketingData } from "@/lib/marketing";

export default function MarketingPanel() {
  const [data, setData] = useState<MarketingData | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending || document.hidden) return;
      pending = true;
      try { setData(await marketingRequest<MarketingData>("/api/marketing", { signal: controller.signal })); }
      catch { /* Marketing failures must never prevent login. Keep the last successful data. */ }
      finally { pending = false; }
    }
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  if (!data) return null;
  const { settings, testimonials } = data;
  const whatsapp = settings.whatsappNumber ? `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(settings.defaultMessage)}` : null;
  return (
    <aside className="w-full max-w-xl space-y-6 rounded-2xl border bg-card p-6 lg:p-8" aria-label="Découvrez notre menu QR">
      <h2 className="text-2xl font-bold">Votre restaurant, votre menu numérique</h2>
      {settings.defaultMessage && <p className="text-muted-foreground whitespace-pre-wrap">{settings.defaultMessage}</p>}
      {settings.demoImageBase64 && <img src={settings.demoImageBase64} alt="Démonstration du menu papier et du menu sur smartphone" className="max-h-80 w-full rounded-xl object-contain" />}
      {(settings.stats.totalRestaurants > 0 || settings.stats.satisfactionRate > 0) && <div className="flex flex-wrap gap-6 text-sm">
        {settings.stats.totalRestaurants > 0 && <p><strong>{settings.stats.totalRestaurants}</strong> restaurants</p>}
        {settings.stats.satisfactionRate > 0 && <p><strong>{settings.stats.satisfactionRate}%</strong> de satisfaction</p>}
      </div>}
      {testimonials.length > 0 && <section aria-label="Avis clients" className="space-y-3">
        {testimonials.map((review) => <figure key={review.id} className="rounded-xl border p-4">
          <figcaption className="flex items-center gap-3">
            {review.avatarBase64 && <img src={review.avatarBase64} alt="" className="h-10 w-10 rounded-full object-cover" />}
            <div><p className="font-semibold">{review.restaurantName}</p><p className="text-sm text-muted-foreground">{review.ownerName}</p></div>
          </figcaption>
          <p className="my-2 text-amber-500" aria-label={`${review.rating} sur 5`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
          <blockquote className="whitespace-pre-wrap break-words text-sm">{review.comment}</blockquote>
        </figure>)}
      </section>}
      {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white">Demander une démo sur WhatsApp</a>}
    </aside>
  );
}
