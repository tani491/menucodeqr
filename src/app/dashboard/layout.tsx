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

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tabSession, setTabSession] = useState<TabWorkspaceSession | null>(null);
  const [workspaceSessionChecked, setWorkspaceSessionChecked] = useState(false);
  const currentDashboardSession = useMemo(
    () => workspaceSessionFromUser("dashboard", session?.user),
    [
      session?.user?.id,
      session?.user?.role,
      session?.user?.email,
      session?.user?.name,
      session?.user?.restaurantId,
    ]
  );
  const dashboardSession = currentDashboardSession || tabSession;

  useEffect(() => {
    if (currentDashboardSession) {
      rememberWorkspaceSession("dashboard", currentDashboardSession);
      setTabSession(currentDashboardSession);
      setWorkspaceSessionChecked(true);
      return;
    }

    if (status !== "loading") {
      setTabSession(readWorkspaceSession("dashboard"));
      setWorkspaceSessionChecked(true);
    }
  }, [currentDashboardSession, status]);

  useEffect(() => {
    if (status === "loading" || !workspaceSessionChecked) return;

    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (!dashboardSession && status === "authenticated") {
      router.replace("/admin");
    }
  }, [status, dashboardSession, workspaceSessionChecked, router]);

  if ((status === "loading" || !workspaceSessionChecked) && !dashboardSession) {
    return null;
  }

  if (!dashboardSession || status === "unauthenticated") return null;

  return <>{children}</>;
}
