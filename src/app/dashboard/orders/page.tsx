"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { db as firestoreDb } from "@/lib/firebaseClient";
import {
  clearWorkspaceSession,
  readWorkspaceSession,
  rememberWorkspaceSession,
  workspaceSessionFromUser,
  type TabWorkspaceSession,
} from "@/lib/tab-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { ArrowLeft, Bell, ChefHat, Clock, LogOut, RefreshCw } from "lucide-react";

type OrderStatus = "pending" | "ready" | "delivered";

type DashboardOrder = {
  id: string;
  tableNumber: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  totalPrice: number;
  notes: string | null;
  createdAt: string;
  items: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[];
};

type RestaurantRef = {
  id: string;
  isSuspended: boolean;
};

const ORDER_STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "ready",
  ready: "delivered",
};

const STATUS_COLUMNS: {
  id: OrderStatus;
  label: string;
  next: OrderStatus | null;
  action: string;
}[] = [
  { id: "pending", label: "En attente", next: "ready", action: "Valider la commande" },
  { id: "ready", label: "Pretes", next: "delivered", action: "Servi / Termine" },
  { id: "delivered", label: "Livrees", next: null, action: "" },
];

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function dateStringValue(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return new Date().toISOString();
}

function normalizeOrderStatus(status: unknown): OrderStatus {
  if (status === "ready" || status === "delivered") return status;
  return "pending";
}

function normalizeOrder(docSnap: QueryDocumentSnapshot): DashboardOrder {
  const data = docSnap.data() as Record<string, unknown>;
  const rawItems = Array.isArray(data.items) ? data.items : [];

  const items = rawItems.map((rawLine, index) => {
    const line =
      rawLine && typeof rawLine === "object"
        ? (rawLine as Record<string, unknown>)
        : {};
    const rawItem =
      line.item && typeof line.item === "object"
        ? (line.item as Record<string, unknown>)
        : {};
    const itemId = stringValue(rawItem.id, stringValue(line.itemId, `${docSnap.id}-${index}`));
    const name = stringValue(rawItem.nameFr, stringValue(line.name, "Plat"));
    const price = numberValue(line.price, numberValue(line.priceAtPurchase));

    return {
      id: stringValue(line.id, itemId),
      name,
      price,
      quantity: numberValue(line.quantity, 1),
    };
  });

  return {
    id: docSnap.id,
    tableNumber: stringValue(data.tableNumber, "1"),
    customerName: stringValue(data.customerName, "Client"),
    customerPhone: stringValue(data.customerPhone),
    status: normalizeOrderStatus(data.status),
    totalPrice: numberValue(data.totalPrice),
    notes: typeof data.notes === "string" && data.notes.trim() ? data.notes : null,
    createdAt: dateStringValue(data.createdAt),
    items,
  };
}

function ordersQuery(restaurantId: string) {
  return query(
    collection(firestoreDb, "orders"),
    where("restaurantId", "==", restaurantId)
  );
}

