import type { Metadata } from "next";

const configuredSite = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://menucodeqr.vercel.app");
// A local testing URL must never become a production canonical.
export const siteUrl = configuredSite.protocol === "https:" ? configuredSite : new URL("https://menucodeqr.vercel.app");
export const demoSlugs = (process.env.PUBLIC_DEMO_SLUGS || "demo,la-playa").split(",").map(s => s.trim()).filter(s => /^[a-zA-Z0-9_-]+$/.test(s));
export const siteMetadata: Metadata = {
  metadataBase: siteUrl,
  title: "MenuCraft | Carte Papier Sur-Mesure & Menu Digital QR Code",
  description: "Sublimez vos tables avec une carte papier élégante et offrez la commande instantanée sur smartphone. La solution hybride 2-en-1 pour restaurants et bistros.",
  keywords: ["Menu QR Code", "Carte Papier Restaurant", "Menu Digital", "Commande à table QR", "Menu Restaurant Sénégal", "MenuCraft"],
  authors: [{ name: "MenuCraft Team" }], creator: "MenuCraft",
  openGraph: {
    title: "MenuCraft - Carte Papier & Menu Digital QR Code",
    description: "La solution hybride 2-en-1 pour moderniser votre restaurant sans perdre l’élégance du papier.",
    url: siteUrl, siteName: "MenuCraft", locale: "fr_FR", type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Aperçu de la solution MenuCraft" }],
  },
  twitter: { card: "summary_large_image", title: "MenuCraft | Carte Papier & Menu Digital", description: "Solution hybride pour restaurants : carte physique + QR code interactif.", images: ["/og-image.png"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 } },
};
export const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${siteUrl.origin}/#organization`, name: "MenuCraft", url: siteUrl.origin },
    { "@type": "SoftwareApplication", name: "MenuCraft", url: siteUrl.origin, operatingSystem: "Web", applicationCategory: "BusinessApplication", description: "Application de menu digital QR code et création de cartes papier sur-mesure pour restaurateurs.", provider: { "@id": `${siteUrl.origin}/#organization` } },
    { "@type": "Service", name: "Création de Menus Hybrides (Papier & Digital)", provider: { "@id": `${siteUrl.origin}/#organization` }, areaServed: "Global", serviceType: "Design Graphique & Solutions Numériques pour Restaurants" },
  ],
};
