"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import PasswordSettingsDialog from "@/components/PasswordSettingsDialog";
import { Button } from "@/components/ui/button";

export default function DashboardSettingsPage() {
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <h1 className="text-sm font-semibold sm:text-base">Parametres</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <KeyRound className="h-5 w-5 text-black" />
            </span>
            <div>
              <h2 className="text-base font-bold text-black">Mot de passe</h2>
              <p className="text-sm text-muted-foreground">
                Modification du mot de passe de connexion.
              </p>
            </div>
          </div>
          <Button type="button" onClick={() => setPasswordOpen(true)}>
            Modifier le mot de passe
          </Button>
        </section>
      </main>

      <PasswordSettingsDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