function sortOrdersByDate(orders: DashboardOrder[]) {
  return [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export default function DashboardOrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRestaurant, setCurrentRestaurant] = useState<RestaurantRef | null>(null);
  const [restaurantResolved, setRestaurantResolved] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lastSeenOrderId, setLastSeenOrderId] = useState<string | null>(null);
  const [newOrderNotice, setNewOrderNotice] = useState(false);
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
      router.push("/login");
    } else if (!dashboardSession && status === "authenticated") {
      router.push("/admin");
    }
  }, [status, dashboardSession, workspaceSessionChecked, router]);

  useEffect(() => {
    if (!dashboardSession) return;

    let cancelled = false;

    async function loadRestaurant() {
      const userId = dashboardSession?.id;
      if (!userId) {
        setCurrentRestaurant(null);
        setOrders([]);
        setRestaurantResolved(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setRestaurantResolved(false);
        const snapshot = await getDocs(
          query(collection(firestoreDb, "restaurants"), where("userId", "==", userId))
        );
        if (cancelled) return;

        const restaurantDoc = snapshot.docs[0];
        if (!restaurantDoc) {
          setCurrentRestaurant(null);
          setOrders([]);
          setRestaurantResolved(true);
          setLoading(false);
          return;
        }

        const restaurant = restaurantDoc.data() as Record<string, unknown>;
        const restaurantStatus = stringValue(restaurant.status, "active");
        setCurrentRestaurant({
          id: stringValue(restaurant.id, restaurantDoc.id),
          isSuspended: restaurantStatus === "suspended" || Boolean(restaurant.isSuspended),
        });
        setRestaurantResolved(true);
      } catch (error) {
        console.error("Erreur chargement restaurant commandes:", error);
        if (!cancelled) {
          setCurrentRestaurant(null);
          setOrders([]);
          setRestaurantResolved(true);
          setLoading(false);
        }
      }
    }

    loadRestaurant();

    return () => {
      cancelled = true;
    };
  }, [dashboardSession?.id]);

  useEffect(() => {
    if (!currentRestaurant?.id) {
      if (restaurantResolved) setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const unsubscribe = onSnapshot(
        ordersQuery(currentRestaurant.id),
        (snapshot) => {
          setOrders(sortOrdersByDate(snapshot.docs.map(normalizeOrder)));
          setLoading(false);
        },
        (error) => {
          console.error("Erreur ecouteur Firestore orders:", error);
          setOrders([]);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error("Erreur globale useEffect orders:", error);
      setLoading(false);
    }
  }, [currentRestaurant, restaurantResolved]);

  const refreshOrders = useCallback(async () => {
    if (!currentRestaurant?.id) return;

    try {
      setLoading(true);
      const snapshot = await getDocs(ordersQuery(currentRestaurant.id));
      setOrders(sortOrdersByDate(snapshot.docs.map(normalizeOrder)));
    } catch (error) {
      console.error("Erreur actualisation commandes:", error);
    } finally {
      setLoading(false);
    }
  }, [currentRestaurant?.id]);

  useEffect(() => {
    if (orders.length === 0) return;
    const newest = orders[0]?.id;
    const newestOrder = orders[0];
    if (lastSeenOrderId && newest && newest !== lastSeenOrderId && newestOrder?.status === "pending") {
      setNewOrderNotice(true);
      window.setTimeout(() => setNewOrderNotice(false), 6000);
      try {
        const audio = new Audio("/notification.mp3");
        audio.volume = 0.4;
        audio.play().catch(() => undefined);
      } catch {
        // Notification sonore optionnelle selon le navigateur.
      }
    }
    if (newest) setLastSeenOrderId(newest);
  }, [lastSeenOrderId, orders]);

  const grouped = useMemo(() => {
    return STATUS_COLUMNS.reduce<Record<string, DashboardOrder[]>>((acc, column) => {
      acc[column.id] = orders.filter((order) => order.status === column.id);
      return acc;
    }, {});
  }, [orders]);

  async function updateStatus(order: DashboardOrder, nextStatus: OrderStatus) {
    const expectedStatus = ORDER_STATUS_NEXT[order.status];

    if (expectedStatus !== nextStatus) {
      toast.error("Transition de commande invalide");
      void refreshOrders();
      return;
    }

    setUpdatingId(order.id);
    setOrders((current) =>
      current.map((item) => (item.id === order.id ? { ...item, status: nextStatus } : item))
    );

    try {
      const now = new Date().toISOString();
      await updateDoc(doc(firestoreDb, "orders", order.id), {
        status: nextStatus,
        statusUpdatedAt: now,
        updatedAt: now,
      });
      toast.success(nextStatus === "ready" ? "Commande marquee prete" : "Commande livree");
    } catch (error) {
      console.error("Erreur mise a jour statut commande:", error);
      toast.error("Impossible de mettre a jour la commande");
      void refreshOrders();
    } finally {
      setUpdatingId(null);
    }
  }

  const handleSignOut = useCallback(() => {
    clearWorkspaceSession("dashboard");
    void signOut({ callbackUrl: "/login" });
  }, []);

  if (((status === "loading" || !workspaceSessionChecked) && !dashboardSession) || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dashboardSession || status === "unauthenticated") return null;

  if (currentRestaurant?.isSuspended) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Deconnexion</span>
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-10">
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
            <h1 className="text-lg font-bold">Compte suspendu</h1>
            <p className="mt-2 text-sm leading-relaxed">
              Votre compte a ete suspendu pour defaut de paiement. Veuillez contacter
              l&apos;administrateur de l&apos;application pour regulariser votre situation.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-primary" />
              <h1 className="text-sm font-semibold sm:text-base">Commandes en salle</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshOrders}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Actualiser
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">Deconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
            newOrderNotice
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "bg-card text-muted-foreground"
          }`}
        >
          <Bell className="h-4 w-4" />
          {newOrderNotice
            ? "Nouvelle commande recue !"
            : "Les nouvelles commandes sont actualisees automatiquement."}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {STATUS_COLUMNS.map((column) => (
            <section key={column.id} className="min-h-40 rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b p-3">
                <h2 className="text-sm font-semibold">{column.label}</h2>
                <Badge variant="secondary">{grouped[column.id]?.length || 0}</Badge>
              </div>
              <div className="space-y-3 p-3">
                {(grouped[column.id] || []).map((order) => (
                  <article key={order.id} className="rounded-lg border bg-white p-3 shadow-sm">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-3xl font-black tracking-tight text-black">
                          Table N° {order.tableNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-black">
                        {order.totalPrice.toLocaleString("fr-FR")} FCFA
                      </p>
                    </div>
                    <div className="mb-3 rounded-md bg-muted/60 p-2 text-xs">
                      <p className="font-medium text-black">{order.customerName}</p>
                      <p className="text-muted-foreground">{order.customerPhone}</p>
                      {order.notes && <p className="mt-1 text-black">Note: {order.notes}</p>}
                    </div>
                    <ul className="mb-3 space-y-1 text-sm">
                      {order.items.map((line) => (
                        <li key={line.id} className="flex justify-between gap-3">
                          <span className="text-black">
                            {line.quantity}x {line.name}
                          </span>
                          <span className="text-muted-foreground">
                            {(line.quantity * line.price).toLocaleString("fr-FR")} FCFA
                          </span>
                        </li>
                      ))}
                    </ul>
                    {column.next && (
                      <Button
                        className="w-full"
                        size="sm"
                        disabled={updatingId === order.id}
                        onClick={() => column.next && updateStatus(order, column.next)}
                      >
                        {updatingId === order.id ? "Mise a jour..." : column.action}
                      </Button>
                    )}
                    {column.id === "delivered" && (
                      <div className="flex items-center justify-center gap-1 rounded-md bg-slate-50 p-2 text-xs font-medium text-slate-700">
                        <Clock className="h-3.5 w-3.5" />
                        Commande terminee
                      </div>
                    )}
                  </article>
                ))}
                {(grouped[column.id] || []).length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">Aucune commande</p>
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
