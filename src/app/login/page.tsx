"use client";

import { Suspense, useState, type FormEvent } from "react";
import { signIn as signInWithNextAuth } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      await signInWithEmailAndPassword(auth, normalizedEmail, password);

      const result = await signInWithNextAuth("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
      });

      if (result?.ok) {
        window.location.href = normalizedEmail.includes("admin") ? "/admin" : "/dashboard";
        return;
      }

      if (result?.error) {
        setError("Email ou mot de passe incorrect.");
        setLoading(false);
        return;
      }

      setError("Email ou mot de passe incorrect.");
      setLoading(false);
    } catch {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
    } finally {
      if (typeof window === "undefined") {
        setLoading(false);
      }
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <CardTitle className="text-xl">Connexion</CardTitle>
        <CardDescription>
          Accedez a votre espace de gestion
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {searchParams.get("error") === "no_restaurant" && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700">
              Aucun restaurant associe a votre compte. Contactez un administrateur.
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Connexion...
              </span>
            ) : (
              "Se connecter"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
