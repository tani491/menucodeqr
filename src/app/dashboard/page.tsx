"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db as firestoreDb, storage as firebaseStorage } from "@/lib/firebaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import QRCode from "qrcode";
import {
  Plus,
  Pencil,
  Trash2,
  LogOut,
  QrCode,
  Download,
  Loader2,
  ImageIcon,
  Video,
  Upload,
  Check,
  Package,
  X,
  ExternalLink,
  Settings,
  ClipboardList,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  nameFr: string;
  nameEn: string;
  sortOrder: number;
  restaurantId: string;
}

interface MenuItem {
  id: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string | null;
  descriptionEn: string | null;
  price: number;
  imageUrl: string | null;
  videoUrl: string | null;
  isAvailable: boolean;
  categoryId: string;
  createdAt: string;
  sourceCollection?: "dishes" | "items";
}

interface MenuResponse {
  categories: Category[];
  items: MenuItem[];
  restaurantId: string;
  restaurantName?: string;
  restaurantSlug?: string;
  restaurantLogoUrl?: string | null;
  restaurantBannerUrl?: string | null;
  restaurantPrimaryColor?: string;
  restaurantIsSuspended?: boolean;
}

interface ItemFormData {
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  price: string;
  categoryId: string;
  imageUrl: string;
  videoUrl: string;
  imageFile: File | null;
  videoFile: File | null;
  sourceCollection?: "dishes" | "items";
  isAvailable: boolean;
}

const EMPTY_FORM: ItemFormData = {
  nameFr: "",
  nameEn: "",
  descriptionFr: "",
  descriptionEn: "",
  price: "",
  categoryId: "",
  imageUrl: "",
  videoUrl: "",
  imageFile: null,
  videoFile: null,
  isAvailable: true,
};

// ─── QR Code Section ────────────────────────────────────────────────────────

type FirestoreRecord = Record<string, unknown>;

const FIRESTORE_DASHBOARD_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function nullableStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
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

