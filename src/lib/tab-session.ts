type WorkspaceScope = "admin" | "dashboard";

type SessionUserLike = {
  id?: unknown;
  role?: unknown;
  email?: unknown;
  name?: unknown;
  restaurantId?: unknown;
};

export type TabWorkspaceSession = {
  id: string;
  role: "admin" | "super_admin" | "restaurateur";
  email: string;
  name: string;
  restaurantId: string | null;
};

const STORAGE_KEYS: Record<WorkspaceScope, string> = {
  admin: "qr-menu-tab-session:admin",
  dashboard: "qr-menu-tab-session:dashboard",
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function roleMatchesScope(scope: WorkspaceScope, role: string) {
  if (scope === "admin") return role === "admin" || role === "super_admin";
  return role === "restaurateur";
}

export function workspaceSessionFromUser(
  scope: WorkspaceScope,
  user: SessionUserLike | undefined
): TabWorkspaceSession | null {
  const id = stringValue(user?.id);
  const role = stringValue(user?.role);

  if (!id || !roleMatchesScope(scope, role)) return null;

  return {
    id,
    role: role as TabWorkspaceSession["role"],
    email: stringValue(user?.email),
    name: stringValue(user?.name),
    restaurantId: stringValue(user?.restaurantId) || null,
  };
}

export function readWorkspaceSession(scope: WorkspaceScope) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEYS[scope]);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<TabWorkspaceSession>;
    const session = workspaceSessionFromUser(scope, parsed);
    return session;
  } catch {
    return null;
  }
}

export function rememberWorkspaceSession(scope: WorkspaceScope, session: TabWorkspaceSession) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(STORAGE_KEYS[scope], JSON.stringify(session));
  } catch {
    // sessionStorage can be unavailable in restricted browsing contexts.
  }
}

export function clearWorkspaceSession(scope: WorkspaceScope) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(STORAGE_KEYS[scope]);
  } catch {
    // sessionStorage can be unavailable in restricted browsing contexts.
  }
}
