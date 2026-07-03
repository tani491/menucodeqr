"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  readWorkspaceSession,
  rememberWorkspaceSession,
  workspaceSessionFromUser,
  type TabWorkspaceSession,
} from "@/lib/tab-session";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tabSession, setTabSession] = useState<TabWorkspaceSession | null>(null);
  const [workspaceSessionChecked, setWorkspaceSessionChecked] = useState(false);
  const currentAdminSession = useMemo(
    () => workspaceSessionFromUser("admin", session?.user),
    [
      session?.user?.id,
      session?.user?.role,
      session?.user?.email,
      session?.user?.name,
      session?.user?.restaurantId,
    ]
  );
  const adminSession = currentAdminSession || tabSession;

  useEffect(() => {
    if (currentAdminSession) {
      rememberWorkspaceSession("admin", currentAdminSession);
      setTabSession(currentAdminSession);
      setWorkspaceSessionChecked(true);
      return;
    }

    if (status !== "loading") {
      setTabSession(readWorkspaceSession("admin"));
      setWorkspaceSessionChecked(true);
    }
  }, [currentAdminSession, status]);

  useEffect(() => {
    if (status === "loading" || !workspaceSessionChecked) return;

    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (!adminSession && status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, adminSession, workspaceSessionChecked, router]);

  if ((status === "loading" || !workspaceSessionChecked) && !adminSession) {
    return null;
  }

  if (!adminSession || status === "unauthenticated") return null;

  return <>{children}</>;
}
