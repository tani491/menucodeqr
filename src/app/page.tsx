import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, QrCode, ShieldCheck, UtensilsCrossed } from "lucide-react";

export const metadata: Metadata = {
  title: "MenuCodeQR - Menus digitaux pour restaurants",
  description:
    "Bienvenue sur MenuCodeQR. Creez, personnalisez et gerez votre menu digital en toute simplicite.",
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6">
        <header className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-black text-white">
              <QrCode className="h-5 w-5" />
            </span>
            <span className="text-sm font-bold tracking-wide">MenuCodeQR</span>
          </div>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
          >
            Connexion
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Menu digital restaurant
            </p>
            <h1 className="text-4xl font-black leading-tight text-black sm:text-5xl">
              Bienvenue sur MenuCodeQR.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Creez et gerez votre menu digital en toute simplicite, depuis les plats
              jusqu'aux commandes en salle.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-md bg-black px-5 text-sm font-semibold text-white hover:bg-black/90"
              >
                Acceder a mon espace
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-black">Apercu operationnel</p>
                <p className="text-xs text-muted-foreground">Menu, tables et commandes</p>
              </div>
              <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Actif
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 9 }).map((_, index) => (
                <div
                  key={index}
                  className={`aspect-square rounded-sm ${
                    [0, 2, 4, 6, 8].includes(index) ? "bg-black" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <div className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-2">
              <div>
                <UtensilsCrossed className="mb-2 h-4 w-4 text-black" />
                <p className="text-sm font-semibold text-black">Menus personnalises</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Plats, couleurs, logo et banniere.
                </p>
              </div>
              <div>
                <ShieldCheck className="mb-2 h-4 w-4 text-black" />
                <p className="text-sm font-semibold text-black">Espaces securises</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Admin et restaurateur separes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
