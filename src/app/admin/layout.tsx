"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const redirectedRef = useRef(false);
  const role = session?.user?.role;
  const isAdmin = role === "super_admin" || role === "admin";

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (status === "authenticated" && !isAdmin && !redirectedRef.current) {
      redirectedRef.current = true;
      toast({
        title: "Acces admin refuse",
        description: "Votre session restaurateur a ete redirigee vers le dashboard.",
        variant: "destructive",
      });
      router.replace("/dashboard");
    }
  }, [isAdmin, router, status]);

  if (status === "authenticated" && !isAdmin) return null;

  return <>{children}</>;
}
