import { Suspense } from "react";
import { getMenuBySlug } from "@/lib/menu-data";
import MenuPageClient, { MenuSkeleton } from "@/components/menu/MenuPageClient";
import type { Metadata } from "next";

// ─── ISR : revalidation toutes les 60 secondes ─────────────────────────────
// En production, Next.js régénère la page en arrière-plan sans bloquer les
// requêtes clientes — équivalent exact du ISR (Incremental Static Regeneration).
// La DB n'est interrogée qu'une fois toutes les 60s max par restaurant.
export const revalidate = 60;

const DEMO_SLUG = "le-petit-bistrot";

// ─── Metadata SEO ───────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "Le Petit Bistrot — Menu Digital",
  description:
    "Consultez le menu complet du Petit Bistrot. Scannez le QR code pour accéder aux plats, entrées, desserts et boissons.",
  openGraph: {
    title: "Le Petit Bistrot — Menu Digital",
    description: "Menu digital interactif avec photos et prix.",
    type: "website",
  },
};

// ─── Page serveur ───────────────────────────────────────────────────────────
// Cette fonction s'exécute CÔTÉ SERVEUR uniquement. Les données sont
// injectées en HTML statique — pas d'appel réseau côté client au chargement.
export default async function MenuPage() {
  const data = await getMenuBySlug(DEMO_SLUG);

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <span className="text-5xl mb-4">🔍</span>
        <h1 className="text-xl font-bold mb-2">Restaurant introuvable</h1>
        <p className="text-sm text-muted-foreground">
          Ce menu n&apos;existe pas ou a été supprimé.
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<MenuSkeleton />}>
      <MenuPageClient data={data} />
    </Suspense>
  );
}
