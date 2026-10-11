"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { defaultMarketingSettings, marketingRequest, readMarketingImage, settingsSchema, testimonialSchema, type MarketingData, type MarketingSettings, type Testimonial } from "@/lib/marketing";

const emptyReview = { restaurantName: "", ownerName: "", comment: "", rating: 5, avatarBase64: "", isActive: true };

export default function MarketingAdminPage() {
  const { data: session, status } = useSession();
  const [reviews, setReviews] = useState<Testimonial[]>([]);
  const [settings, setSettings] = useState<MarketingSettings>(defaultMarketingSettings);
  const [form, setForm] = useState(emptyReview);
  const [editing, setEditing] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const allowed = session?.user?.role === "super_admin";

  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    marketingRequest<MarketingData>("/api/admin/marketing", { signal: controller.signal }).then((data) => {
      setReviews(data.testimonials); setSettings(data.settings); setReady(true);
    }).catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [allowed]);

  async function save(body: unknown, success: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      await marketingRequest("/api/admin/marketing", { method: "POST", body: JSON.stringify(body) });
      setMessage(success);
      const data = await marketingRequest<MarketingData>("/api/admin/marketing");
      setReviews(data.testimonials);
      return true;
    } catch (err) { setError(err instanceof Error ? err.message : "Une erreur est survenue."); return false; }
    finally { setBusy(false); }
  }
  async function submitReview(event: FormEvent) {
    event.preventDefault();
    const valid = testimonialSchema.safeParse(form);
    if (!valid.success) { setError("Complétez les champs et choisissez une note entre 1 et 5."); return; }
    if (await save({ action: editing ? "update" : "create", ...(editing ? { id: editing } : {}), data: valid.data }, "Avis enregistré.")) {
      setForm(emptyReview); setEditing(null);
    }
  }
  async function upload(file: File | undefined, target: "avatar" | "demo") {
    if (!file) return;
    setImageBusy(true); setError("");
    try {
      const base64 = await readMarketingImage(file);
      if (target === "avatar") setForm((old) => ({ ...old, avatarBase64: base64 }));
      else setSettings((old) => ({ ...old, demoImageBase64: base64 }));
    } catch (err) { setError(err instanceof Error ? err.message : "Image invalide."); }
    finally { setImageBusy(false); }
  }
  if (status === "loading") return <p className="p-8">Chargement…</p>;
  if (!allowed) return <p className="p-8">Accès réservé au super administrateur.</p>;
  return <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
    <Link href="/admin" className="text-primary underline">← Dashboard Admin</Link>
    <h1 className="text-3xl font-bold">Gestion Landing Page</h1>
    <p className="text-muted-foreground">Les sauvegardes sont appliquées immédiatement dans Firestore. La page de connexion actualise son contenu toutes les 30 secondes.</p>
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>}
    {!ready && !error && <p>Chargement du contenu marketing…</p>}
    <fieldset disabled={!ready || busy || imageBusy} className="space-y-6 disabled:opacity-60">
      <legend className="sr-only">Modifier le contenu marketing</legend>
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Avis clients</h2>
        <form onSubmit={submitReview} className="grid gap-4 md:grid-cols-2">
          <div><Label htmlFor="restaurant">Nom du restaurant</Label><Input id="restaurant" required maxLength={120} value={form.restaurantName} onChange={(e) => setForm({ ...form, restaurantName: e.target.value })} /></div>
          <div><Label htmlFor="owner">Nom du gérant</Label><Input id="owner" required maxLength={120} value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} /></div>
          <div><Label htmlFor="rating">Note sur 5</Label><Input id="rating" type="number" min={1} max={5} step={1} required value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} /></div>
          <div><Label htmlFor="avatar">Photo (PNG, JPEG, WebP, 500 Ko max.)</Label><Input id="avatar" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { void upload(e.target.files?.[0], "avatar"); e.target.value = ""; }} /></div>
          <div className="md:col-span-2"><Label htmlFor="comment">Texte de l’avis</Label><Textarea id="comment" required maxLength={2000} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></div>
          {form.avatarBase64 && <div><img src={form.avatarBase64} alt="Photo sélectionnée" className="h-16 w-16 rounded-full object-cover" /><Button type="button" variant="outline" onClick={() => setForm({ ...form, avatarBase64: "" })}>Retirer la photo</Button></div>}
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />Afficher sur la landing page</label>
          <div className="flex gap-2 md:col-span-2"><Button type="submit">{editing ? "Enregistrer les modifications" : "Ajouter l’avis"}</Button>{editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setForm(emptyReview); }}>Annuler</Button>}</div>
        </form>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Avis clients enregistrés</caption><thead><tr><th className="p-2">Restaurant / Gérant</th><th className="p-2">Avis</th><th className="p-2">Note</th><th className="p-2">Statut</th><th className="p-2">Actions</th></tr></thead><tbody>
          {reviews.map((review) => <tr key={review.id} className="border-t"><td className="p-2">{review.restaurantName}<br />{review.ownerName}</td><td className="max-w-xs break-words p-2">{review.comment}</td><td className="p-2">{review.rating}/5</td><td className="p-2">{review.isActive ? "Actif" : "Inactif"}</td><td className="p-2"><div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => { setEditing(review.id); setForm({ restaurantName: review.restaurantName, ownerName: review.ownerName, comment: review.comment, rating: review.rating, avatarBase64: review.avatarBase64, isActive: review.isActive }); }}>Modifier</Button>
            <Button type="button" variant="outline" onClick={() => void save({ action: "toggle", id: review.id, isActive: !review.isActive }, "Statut mis à jour.")}>{review.isActive ? "Désactiver" : "Activer"}</Button>
            <Button type="button" variant="destructive" onClick={async () => { if (window.confirm(`Supprimer l’avis de ${review.restaurantName} ?`)) { if (await save({ action: "delete", id: review.id }, "Avis supprimé.") && editing === review.id) { setEditing(null); setForm(emptyReview); } } }}>Supprimer</Button>
          </div></td></tr>)}
          {!reviews.length && <tr><td colSpan={5} className="p-4 text-muted-foreground">Aucun avis enregistré.</td></tr>}
        </tbody></table></div>
      </section>
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Configuration Contact & Démo</h2>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); const parsed = settingsSchema.safeParse(settings); if (!parsed.success) { setError("Vérifiez le numéro international et les statistiques (satisfaction entre 0 et 100). "); return; } void save({ action: "settings", data: parsed.data }, "Configuration enregistrée."); }}>
          <div><Label htmlFor="whatsapp">Numéro WhatsApp international</Label><Input id="whatsapp" placeholder="221XXXXXXXXX" inputMode="numeric" pattern="[1-9][0-9]{7,14}" maxLength={15} value={settings.whatsappNumber} onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })} /><p className="text-xs text-muted-foreground">Sans + ni espaces. Videz ce champ pour masquer le bouton.</p></div>
          <div><Label htmlFor="demo">Visuel de démo (500 Ko max.)</Label><Input id="demo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { void upload(e.target.files?.[0], "demo"); e.target.value = ""; }} /></div>
          <div className="md:col-span-2"><Label htmlFor="message">Texte d’accroche / message WhatsApp</Label><Textarea id="message" maxLength={1000} value={settings.defaultMessage} onChange={(e) => setSettings({ ...settings, defaultMessage: e.target.value })} /></div>
          <div><Label htmlFor="total">Nombre de restaurants</Label><Input id="total" type="number" required min={0} max={1000000} step={1} value={settings.stats.totalRestaurants} onChange={(e) => setSettings({ ...settings, stats: { ...settings.stats, totalRestaurants: Number(e.target.value) } })} /></div>
          <div><Label htmlFor="satisfaction">Satisfaction (%)</Label><Input id="satisfaction" type="number" required min={0} max={100} step="any" value={settings.stats.satisfactionRate} onChange={(e) => setSettings({ ...settings, stats: { ...settings.stats, satisfactionRate: Number(e.target.value) } })} /></div>
          {settings.demoImageBase64 && <div className="md:col-span-2"><img src={settings.demoImageBase64} alt="Aperçu de la démonstration" className="max-h-60 rounded-lg object-contain" /><Button type="button" variant="outline" onClick={() => setSettings({ ...settings, demoImageBase64: "" })}>Retirer le visuel</Button></div>}
          <Button type="submit" className="md:col-span-2">Enregistrer la configuration</Button>
        </form>
      </section>
    </fieldset>
    {(busy || imageBusy) && <p role="status">{imageBusy ? "Lecture de l’image…" : "Enregistrement…"}</p>}
  </main>;
}
