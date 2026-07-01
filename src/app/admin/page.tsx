"use client";

import { useState, useEffect, useCallback } from "react";
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
  bannerUrl: string;
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
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<CreateRestaurantForm>({
    name: "",
    slug: "",
    managerEmail: "",
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
    if (!form.name.trim() || !form.slug.trim() || !form.managerEmail.trim()) return;
    setSaving(true);

    try {
      const res = await fetch("/api/admin/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          managerEmail: form.managerEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Erreur de création");
        return;
      }

      toast.success(`Restaurant "${data.name}" créé avec ${data.categories.length} catégories`);
      setForm({ name: "", slug: "", managerEmail: "", bannerUrl: "" });
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
            <Button type="submit" disabled={saving || !form.name.trim() || !form.slug.trim() || !form.managerEmail.trim()}>
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
  const isAdminSession =
    session?.user?.role === "super_admin" || session?.user?.role === "admin";

  // Protection côté client (double sécurité avec le middleware serveur)
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && !isAdminSession) {
      router.push("/dashboard");
    }
  }, [status, isAdminSession, router]);

  const fetchRestaurants = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/restaurants");
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setRestaurants(data.restaurants || []);
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (status === "authenticated" && isAdminSession) {
      fetchRestaurants();
    }
  }, [status, isAdminSession, fetchRestaurants]);

  // ─── Loading ───────────────────────────────────────────────────────────

  async function toggleRestaurantSuspension(restaurant: RestaurantRow, isActive: boolean) {
    const nextIsSuspended = !isActive;
    setRestaurants((current) =>
      current.map((item) =>
        item.id === restaurant.id ? { ...item, isSuspended: nextIsSuspended } : item
      )
    );

    try {
      const res = await fetch(`/api/admin/restaurants/${restaurant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuspended: nextIsSuspended }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur de mise a jour");
      }

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

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-sm text-muted-foreground">Chargement de l&apos;administration...</p>
        </div>
      </div>
    );
  }

  if (!session || !isAdminSession) return null;

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
              {session.user?.email}
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
              onClick={() => signOut({ callbackUrl: "/login" })}
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
        onSuccess={fetchRestaurants}
      />
      <PasswordSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
