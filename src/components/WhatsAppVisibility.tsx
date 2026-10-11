"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function WhatsAppVisibility({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname !== "/" && pathname !== "/login") return null;
  return <>{children}</>;
}
