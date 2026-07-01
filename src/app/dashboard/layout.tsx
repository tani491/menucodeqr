"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const redirectedRef = useRef(false);
  const role = session?.user?.role;
  const isAdmin = role === "super_admin" || role === "admin";
  const isRestaurateur = role === "restaurateur";

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (status === "authenticated" && isAdmin && !redirectedRef.current) {
      redirectedRef.current = true;
      toast({
        title: "Dashboard restaurateur refuse",
        description: "Votre session admin a ete redirigee vers l'administration.",
        variant: "destructive",
      });
      router.replace("/admin");
      return;
    }

    if (
      status === "authenticated" &&
      !isAdmin &&
      !isRestaurateur &&
      !redirectedRef.current
    ) {
      redirectedRef.current = true;
      router.replace("/login");
    }
  }, [isAdmin, isRestaurateur, router, status]);

  if (status === "authenticated" && (isAdmin || !isRestaurateur)) return null;

  return <>{children}</>;
}
