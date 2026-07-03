"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import PasswordSettingsDialog from "@/components/PasswordSettingsDialog";
import {
  clearWorkspaceSession,
  readWorkspaceSession,
  rememberWorkspaceSession,
  workspaceSessionFromUser,
  type TabWorkspaceSession,
} from "@/lib/tab-session";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { db, firebaseConfig } from "@/lib/firebaseClient";
import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { addDoc, collection, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import {
  Plus,
  LogOut,
  ShieldCheck,
  Building2,
  Users,
  UtensilsCrossed,
  Loader2,
  Eye,
  Settings,
  UserPlus,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RestaurantRow {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  isSuspended: boolean;
  createdAt: string;
  _count: { categories: number; items: number; users: number };
}

interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  restaurantId: string;
}

interface CreateRestaurantForm {
  name: string;
  slug: string;
  managerEmail: string;
  password: string;
  bannerUrl: string;
}

function normalizeFirestoreDate(value: unknown) {
  if (typeof value === "string") return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return new Date().toISOString();
}

async function createRestaurateurAuthUser(email: string, password: string) {
  const appName = `restaurant-creator-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const creatorApp = initializeApp(firebaseConfig, appName);

  try {
    const userCredential = await createUserWithEmailAndPassword(
      getAuth(creatorApp),
      email,
      password
    );

    return userCredential.user.uid;
  } finally {
    await deleteApp(creatorApp).catch((error) => {
      console.error("Erreur fermeture Firebase Auth secondaire :", error);
    });
  }
}

// ─── Composants ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <Icon className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function CreateRestaurantDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (restaurant: RestaurantRow) => void;
}) {
  const [form, setForm] = useState<CreateRestaurantForm>({
    name: "",
    slug: "",
    managerEmail: "",
    password: "Resto2026!",
    bannerUrl: "",
  });
  const [saving, setSaving] = useState(false);

  const generateSlug = useCallback((name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }, []);

  const handleNameChange = useCallback(
    (name: string) => {
      setForm((f) => ({
        ...f,
        name,
        slug: generateSlug(name),
      }));
    },
    [generateSlug]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.name.trim() ||
      !form.slug.trim() ||
      !form.managerEmail.trim() ||
      form.password.length < 6
    ) {
      return;
    }
    setSaving(true);

    try {
      const nameValue = form.name.trim();
      const slugValue = form.slug.trim().toLowerCase();
      const emailValue = form.managerEmail.trim().toLowerCase();
      const passwordValue = form.password;
      const bannerValue = form.bannerUrl.trim();
      const createdAt = new Date().toISOString();
      const uid = await createRestaurateurAuthUser(emailValue, passwordValue);
      const restaurantRef = doc(collection(db, "restaurants"));
      const restaurantId = restaurantRef.id;

      const defaultCategories = [
        { nameFr: "Entrees", nameEn: "Starters", sortOrder: 1 },
        { nameFr: "Plats", nameEn: "Main Courses", sortOrder: 2 },
        { nameFr: "Desserts", nameEn: "Desserts", sortOrder: 3 },
        { nameFr: "Boissons", nameEn: "Drinks", sortOrder: 4 },
      ];

      await setDoc(doc(db, "users", uid), {
        id: uid,
        uid,
        name: nameValue,
        email: emailValue,
        role: "restaurateur",
        restaurantId,
        status: "active",
        authProvider: "firebase",
        createdAt,
        updatedAt: createdAt,
        mustChangePassword: true,
        initialPasswordCreatedAt: createdAt,
        passwordUpdatedAt: null,
      });

      await setDoc(restaurantRef, {
        id: restaurantId,
        name: nameValue,
        slug: slugValue,
        userId: uid,
        managerEmail: emailValue,
        status: "active",
        createdAt,
        updatedAt: createdAt,
        logoUrl: null,
        bannerUrl: bannerValue || null,
        primaryColor: "#000000",
        isSuspended: false,
        categoriesCount: defaultCategories.length,
        itemsCount: 0,
        usersCount: 1,
        _count: {
          categories: defaultCategories.length,
          items: 0,
          users: 1,
        },
      });

      await Promise.all(
        defaultCategories.map((category) =>
          addDoc(collection(db, "categories"), {
            ...category,
            restaurantId,
            createdAt,
            updatedAt: createdAt,
          })
        )
      );

      console.log("Restaurant créé avec succès, ID:", restaurantId);

      toast.success(`Restaurant "${nameValue}" créé avec ${defaultCategories.length} catégories`);
      setForm({
        name: "",
        slug: "",
        managerEmail: "",
        password: "Resto2026!",
        bannerUrl: "",
      });
      onOpenChange(false);
      onSuccess({
        id: restaurantId,
        slug: slugValue,
        name: nameValue,
        logoUrl: null,
        bannerUrl: bannerValue || null,
        isSuspended: false,
        createdAt,
        _count: {
          categories: defaultCategories.length,
          users: 1,
          items: 0,
        },
      });
    } catch (error) {
      console.error("Erreur d'écriture directe Firestore :", error);
      const code =
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "";

      toast.error(
        code === "auth/email-already-in-use"
          ? "Cet email possede deja un compte Firebase."
          : "Erreur de creation du restaurant"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau restaurant</DialogTitle>
          <DialogDescription>
            Créez un restaurant et ses catégories par défaut (Entrées, Plats, Desserts, Boissons).
          </DialogDescription>
        </DialogHeader>
        <style>{`label[for="r-banner"], #r-banner { display: none; }`}</style>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="r-name">Nom du restaurant *</Label>
            <Input
              id="r-name"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex: Le Dakarois"
              required
              maxLength={200}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-slug">Slug URL *</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">/menu/</span>
              <Input
                id="r-slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="le-dakarois"
                required
                maxLength={100}
                disabled={saving}
                className="lowercase"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Auto-généré à partir du nom. Minuscules, chiffres et tirets uniquement.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-email">Email du gerant *</Label>
            <Input
              id="r-email"
              type="email"
              value={form.managerEmail}
              onChange={(e) => setForm({ ...form, managerEmail: e.target.value })}
              placeholder="gerant@restaurant.sn"
              required
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-password">Mot de passe temporaire *</Label>
            <Input
              id="r-password"
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Resto2026!"
              required
              minLength={6}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-banner">URL de la bannière (optionnel)</Label>
            <Input
              id="r-banner"
              value={form.bannerUrl}
              onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
              placeholder="https://exemple.com/banner.jpg"
              disabled={saving}
            />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={
                saving ||
                !form.name.trim() ||
                !form.slug.trim() ||
                !form.managerEmail.trim() ||
                form.password.length < 6
              }
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Création...
                </span>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Créer le restaurant
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onSuccess,
  restaurants,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  restaurants: RestaurantRow[];
}) {
  const [form, setForm] = useState<CreateUserForm>({
    name: "",
    email: "",
    password: "",
    restaurantId: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email || !form.password || !form.restaurantId) return;
    setSaving(true);

    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          restaurantId: form.restaurantId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Erreur de création");
        return;
      }

      toast.success(data.message || "Compte créé avec succès");
      setForm({ name: "", email: "", password: "", restaurantId: "" });
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Inviter un restaurateur</DialogTitle>
          <DialogDescription>
            Créez le compte du premier restaurateur lié à un restaurant existant.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="u-name">Nom complet *</Label>
            <Input
              id="u-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Chez Ami"
              required
              maxLength={200}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-email">Email *</Label>
            <Input
              id="u-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="restaurateur@ledakarois.sn"
              required
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-pass">Mot de passe * <span className="text-muted-foreground font-normal">(min. 6 caractères)</span></Label>
            <Input
              id="u-pass"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
              minLength={6}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label>Restaurant *</Label>
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
              {restaurants.map((r) => (
                <label
                  key={r.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${form.restaurantId === r.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}
                  `}
                >
                  <input
                    type="radio"
                    name="restaurant"
                    value={r.id}
                    checked={form.restaurantId === r.id}
                    onChange={(e) => setForm({ ...form, restaurantId: e.target.value })}
                    className="sr-only"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground">/{r.slug}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {r._count.users} user{r._count.users > 1 ? "s" : ""}
                  </Badge>
                </label>
              ))}
              {restaurants.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun restaurant. Créez-en un d&apos;abord.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim() || !form.email || !form.password || !form.restaurantId}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Création...
                </span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-1.5" />
                  Créer le compte
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page principale ────────────────────────────────────────────────────────

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createRestoOpen, setCreateRestoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const isAdminSession = !!adminSession;

  // Protection côté client (double sécurité avec le middleware serveur)
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
      router.push("/login");
    } else if (!adminSession && status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, adminSession, workspaceSessionChecked, router]);

  const fetchRestaurants = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "restaurants"));
      const nextRestaurants = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          const countData =
            data._count &&
            typeof data._count === "object" &&
            !Array.isArray(data._count)
              ? (data._count as Record<string, unknown>)
              : {};

          return {
            id: docSnap.id,
            slug: typeof data.slug === "string" ? data.slug : "",
            name: typeof data.name === "string" ? data.name : "Restaurant",
            logoUrl: typeof data.logoUrl === "string" ? data.logoUrl : null,
            bannerUrl: typeof data.bannerUrl === "string" ? data.bannerUrl : null,
            isSuspended: data.status === "suspended" || Boolean(data.isSuspended),
            createdAt: normalizeFirestoreDate(data.createdAt),
            _count: {
              categories: Number(countData.categories ?? data.categoriesCount ?? 0),
              items: Number(countData.items ?? data.itemsCount ?? 0),
              users: Number(countData.users ?? data.usersCount ?? 0),
            },
          };
        })
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      setRestaurants(nextRestaurants);
    } catch (error) {
      console.error("Erreur de lecture Firestore restaurants :", error);
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdminSession) {
      fetchRestaurants();
    }
  }, [isAdminSession, fetchRestaurants]);

  // ─── Loading ───────────────────────────────────────────────────────────

  async function toggleRestaurantSuspension(restaurant: RestaurantRow, isActive: boolean) {
    const nextIsSuspended = !isActive;
    const nextStatus = nextIsSuspended ? "suspended" : "active";
    setRestaurants((current) =>
      current.map((item) =>
        item.id === restaurant.id ? { ...item, isSuspended: nextIsSuspended } : item
      )
    );

    try {
      await updateDoc(doc(db, "restaurants", restaurant.id), {
        status: nextStatus,
        isSuspended: nextIsSuspended,
        updatedAt: new Date().toISOString(),
      });

      toast.success(nextIsSuspended ? "Restaurant suspendu" : "Restaurant reactive");
    } catch (error) {
      setRestaurants((current) =>
        current.map((item) =>
          item.id === restaurant.id ? { ...item, isSuspended: restaurant.isSuspended } : item
        )
      );
      toast.error(error instanceof Error ? error.message : "Erreur reseau");
    }
  }

  const handleSignOut = useCallback(() => {
    clearWorkspaceSession("admin");
    void signOut({ callbackUrl: "/login" });
  }, []);

  if (((status === "loading" || !workspaceSessionChecked) && !adminSession) || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-sm text-muted-foreground">Chargement de l&apos;administration...</p>
        </div>
      </div>
    );
  }

  if (!adminSession || status === "unauthenticated") return null;

  const totalItems = restaurants.reduce((acc, r) => acc + r._count.items, 0);
  const totalUsers = restaurants.reduce((acc, r) => acc + r._count.users, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h1 className="font-semibold text-sm sm:text-base">Administration — Super Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {adminSession.email}
            </span>
            <Badge variant="outline" className="text-[10px]">
              SUPER_ADMIN
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Parametres</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Statistiques globales */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Building2} label="Restaurants" value={restaurants.length} />
          <StatCard icon={UtensilsCrossed} label="Plats total" value={totalItems} />
          <StatCard icon={Users} label="Utilisateurs" value={totalUsers} />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setCreateRestoOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Nouveau restaurant
          </Button>
        </div>

        <Separator />

        {/* Tableau des restaurants */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Tous les restaurants</h2>

          {restaurants.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mb-4">
                Aucun restaurant créé pour le moment
              </p>
              <Button onClick={() => setCreateRestoOpen(true)} size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                Créer le premier restaurant
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead className="hidden sm:table-cell">Slug</TableHead>
                    <TableHead className="text-center">Catégories</TableHead>
                    <TableHead className="text-center">Plats</TableHead>
                    <TableHead className="text-center">Users</TableHead>
                    <TableHead className="text-center">Statut du compte</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Menu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {restaurants.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {r.logoUrl ? (
                            <img src={r.logoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {r.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate max-w-[200px]">{r.name}</p>
                            <p className="text-[11px] text-muted-foreground hidden sm:block">
                              {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/{r.slug}</code>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{r._count.categories}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{r._count.items}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{r._count.users}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center gap-1">
                          <Switch
                            checked={!r.isSuspended}
                            onCheckedChange={(checked) => toggleRestaurantSuspension(r, checked)}
                            aria-label={`Statut du compte ${r.name}`}
                          />
                          <span className={r.isSuspended ? "text-[11px] font-medium text-red-600" : "text-[11px] font-medium text-emerald-600"}>
                            {r.isSuspended ? "Suspendu" : "Actif"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => window.open(`/menu/${r.slug}`, "_blank")}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Voir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Note de sécurité */}
        {false && (
        <div className="hidden">
          <p className="font-medium text-foreground/70">Architecture de sécurité</p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>Le middleware vérifie le rôle <code className="bg-muted px-1 rounded">super_admin</code> côté serveur avant le rendu de cette page.</li>
            <li>Les API routes valident le rôle JWT + le restaurantId. Un restaurateur ne peut jamais accéder aux données d&apos;un autre restaurant.</li>
          </ul>
        </div>
        )}
      </main>

      {/* Dialogs */}
      <CreateRestaurantDialog
        open={createRestoOpen}
        onOpenChange={setCreateRestoOpen}
        onSuccess={(restaurant) =>
          setRestaurants((current) => [
            restaurant,
            ...current.filter((item) => item.id !== restaurant.id),
          ])
        }
      />
      <PasswordSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
