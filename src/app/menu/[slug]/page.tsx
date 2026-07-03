import { Suspense } from "react";
import { getMenuBySlug, getAllRestaurantSlugs } from "@/lib/menu-data";
import MenuPageClient, { MenuSkeleton } from "@/components/menu/MenuPageClient";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Lecture dynamique pour appliquer immediatement une suspension restaurant.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── Génération statique des slugs connus (SSG) ────────────────────────────
// Cette fonction est appelée au build pour
// pré-générer les pages de chaque restaurant. Les slugs dynamiques sont
// gérés via le fallback true ci-dessous.
export async function generateStaticParams() {
  const slugs = await getAllRestaurantSlugs();
  return slugs.map((slug) => ({ slug }));
}

// ─── Fallback : autorise les slugs non pré-générés ────────────────────────
// En ISR, les nouveaux restaurants sont rendus à la première requête
// puis mis en cache.
export const dynamicParams = true;

// ─── Page serveur ───────────────────────────────────────────────────────────
export default async function MenuBySlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getMenuBySlug(slug);

  if (!data) {
    notFound();
  }

  if (data.restaurant.isSuspended) {
    return (
      <main className="min-h-screen bg-background px-4 py-16">
        <div className="mx-auto max-w-md rounded-xl border bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-black">Menu temporairement indisponible</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Ce restaurant est temporairement indisponible.
          </p>
        </div>
      </main>
    );
  }

  // Metadata dynamique via generateMetadata ci-dessous
  return (
    <Suspense fallback={<MenuSkeleton />}>
      <MenuPageClient data={data} />
    </Suspense>
  );
}

// ─── Metadata dynamique par restaurant ──────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getMenuBySlug(slug);

  if (!data) {
    return { title: "Restaurant introuvable" };
  }

  return {
    title: `${data.restaurant.name} — Menu Digital`,
    description: `Consultez le menu complet de ${data.restaurant.name}. Entrées, plats, desserts et boissons avec photos et prix.`,
    openGraph: {
      title: `${data.restaurant.name} — Menu Digital`,
      description: `Menu digital interactif avec photos et prix.`,
      type: "website",
    },
  };
}
