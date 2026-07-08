"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db as firestoreDb } from "@/lib/firebaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
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
  Menu,
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
  restaurantDocId: string;
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
const MAX_FIRESTORE_IMAGE_BYTES = 750_000;
const MAX_RESTAURANT_SINGLE_MEDIA_BYTES = 380_000;
const MAX_RESTAURANT_MEDIA_BYTES = 850_000;
const IMAGE_COMPRESSION_ATTEMPTS = [
  { maxWidth: 500, quality: 0.7 },
  { maxWidth: 420, quality: 0.62 },
  { maxWidth: 320, quality: 0.55 },
] as const;

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

function firstStringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function localStorageValue(key: string) {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function rememberActiveRestaurantIds(restaurantId: string, restaurantDocId: string) {
  if (typeof window === "undefined") return;

  try {
    if (restaurantId) window.localStorage.setItem("activeRestaurantId", restaurantId);
    if (restaurantDocId) window.localStorage.setItem("activeRestaurantDocId", restaurantDocId);
  } catch {
    // localStorage can be unavailable in private browsing or restricted contexts.
  }
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
  const restaurantId = firstStringValue(
    restaurantData.id,
    restaurantData._id,
    restaurantData.restaurantId,
    restaurantDoc.id
  );

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
    restaurantDocId: restaurantDoc.id,
    restaurantName: stringValue(restaurantData.name, "Restaurant"),
    restaurantSlug: stringValue(restaurantData.slug),
    restaurantLogoUrl: nullableStringValue(restaurantData.logoUrl),
    restaurantBannerUrl: nullableStringValue(restaurantData.bannerUrl),
    restaurantPrimaryColor: stringValue(
      restaurantData.primaryColor,
      stringValue(restaurantData.couleur, stringValue(restaurantData.color, "#000000"))
    ),
    restaurantIsSuspended: booleanValue(restaurantData.isSuspended),
  };
}

function isBase64Image(value: string) {
  return value.startsWith("data:image/");
}

function combinedMediaSize(...values: string[]) {
  return values.reduce((total, value) => total + value.length, 0);
}

const compressImageSourceToBase64 = (
  source: string,
  maxBytes = MAX_FIRESTORE_IMAGE_BYTES
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (!img.width || !img.height) {
        reject(new Error("L'image selectionnee est invalide."));
        return;
      }

      let smallestImage = "";

      for (const attempt of IMAGE_COMPRESSION_ATTEMPTS) {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > attempt.maxWidth) {
          height = Math.round((height * attempt.maxWidth) / width);
          width = attempt.maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Impossible de compresser l'image selectionnee."));
          return;
        }

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL("image/jpeg", attempt.quality);
        if (!smallestImage || compressedBase64.length < smallestImage.length) {
          smallestImage = compressedBase64;
        }

        if (compressedBase64.length <= maxBytes) {
          resolve(compressedBase64);
          return;
        }
      }

      reject(
        new Error(
          `Image trop volumineuse apres compression (${Math.ceil(
            smallestImage.length / 1024
          )} Ko). Choisis une image plus legere.`
        )
      );
    };
    img.onerror = (error) => reject(error);
    img.src = source;
  });
};