async function getDashboardMenuFromFirestore(userId: string): Promise<MenuResponse | null> {
  const restaurantsSnapshot = await getDocs(
    query(collection(firestoreDb, "restaurants"), where("userId", "==", userId))
  );

  const restaurantDoc = restaurantsSnapshot.docs[0];
  if (!restaurantDoc) return null;

  const restaurantData = restaurantDoc.data() as FirestoreRecord;
  const restaurantId = stringValue(restaurantData.id, restaurantDoc.id);

  const [categoriesSnapshot, dishesSnapshot, itemsSnapshot] = await Promise.all([
    getDocs(query(collection(firestoreDb, "categories"), where("restaurantId", "==", restaurantId))),
    getDocs(query(collection(firestoreDb, "dishes"), where("restaurantId", "==", restaurantId))),
    getDocs(query(collection(firestoreDb, "items"), where("restaurantId", "==", restaurantId))),
  ]);

  const categories: Category[] = categoriesSnapshot.docs
    .map((categoryDoc) => {
      const category = categoryDoc.data() as FirestoreRecord;

      return {
        id: stringValue(category.id, categoryDoc.id),
        nameFr: stringValue(category.nameFr, "Categorie"),
        nameEn: stringValue(category.nameEn, ""),
        sortOrder: numberValue(category.sortOrder),
        restaurantId,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const dishIds = new Set(dishesSnapshot.docs.map((dishDoc) => dishDoc.id));
  const itemDocs = [
    ...dishesSnapshot.docs.map((docSnap) => ({ docSnap, sourceCollection: "dishes" as const })),
    ...itemsSnapshot.docs
      .filter((docSnap) => !dishIds.has(docSnap.id))
      .map((docSnap) => ({ docSnap, sourceCollection: "items" as const })),
  ];

  const items: MenuItem[] = itemDocs
    .map(({ docSnap: itemDoc, sourceCollection }) => {
      const item = itemDoc.data() as FirestoreRecord;
      const status = typeof item.status === "string" ? item.status : "";

      return {
        id: stringValue(item.id, itemDoc.id),
        nameFr: stringValue(item.nameFr, stringValue(item.name, "Plat")),
        nameEn: stringValue(item.nameEn, stringValue(item.name, "")),
        descriptionFr: nullableStringValue(item.descriptionFr) || nullableStringValue(item.description),
        descriptionEn: nullableStringValue(item.descriptionEn),
        price: numberValue(item.price),
        imageUrl: nullableStringValue(item.imageUrl),
        videoUrl: nullableStringValue(item.videoUrl),
        isAvailable: status ? status === "available" : booleanValue(item.isAvailable, true),
        categoryId: stringValue(item.categoryId, stringValue(item.category)),
        createdAt: dateStringValue(item.createdAt),
        sourceCollection,
      };
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return {
    categories,
    items,
    restaurantId,
    restaurantName: stringValue(restaurantData.name, "Restaurant"),
    restaurantSlug: stringValue(restaurantData.slug),
    restaurantLogoUrl: nullableStringValue(restaurantData.logoUrl),
    restaurantBannerUrl: nullableStringValue(restaurantData.bannerUrl),
    restaurantPrimaryColor: stringValue(restaurantData.primaryColor, "#000000"),
    restaurantIsSuspended: booleanValue(restaurantData.isSuspended),
  };
}

function cleanStorageFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

async function uploadDishFile(file: File, restaurantId: string, type: "images" | "videos") {
  const filename = `${Date.now()}_${cleanStorageFileName(file.name)}`;
  const fileRef = ref(firebaseStorage, `dishes/${restaurantId}/${type}/${filename}`);

  await uploadBytes(fileRef, file, { contentType: file.type });
  return getDownloadURL(fileRef);
}

function QrCodeSection({ restaurantSlug }: { restaurantSlug?: string | null }) {
  const [qrPngUrl, setQrPngUrl] = useState<string | null>(null);
  const [qrSvgUrl, setQrSvgUrl] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState("1");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQrPngUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
    setQrSvgUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
  }, [restaurantSlug, tableNumber]);

  const generateQr = useCallback(async (format: "png" | "svg") => {
    if (!restaurantSlug) {
      toast.error("Slug restaurant introuvable");
      return;
    }

    setLoading(true);
    try {
      const targetUrl = `${window.location.origin}/menu/${restaurantSlug}?table=${encodeURIComponent(tableNumber || "1")}`;

      if (format === "png") {
        const url = await QRCode.toDataURL(targetUrl, {
          width: 1024,
          margin: 2,
          errorCorrectionLevel: "M",
        });
        setQrPngUrl(url);
      } else {
        const svg = await QRCode.toString(targetUrl, {
          type: "svg",
          margin: 2,
          errorCorrectionLevel: "M",
        });
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        if (qrSvgUrl) URL.revokeObjectURL(qrSvgUrl);
        setQrSvgUrl(url);
      }
    } catch {
      toast.error("Erreur de génération du QR code");
    } finally {
      setLoading(false);
    }
  }, [qrSvgUrl, restaurantSlug, tableNumber]);

  const download = useCallback((url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }, []);

  return (
    <div className="space-y-4">
      <div className="max-w-xs space-y-2">
        <Label htmlFor="qr-table-number">Numero de table</Label>
        <Input
          id="qr-table-number"
          value={tableNumber}
          onChange={(e) =>
            setTableNumber(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20) || "1")
          }
          disabled={loading}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => generateQr("png")}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          <QrCode className="w-4 h-4 mr-1.5" />
          {loading ? "Génération..." : "Générer QR PNG"}
        </Button>
        <Button
          onClick={() => generateQr("svg")}
          disabled={loading}
          variant="outline"
          size="sm"
        >
          <QrCode className="w-4 h-4 mr-1.5" />
          {loading ? "Génération..." : "Générer QR SVG"}
        </Button>
      </div>
      {(qrPngUrl || qrSvgUrl) && (
        <div className="flex flex-wrap gap-4">
          {qrPngUrl && (
            <div className="text-center">
              <img
                key={`png-${restaurantSlug || "restaurant"}-${tableNumber}-${qrPngUrl}`}
                src={qrPngUrl}
                alt="QR Code PNG"
                className="w-40 h-40 rounded-lg border"
              />
              <p className="text-xs text-muted-foreground mt-1">PNG (1024px)</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => download(qrPngUrl, `qrcode-${restaurantSlug || "menu"}-table-${tableNumber}.png`)}
                className="text-xs"
              >
                <Download className="w-3 h-3 mr-1" /> Télécharger
              </Button>
            </div>
          )}
          {qrSvgUrl && (
            <div className="text-center">
              <img
                key={`svg-${restaurantSlug || "restaurant"}-${tableNumber}-${qrSvgUrl}`}
                src={qrSvgUrl}
                alt="QR Code SVG"
                className="w-40 h-40 rounded-lg border bg-white"
              />
              <p className="text-xs text-muted-foreground mt-1">SVG (vectoriel)</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => download(qrSvgUrl, `qrcode-${restaurantSlug || "menu"}-table-${tableNumber}.svg`)}
                className="text-xs"
              >
                <Download className="w-3 h-3 mr-1" /> Télécharger
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── File Upload Field ──────────────────────────────────────────────────────

function FileUploadField({
  label,
  accept,
  maxSizeMb,
  value,
  onChange,
  disabled = false,
  icon: Icon,
}: {
  label: string;
  accept: string;
  maxSizeMb: number;
  value: string;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  icon: React.ElementType;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${maxSizeMb} Mo)`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    onChange(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          ref={fileRef}
          type="file"
          accept={accept}
          onChange={handleFile}
          disabled={disabled}
          className="flex-1 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-4 h-4" />
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      {value && (
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground truncate max-w-[300px]">{value}</span>
          <Check className="w-3.5 h-3.5 text-green-600" />
        </div>
      )}
    </div>
  );
}

// ─── Item Form Dialog ──────────────────────────────────────────────────────

function RestaurantMediaSection({
  restaurantId,
  logoUrl,
  bannerUrl,
  primaryColor: savedPrimaryColor,
  onSaved,
}: {
  restaurantId: string;
  logoUrl: string | null | undefined;
  bannerUrl: string | null | undefined;
  primaryColor: string | undefined;
  onSaved: () => void;
}) {
  const [logo, setLogo] = useState(logoUrl || "");
  const [banner, setBanner] = useState(bannerUrl || "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState(savedPrimaryColor || "#000000");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLogo(logoUrl || "");
    setBanner(bannerUrl || "");
    setPrimaryColor(savedPrimaryColor || "#000000");
  }, [logoUrl, bannerUrl, savedPrimaryColor]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [logoPreview, bannerPreview]);

  function selectLogo(file: File | null) {
    setLogoFile(file);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  function selectBanner(file: File | null) {
    setBannerFile(file);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(file ? URL.createObjectURL(file) : null);
  }

  async function uploadRestaurantMedia(file: File, type: "logo" | "banner") {
    if (!restaurantId) {
      throw new Error("L'identifiant du restaurant est manquant.");
    }

    const filename = `${Date.now()}_${cleanStorageFileName(file.name)}`;
    const fileRef = ref(firebaseStorage, `restaurant-medias/${restaurantId}/${type}/${filename}`);

    await uploadBytes(fileRef, file, { contentType: file.type });
    return getDownloadURL(fileRef);
  }

  async function handleSave() {
    setSaving(true);

    try {
      const nextLogo = logoFile ? await uploadRestaurantMedia(logoFile, "logo") : logo;
      const nextBanner = bannerFile ? await uploadRestaurantMedia(bannerFile, "banner") : banner;

      const res = await fetch("/api/dashboard/restaurant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: nextLogo || null,
          bannerUrl: nextBanner || null,
          primaryColor,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Erreur de mise a jour");
        return;
      }

      toast.success("Identite du restaurant mise a jour");
      setLogo(nextLogo || "");
      setBanner(nextBanner || "");
      setLogoFile(null);
      setBannerFile(null);
      selectLogo(null);
      selectBanner(null);
      onSaved();
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-semibold text-sm">Identite du restaurant</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Logo et banniere du menu public
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          {(logoPreview || logo) && (
            <img
              src={logoPreview || logo}
              alt="Logo actuel"
              className="h-20 w-20 rounded-lg border object-cover"
            />
          )}
          <div className="space-y-2">
            <Label htmlFor="restaurant-logo">Logo du restaurant</Label>
            <Input
              id="restaurant-logo"
              type="file"
              accept="image/*"
              disabled={saving}
              onChange={(e) => selectLogo(e.target.files?.[0] || null)}
              className="text-sm"
            />
          </div>
          {logo && !logoFile && (
            <p className="text-xs text-muted-foreground truncate">{logo}</p>
          )}
        </div>
        <div className="space-y-3">
          {(bannerPreview || banner) && (
            <img
              src={bannerPreview || banner}
              alt="Banniere actuelle"
              className="h-24 w-full rounded-lg border object-cover"
            />
          )}
          <div className="space-y-2">
            <Label htmlFor="restaurant-banner">Banniere du restaurant</Label>
            <Input
              id="restaurant-banner"
              type="file"
              accept="image/*"
              disabled={saving}
              onChange={(e) => selectBanner(e.target.files?.[0] || null)}
              className="text-sm"
            />
          </div>
          {banner && !bannerFile && (
            <p className="text-xs text-muted-foreground truncate">{banner}</p>
          )}
        </div>
      </div>
      <div className="max-w-xs space-y-2">
        <Label htmlFor="restaurant-primary-color">Couleur de marque</Label>
        <div className="flex items-center gap-3">
          <Input
            id="restaurant-primary-color"
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            disabled={saving}
            className="h-10 w-16 p-1"
          />
          <span className="text-sm font-medium tabular-nums">{primaryColor}</span>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        onClick={handleSave}
        disabled={
          saving ||
          (!logoFile &&
            !bannerFile &&
            logo === (logoUrl || "") &&
            banner === (bannerUrl || "") &&
            primaryColor === (savedPrimaryColor || "#000000"))
        }
      >
        {saving ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Enregistrement...
          </span>
        ) : (
          "Enregistrer les medias"
        )}
      </Button>
    </section>
  );
}

function ItemFormDialog({
  categories,
  editingItem,
  onSubmit,
  open,
  onOpenChange,
}: {
  categories: Category[];
  editingItem: MenuItem | null;
  onSubmit: (data: ItemFormData, id?: string) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEditing = !!editingItem;
  const [form, setForm] = useState<ItemFormData>(() =>
    editingItem
      ? {
          nameFr: editingItem.nameFr,
          nameEn: editingItem.nameEn,
          descriptionFr: editingItem.descriptionFr || "",
          descriptionEn: editingItem.descriptionEn || "",
          price: String(editingItem.price),
          categoryId: editingItem.categoryId,
          imageUrl: editingItem.imageUrl || "",
          videoUrl: editingItem.videoUrl || "",
          imageFile: null,
          videoFile: null,
          sourceCollection: editingItem.sourceCollection,
          isAvailable: editingItem.isAvailable,
        }
      : { ...EMPTY_FORM, categoryId: categories[0]?.id || "" }
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nameFr.trim() || !form.price || !form.categoryId) return;

    try {
      setSaving(true);
      await onSubmit(form, editingItem?.id);
    } catch (error) {
      console.error("Erreur lors de l'ajout du plat :", error);
      toast.error("Une erreur est survenue lors de la creation du plat.");
    } finally {
      setSaving(false);
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!saving) onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Modifier le plat" : "Ajouter un plat"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifiez les informations du plat ci-dessous."
              : "Remplissez les informations du nouveau plat."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ─── Nom Français ─── */}
          <div className="space-y-2">
            <Label htmlFor="item-name-fr">Nom en français *</Label>
            <Input
              id="item-name-fr"
              value={form.nameFr}
              onChange={(e) => setForm({ ...form, nameFr: e.target.value })}
              placeholder="Ex: Thieboudienne"
              required
              maxLength={200}
              disabled={saving}
            />
          </div>

          {/* ─── Nom Anglais ─── */}
          <div className="space-y-2">
            <Label htmlFor="item-name-en">Nom en anglais</Label>
            <Input
              id="item-name-en"
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              placeholder="Ex: Thieboudienne (Rice and Fish)"
              maxLength={200}
              disabled={saving}
            />
          </div>

          {/* ─── Description FR ─── */}
          <div className="space-y-2">
            <Label htmlFor="item-desc-fr">Description (français)</Label>
            <Input
              id="item-desc-fr"
              value={form.descriptionFr}
              onChange={(e) => setForm({ ...form, descriptionFr: e.target.value })}
              placeholder="Description courte du plat"
              maxLength={2000}
              disabled={saving}
            />
          </div>

          {/* ─── Description EN ─── */}
          <div className="space-y-2">
            <Label htmlFor="item-desc-en">Description (anglais)</Label>
            <Input
              id="item-desc-en"
              value={form.descriptionEn}
              onChange={(e) => setForm({ ...form, descriptionEn: e.target.value })}
              placeholder="Short dish description"
              maxLength={2000}
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item-price">Prix (FCFA) *</Label>
              <Input
                id="item-price"
                type="number"
                step="0.01"
                min="0"
                max="99999"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0.00"
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-cat">Catégorie *</Label>
              <Select
                value={form.categoryId}
                onValueChange={(val) => setForm({ ...form, categoryId: val })}
                disabled={saving}
              >
                <SelectTrigger id="item-cat">
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.nameFr} / {cat.nameEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Image upload */}
          <FileUploadField
            label="Image du plat"
            accept="image/jpeg,image/webp"
            maxSizeMb={5}
            value={form.imageFile?.name || form.imageUrl}
            onChange={(file) =>
              setForm({ ...form, imageFile: file, imageUrl: file ? form.imageUrl : "" })
            }
            disabled={saving}
            icon={ImageIcon}
          />

          {/* Video upload */}
          <FileUploadField
            label="Vidéo courte (optionnel)"
            accept="video/mp4"
            maxSizeMb={10}
            value={form.videoFile?.name || form.videoUrl}
            onChange={(file) =>
              setForm({ ...form, videoFile: file, videoUrl: file ? form.videoUrl : "" })
            }
            disabled={saving}
            icon={Video}
          />

          {/* Disponibilité */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="item-avail"
              checked={form.isAvailable}
              onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              disabled={saving}
            />
            <Label htmlFor="item-avail" className="cursor-pointer">
              Disponible sur le menu public
            </Label>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving || !form.nameFr.trim() || !form.price || !form.categoryId}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isEditing ? "Mise à jour..." : "Ajout..."}
                </span>
              ) : isEditing ? (
                "Enregistrer"
              ) : (
                "Ajouter le plat"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page principale ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<MenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [setupPending, setSetupPending] = useState(false);

  // ─── Protection côté client ────────────────────────────────────────────
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    else if (
      status === "authenticated" &&
      (session?.user?.role === "super_admin" || session?.user?.role === "admin")
    )
      router.push("/admin");
  }, [status, session, router]);

  // ─── Chargement du menu ───────────────────────────────────────────────
  const fetchMenu = useCallback(async () => {
    const userId = session?.user?.id;

    if (!userId) {
      setData(null);
      setLoadError("Session utilisateur incomplete.");
      setSetupPending(true);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);

      const firestoreData = await withTimeout(
        getDashboardMenuFromFirestore(userId),
        FIRESTORE_DASHBOARD_TIMEOUT_MS,
        "Delai depasse lors du chargement Firestore."
      );

      if (!firestoreData) {
        console.log("Aucun restaurant trouve pour cet UID", userId);
        setData(null);
        setLoadError("Aucun restaurant n'est associe a votre compte.");
        setSetupPending(true);
        return;
      }

      setSetupPending(false);
      setData(firestoreData);
    } catch (err) {
      console.error("Erreur lors du chargement du restaurant:", err);
      setData(null);
      setLoadError("Impossible de charger les donnees du restaurant.");
      setSetupPending(true);
      toast.error("Impossible de charger les donnees du restaurant");
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "restaurateur") {
      fetchMenu();
    }
  }, [status, session?.user?.role, fetchMenu]);

  // ─── Actions ──────────────────────────────────────────────────────────
  const openCreate = useCallback(() => {
    setEditingItem(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((item: MenuItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  }, []);

  const handleToggle = useCallback(
    async (targetItem: MenuItem) => {
      const itemId = targetItem.id;
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) =>
                item.id === itemId ? { ...item, isAvailable: !item.isAvailable } : item
              ),
            }
          : null
      );

      try {
        await updateDoc(doc(firestoreDb, targetItem.sourceCollection || "dishes", itemId), {
          isAvailable: !targetItem.isAvailable,
          status: targetItem.isAvailable ? "unavailable" : "available",
          updatedAt: new Date().toISOString(),
        });
      } catch {
        fetchMenu();
      }
    },
    [fetchMenu]
  );

  const handleDelete = useCallback(
    async (targetItem: MenuItem) => {
      const itemId = targetItem.id;
      setData((prev) =>
        prev ? { ...prev, items: prev.items.filter((item) => item.id !== itemId) } : null
      );

      try {
        await deleteDoc(doc(firestoreDb, targetItem.sourceCollection || "dishes", itemId));
        toast.success(`\"${targetItem.nameFr}\" supprimé`);
      } catch {
        fetchMenu();
        toast.error("Impossible de supprimer le plat");
      }
    },
    [fetchMenu]
  );

  const handleFormSubmit = useCallback(
    async (formData: ItemFormData, itemId?: string) => {
      try {
        const currentRestaurantId = data?.restaurantId;
        if (!currentRestaurantId) {
          throw new Error("L'identifiant du restaurant est manquant.");
        }

        const price = Number(formData.price);
        if (!Number.isFinite(price)) {
          throw new Error("Le prix du plat est invalide.");
        }

        const now = new Date().toISOString();
        const nextImageUrl = formData.imageFile
          ? await uploadDishFile(formData.imageFile, currentRestaurantId, "images")
          : formData.imageUrl || null;
        const nextVideoUrl = formData.videoFile
          ? await uploadDishFile(formData.videoFile, currentRestaurantId, "videos")
          : formData.videoUrl || null;

        const payload = {
          name: formData.nameFr.trim(),
          nameFr: formData.nameFr.trim(),
          nameEn: formData.nameEn.trim() || null,
          description: formData.descriptionFr.trim() || null,
          descriptionFr: formData.descriptionFr.trim() || null,
          descriptionEn: formData.descriptionEn.trim() || null,
          price,
          category: formData.categoryId,
          categoryId: formData.categoryId,
          imageUrl: nextImageUrl,
          videoUrl: nextVideoUrl || null,
          isAvailable: formData.isAvailable,
          status: formData.isAvailable ? "available" : "unavailable",
        };

        if (itemId) {
          await withTimeout(
            updateDoc(doc(firestoreDb, formData.sourceCollection || "dishes", itemId), {
              ...payload,
              updatedAt: now,
            }),
            FIRESTORE_DASHBOARD_TIMEOUT_MS,
            "Delai depasse lors de la mise a jour du plat."
          );
          toast.success(`\"${payload.nameFr}\" mis à jour`);
        } else {
          await withTimeout(
            addDoc(collection(firestoreDb, "dishes"), {
              ...payload,
              restaurantId: currentRestaurantId,
              createdAt: now,
              updatedAt: now,
            }),
            FIRESTORE_DASHBOARD_TIMEOUT_MS,
            "Delai depasse lors de la creation du plat."
          );
          toast.success(`\"${payload.nameFr}\" ajouté au menu`);
        }

        setDialogOpen(false);
        setEditingItem(null);
        void fetchMenu();
      } catch (error) {
        console.error("Erreur critique lors de la creation du plat dans Firestore :", error);
        toast.error(
          itemId
            ? "Erreur de mise a jour du plat."
            : "Erreur lors de la creation du plat. Verifie les donnees."
        );
      }
    },
    [data?.restaurantId, fetchMenu]
  );

  // ─── Loading / Protection ─────────────────────────────────────────────

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-sm text-muted-foreground">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  if (setupPending) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-sm sm:text-base">Tableau de bord</h1>
              <Badge variant="secondary" className="text-[10px]">
                En attente
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Deconnexion</span>
            </Button>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-10">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 mt-0.5 text-muted-foreground" />
              <div>
                <h2 className="text-lg font-bold">Aucun restaurant trouve</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {loadError ||
                    "Aucun restaurant n'est encore associe a votre compte. Veuillez contacter l'administrateur pour finaliser la configuration."}
                </p>
                <Button type="button" size="sm" variant="outline" onClick={fetchMenu} className="mt-4">
                  Reessayer
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── Groupage par catégorie ────────────────────────────────────────────
  if (!data) return null;

  if (data.restaurantIsSuspended) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-sm sm:text-base">Tableau de bord</h1>
              <Badge variant="destructive" className="text-[10px]">
                Suspendu
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Deconnexion</span>
            </Button>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-10">
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
            <h2 className="text-lg font-bold">Compte suspendu</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Votre compte a ete suspendu pour defaut de paiement. Veuillez contacter
              l&apos;administrateur de l&apos;application pour regulariser votre situation.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const itemsByCategory = data.categories.map((cat) => ({
    category: cat,
    items: data.items
      .filter((item) => item.categoryId === cat.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-sm sm:text-base">Tableau de bord</h1>
            <Badge variant="secondary" className="text-[10px]">
              {data.restaurantName || "Restaurant"}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {data.restaurantSlug && (
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex h-8 text-xs"
                onClick={() => window.open(`/menu/${data.restaurantSlug}`, "_blank")}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Voir le menu
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="hidden sm:flex h-8 text-xs">
              <Link href="/dashboard/orders">
                <ClipboardList className="w-3.5 h-3.5 mr-1" />
                Commandes
              </Link>
            </Button>
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {session.user?.email}
            </span>
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

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* QR Code Section */}
        <section>
          <h2 className="font-semibold text-sm mb-3">QR Code du menu</h2>
          <QrCodeSection restaurantSlug={data.restaurantSlug} />
        </section>

        <Separator />

        <RestaurantMediaSection
          restaurantId={data.restaurantId}
          logoUrl={data.restaurantLogoUrl}
          bannerUrl={data.restaurantBannerUrl}
          primaryColor={data.restaurantPrimaryColor}
          onSaved={fetchMenu}
        />

        <Separator />

        {/* Menu Management */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Gestion du menu</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.items.length} plat{data.items.length > 1 ? "s" : ""} dans {data.categories.length} catégorie{data.categories.length > 1 ? "s" : ""}
              </p>
            </div>
            <Button onClick={openCreate} size="sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Ajouter un plat
            </Button>
          </div>

          {/* Liste par catégorie */}
          {data.items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
              <h3 className="text-sm font-semibold">Votre menu est vide, ajoutez votre premier plat !</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Les categories sont chargees depuis Firestore. Ajoutez un plat pour commencer a composer votre menu public.
              </p>
              <Button onClick={openCreate} size="sm" className="mt-4">
                <Plus className="w-4 h-4 mr-1.5" />
                Ajouter un plat
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {itemsByCategory.map(({ category, items }) => (
              <section key={category.id} aria-label={category.nameFr}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-sm">{category.nameFr} <span className="text-muted-foreground font-normal">/ {category.nameEn}</span></h3>
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                </div>

                {items.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <p className="text-sm text-muted-foreground">Aucun plat dans cette catégorie</p>
                    <Button variant="link" size="sm" onClick={openCreate} className="mt-1">
                      Ajouter un plat
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`
                          flex items-center gap-3 p-3 rounded-lg border transition-colors
                          ${item.isAvailable ? "bg-card" : "bg-muted/40 border-muted"}
                        `}
                      >
                        {/* Photo miniature */}
                        {item.imageUrl ? (
                          <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden relative">
                            <img
                              src={item.imageUrl}
                              alt={item.nameFr}
                              className={`w-full h-full object-cover ${!item.isAvailable ? "grayscale opacity-50" : ""}`}
                            />
                            {/* Indicateur vidéo */}
                            {item.videoUrl && item.isAvailable && (
                              <div className="absolute bottom-0 right-0 w-4 h-4 bg-black/70 rounded-tl flex items-center justify-center">
                                <Video className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                            <Package className="w-5 h-5 text-muted-foreground/40" />
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-medium truncate ${!item.isAvailable ? "line-through text-muted-foreground" : ""}`}>
                              {item.nameFr} <span className="text-muted-foreground font-normal">/ {item.nameEn}</span>
                            </p>
                            {item.videoUrl && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-600 border-blue-200">
                                <Video className="w-2.5 h-2.5 mr-0.5" />
                                Vidéo
                              </Badge>
                            )}
                            {!item.isAvailable && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                Indispo
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.price.toLocaleString("fr-FR")} FCFA
                            {item.descriptionFr ? ` — ${item.descriptionFr.slice(0, 40)}...` : ""}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Toggle switch */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={item.isAvailable}
                            aria-label={`Rendre ${item.nameFr} ${item.isAvailable ? "indisponible" : "disponible"}`}
                            onClick={() => handleToggle(item)}
                            className={`
                              relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center
                              rounded-full border-2 border-transparent transition-colors duration-200
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                              ${item.isAvailable ? "bg-primary" : "bg-muted-foreground/30"}
                            `}
                          >
                            <span
                              className={`
                                pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg
                                transition-transform duration-200
                                ${item.isAvailable ? "translate-x-5" : "translate-x-0"}
                              `}
                            />
                          </button>

                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(item)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Dialog */}
      <ItemFormDialog
        key={editingItem?.id ?? "new"}
        categories={data.categories}
        editingItem={editingItem}
        onSubmit={handleFormSubmit}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
      <PasswordSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