const compressAndToBase64 = (
  file: File,
  maxBytes = MAX_FIRESTORE_IMAGE_BYTES
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (event) => {
      const result = event.target?.result;

      if (typeof result !== "string") {
        reject(new Error("Impossible de lire l'image selectionnee."));
        return;
      }

      try {
        resolve(await compressImageSourceToBase64(result, maxBytes));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

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
      <div className="w-full space-y-2 md:max-w-xs">
        <Label htmlFor="qr-table-number">Numero de table</Label>
        <Input
          id="qr-table-number"
          value={tableNumber}
          onChange={(e) =>
            setTableNumber(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20) || "1")
          }
          disabled={loading}
          className="w-full"
        />
      </div>
      {/* Mobile : boutons empiles et tactiles. Desktop : disposition en ligne. */}
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <Button
          onClick={() => generateQr("png")}
          disabled={loading}
          variant="outline"
          size="sm"
          className="w-full md:w-auto"
        >
          <QrCode className="w-4 h-4 mr-1.5" />
          {loading ? "Génération..." : "Générer QR PNG"}
        </Button>
        <Button
          onClick={() => generateQr("svg")}
          disabled={loading}
          variant="outline"
          size="sm"
          className="w-full md:w-auto"
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
  restaurantDocId,
  logoUrl,
  bannerUrl,
  primaryColor: savedPrimaryColor,
  onSaved,
}: {
  restaurantId: string;
  restaurantDocId: string;
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

  async function handleSave() {
    setSaving(true);

    try {
      const storedRestaurantId = localStorageValue("activeRestaurantId");
      const storedRestaurantDocId = localStorageValue("activeRestaurantDocId");
      const activeRestaurantDocId = firstStringValue(
        restaurantDocId,
        storedRestaurantDocId,
        restaurantId,
        storedRestaurantId
      );
      const activeRestaurantId = firstStringValue(
        restaurantId,
        storedRestaurantId,
        activeRestaurantDocId
      );

      if (!activeRestaurantDocId) {
        setSaving(false);
        alert("ERREUR CRITIQUE : Impossible de sauvegarder les medias. L'ID du restaurant est introuvable.");
        return;
      }

      rememberActiveRestaurantIds(activeRestaurantId, activeRestaurantDocId);

      let nextLogo = logo;
      let nextBanner = banner;
      const mediaUpdate: Record<string, string> = {
        primaryColor,
        couleur: primaryColor,
        color: primaryColor,
        updatedAt: new Date().toISOString(),
      };

      if (logoFile) {
        nextLogo = await compressAndToBase64(logoFile, MAX_RESTAURANT_SINGLE_MEDIA_BYTES);
        mediaUpdate.logoUrl = nextLogo;
      }

      if (bannerFile) {
        nextBanner = await compressAndToBase64(bannerFile, MAX_RESTAURANT_SINGLE_MEDIA_BYTES);
        mediaUpdate.bannerUrl = nextBanner;
        mediaUpdate.banniereUrl = nextBanner;
      }

      if (combinedMediaSize(nextLogo, nextBanner) > MAX_RESTAURANT_MEDIA_BYTES) {
        if (!logoFile && isBase64Image(nextLogo)) {
          nextLogo = await compressImageSourceToBase64(nextLogo, MAX_RESTAURANT_SINGLE_MEDIA_BYTES);
          mediaUpdate.logoUrl = nextLogo;
        }

        if (!bannerFile && isBase64Image(nextBanner)) {
          nextBanner = await compressImageSourceToBase64(nextBanner, MAX_RESTAURANT_SINGLE_MEDIA_BYTES);
          mediaUpdate.bannerUrl = nextBanner;
          mediaUpdate.banniereUrl = nextBanner;
        }
      }

      if (combinedMediaSize(nextLogo, nextBanner) > MAX_RESTAURANT_MEDIA_BYTES) {
        throw new Error("Logo et banniere restent trop volumineux pour Firestore apres compression.");
      }

      await withTimeout(
        updateDoc(doc(firestoreDb, "restaurants", activeRestaurantDocId), mediaUpdate),
        FIRESTORE_DASHBOARD_TIMEOUT_MS,
        "Delai depasse lors de l'enregistrement des medias."
      );

      toast.success("Identite du restaurant mise a jour");
      alert("Configuration de la marque enregistree avec succes !");
      setLogo(nextLogo || "");
      setBanner(nextBanner || "");
      setLogoFile(null);
      setBannerFile(null);
      selectLogo(null);
      selectBanner(null);
      void onSaved();
    } catch (error) {
      console.error("Erreur lors de la mise a jour des parametres du restaurant :", error);
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      alert(`Erreur Firebase lors de la sauvegarde : ${message}`);
      toast.error("Erreur lors de l'enregistrement.");
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
      {/* Mobile-first : les deux medias s'empilent jusqu'au breakpoint md. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-4">
        <div className="min-w-0 space-y-3">
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
              className="w-full min-w-0 text-sm"
            />
          </div>
          {logo && !logoFile && (
            <p className="text-xs text-muted-foreground truncate">{logo}</p>
          )}
        </div>
        <div className="min-w-0 space-y-3">
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
              className="w-full min-w-0 text-sm"
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
        className="w-full md:w-auto"
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
            maxSizeMb={12}
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
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [setupPending, setSetupPending] = useState(false);
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

  // ─── Protection côté client ────────────────────────────────────────────
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

  // ─── Chargement du menu ───────────────────────────────────────────────
  const fetchMenu = useCallback(async () => {
    const userId = dashboardSession?.id;

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
      rememberActiveRestaurantIds(firestoreData.restaurantId, firestoreData.restaurantDocId);
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
  }, [dashboardSession?.id]);

  useEffect(() => {
    if (dashboardSession) {
      fetchMenu();
    }
  }, [dashboardSession, fetchMenu]);

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
        const activeRestaurantId = firstStringValue(
          data?.restaurantId,
          data?.restaurantDocId,
          localStorageValue("activeRestaurantId"),
          localStorageValue("activeRestaurantDocId")
        );

        if (!activeRestaurantId) {
          console.error("Erreur : activeRestaurantId est introuvable.", { dashboardRestaurant: data });
          alert(
            "ERREUR CRITIQUE : Impossible de creer le plat car l'ID du restaurant est introuvable (undefined). Verifie l'etat de currentRestaurant."
          );
          return;
        }

        rememberActiveRestaurantIds(activeRestaurantId, data?.restaurantDocId || activeRestaurantId);

        const price = Number(formData.price);
        if (!Number.isFinite(price)) {
          throw new Error("Le prix du plat est invalide.");
        }

        const now = new Date().toISOString();
        const imagePatch: { imageUrl?: string } = {};

        if (formData.imageFile) {
          imagePatch.imageUrl = await compressAndToBase64(formData.imageFile);
        } else if (!formData.imageUrl) {
          imagePatch.imageUrl = "";
        }

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
          videoUrl: null,
          isAvailable: formData.isAvailable,
          status: formData.isAvailable ? "available" : "unavailable",
        };

        if (itemId) {
          await withTimeout(
            updateDoc(doc(firestoreDb, formData.sourceCollection || "dishes", itemId), {
              ...payload,
              ...imagePatch,
              updatedAt: now,
            }),
            FIRESTORE_DASHBOARD_TIMEOUT_MS,
            "Delai depasse lors de la mise a jour du plat."
          );
          toast.success(`\"${payload.nameFr}\" mis à jour`);
        } else {
          const createPayload = {
            ...payload,
            imageUrl: imagePatch.imageUrl || "",
          };

          const createdDishRef = await withTimeout(
            addDoc(collection(firestoreDb, "dishes"), {
              ...createPayload,
              restaurantId: activeRestaurantId,
              createdAt: now,
              updatedAt: now,
            }),
            FIRESTORE_DASHBOARD_TIMEOUT_MS,
            "Delai depasse lors de la creation du plat."
          );
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  items: [
                    ...prev.items,
                    {
                      id: createdDishRef.id,
                      nameFr: payload.nameFr,
                      nameEn: payload.nameEn || "",
                      descriptionFr: payload.descriptionFr,
                      descriptionEn: payload.descriptionEn,
                      price: payload.price,
                      imageUrl: createPayload.imageUrl,
                      videoUrl: payload.videoUrl,
                      isAvailable: payload.isAvailable,
                      categoryId: payload.categoryId,
                      createdAt: now,
                      sourceCollection: "dishes",
                    },
                  ],
                }
              : prev
          );
          toast.success(`\"${payload.nameFr}\" ajouté au menu`);
          alert("Plat ajoute avec succes !");
        }

        setDialogOpen(false);
        setEditingItem(null);
        void fetchMenu();
      } catch (error) {
        console.error("Erreur critique lors de la creation du plat dans Firestore :", error);
        const message = error instanceof Error ? error.message : "Erreur inconnue";
        alert(`Erreur Firebase lors de l'ajout : ${message}`);
        toast.error(
          itemId
            ? "Erreur de mise a jour du plat."
            : "Erreur lors de la creation du plat. Verifie les donnees."
        );
      }
    },
    [data, fetchMenu]
  );

  // ─── Loading / Protection ─────────────────────────────────────────────

  const handleSignOut = useCallback(() => {
    clearWorkspaceSession("dashboard");
    void signOut({ callbackUrl: "/login" });
  }, []);

  if (((status === "loading" || !workspaceSessionChecked) && !dashboardSession) || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-sm text-muted-foreground">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (!dashboardSession || status === "unauthenticated") return null;

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
              onClick={handleSignOut}
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
              onClick={handleSignOut}
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
        {/* Mobile : en-tete compact avec toutes les actions dans le menu burger. */}
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="shrink-0 text-sm font-semibold">Tableau de bord</h1>
            <Badge variant="secondary" className="max-w-[9rem] truncate text-[10px]">
              {data.restaurantName || "Restaurant"}
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-9 w-9 shrink-0 p-0"
                aria-label="Ouvrir le menu de navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                {dashboardSession.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {data.restaurantSlug && (
                <DropdownMenuItem
                  onSelect={() => window.open(`/menu/${data.restaurantSlug}`, "_blank")}
                  className="min-h-10 cursor-pointer"
                >
                  <ExternalLink />
                  Voir le menu
                </DropdownMenuItem>
              )}

              <DropdownMenuItem asChild className="min-h-10 cursor-pointer">
                <Link href="/dashboard/orders">
                  <ClipboardList />
                  Commandes
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild className="min-h-10 cursor-pointer">
                <Link href="/dashboard/parametres">
                  <Settings />
                  Parametres
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={handleSignOut}
                className="min-h-10 cursor-pointer"
              >
                <LogOut />
                Deconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Desktop (md+) : disposition horizontale existante conservee. */}
        <div className="mx-auto hidden h-14 max-w-4xl items-center justify-between px-4 md:flex">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold">Tableau de bord</h1>
            <Badge variant="secondary" className="text-[10px]">
              {data.restaurantName || "Restaurant"}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {data.restaurantSlug && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => window.open(`/menu/${data.restaurantSlug}`, "_blank")}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Voir le menu
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
              <Link href="/dashboard/orders">
                <ClipboardList className="w-3.5 h-3.5 mr-1" />
                Commandes
              </Link>
            </Button>
            <span className="text-xs text-muted-foreground">
              {dashboardSession.email}
            </span>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/parametres">
                <Settings className="w-4 h-4 mr-1.5" />
                <span>Parametres</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              <span>Déconnexion</span>
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
          restaurantDocId={data.restaurantDocId}
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
    </div>
  );
}
