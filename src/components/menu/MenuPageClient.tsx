"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { MenuData, MenuCategory, MenuItem, Lang } from "@/lib/menu-data";
import { db as firestoreDb } from "@/lib/firebaseClient";
import { addDoc, collection, doc, onSnapshot } from "firebase/firestore";

// ─── Constants ─────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;
const SCROLL_THRESHOLD_PX = 200;

type CartItem = {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
};

type PublicOrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type PublicOrder = {
  id: string;
  tableNumber: string;
  customerName: string;
  customerPhone: string;
  status: string;
  totalPrice: number;
  notes: string | null;
  createdAt: string;
  items: PublicOrderItem[];
};

function normalizeOrderStatus(status: unknown) {
  if (status === "ready" || status === "delivered") return status;
  return "pending";
}

// ─── UI Labels par langue ──────────────────────────────────────────────────

function normalizePublicOrder(id: string, data: Record<string, unknown>): PublicOrder {
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
    const itemName =
      typeof rawItem.nameFr === "string" && rawItem.nameFr.trim()
        ? rawItem.nameFr
        : typeof line.name === "string"
          ? line.name
          : "Plat";
    const price = Number(line.price ?? line.priceAtPurchase ?? 0);

    return {
      id: typeof line.id === "string" ? line.id : `${id}-${index}`,
      name: itemName,
      price,
      quantity: Number(line.quantity || 1),
    };
  });

  return {
    id,
    tableNumber: typeof data.tableNumber === "string" ? data.tableNumber : "1",
    customerName: typeof data.customerName === "string" ? data.customerName : "Client",
    customerPhone: typeof data.customerPhone === "string" ? data.customerPhone : "",
    status: normalizeOrderStatus(data.status),
    totalPrice: Number(data.totalPrice || 0),
    notes: typeof data.notes === "string" && data.notes.trim() ? data.notes : null,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    items,
  };
}

const LABELS: Record<Lang, { menuSubtitle: string; noDish: string; endOfMenu: string; dishInCategory: (n: number) => string; loadMore: (n: number) => string; loading: string; video: string; unavailable: string }> = {
  fr: {
    menuSubtitle: "Menu digital — Scannez, choisissez, dégustez",
    noDish: "Aucun plat dans cette catégorie",
    endOfMenu: "— Fin du menu —",
    dishInCategory: (n) => `${n} plat${n > 1 ? "s" : ""} dans cette catégorie`,
    loadMore: (n) => `Voir ${n} plats de plus`,
    loading: "Chargement...",
    video: "Vidéo",
    unavailable: "Indisponible aujourd'hui",
  },
  en: {
    menuSubtitle: "Digital menu — Scan, choose, enjoy",
    noDish: "No dishes in this category",
    endOfMenu: "— End of menu —",
    dishInCategory: (n) => `${n} dish${n > 1 ? "es" : ""} in this category`,
    loadMore: (n) => `See ${n} more dishes`,
    loading: "Loading...",
    video: "Video",
    unavailable: "Unavailable today",
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function localName(cat: MenuCategory, lang: Lang) {
  return lang === "en" && cat.nameEn ? cat.nameEn : cat.nameFr;
}

function localItemName(item: MenuItem, lang: Lang) {
  return lang === "en" && item.nameEn ? item.nameEn : item.nameFr;
}

function localItemDesc(item: MenuItem, lang: Lang) {
  if (lang === "en") return item.descriptionEn || item.descriptionFr || null;
  return item.descriptionFr || item.descriptionEn || null;
}

// ─── LanguageToggle ─────────────────────────────────────────────────────────

function LanguageToggle({
  lang,
  onLangChange,
  brandColor,
}: {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  brandColor: string;
}) {
  return (
    <div className="inline-flex items-center rounded-full border bg-white/90 backdrop-blur-sm p-0.5 shadow-sm">
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => onLangChange(l)}
          className={`
            px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200
            ${lang === l
              ? "text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
            }
          `}
          style={lang === l ? { backgroundColor: brandColor } : undefined}
          aria-pressed={lang === l}
        >
          {l === "fr" ? "FR" : "EN"}
        </button>
      ))}
    </div>
  );
}

// ─── RestaurantHeader ──────────────────────────────────────────────────────

function RestaurantHeader({
  restaurant,
  brandColor,
}: {
  restaurant: MenuData["restaurant"];
  brandColor: string;
}) {
  return (
    <header className="relative w-full">
      {/* Bannière */}
      {restaurant.bannerUrl && (
        <div className="relative h-48 sm:h-56 md:h-64 w-full overflow-hidden">
          <img
            src={restaurant.bannerUrl}
            alt={`Bannière de ${restaurant.name}`}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
          {/* Dégradé sombre en bas pour la lisibilité */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </div>
      )}

      {/* Info du restaurant sous la bannière */}
      <div className="relative z-10 border-b bg-white shadow-sm">
        <div
          className={`flex items-center gap-4 px-4 pb-5 ${
            restaurant.bannerUrl ? "pt-3" : "pt-6"
          }`}
        >
          {/* Logo */}
          {restaurant.logoUrl && (
            <div
              className={`flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border-2 border-white shadow-lg bg-white ${
                restaurant.bannerUrl ? "-mt-10" : ""
              }`}
            >
              <img
                src={restaurant.logoUrl}
                alt={`Logo de ${restaurant.name}`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className={`flex-1 min-w-0 pl-1 ${restaurant.bannerUrl ? "-mt-2" : ""}`}>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight break-words">
              <span style={{ color: brandColor }}>
                {restaurant.name}
              </span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {/* menuSubtitle is rendered in CategoryBar with lang context */}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── CategoryBar (sticky) ──────────────────────────────────────────────────

function CategoryBar({
  categories,
  activeCategoryId,
  onSelect,
  lang,
  labels,
  brandColor,
}: {
  categories: MenuCategory[];
  activeCategoryId: string | null;
  onSelect: (id: string) => void;
  lang: Lang;
  labels: typeof LABELS.fr;
  brandColor: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <nav
      aria-label="Catégories du menu"
      className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-border shadow-sm"
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div
          ref={scrollRef}
          className="flex gap-1 overflow-x-auto scrollbar-hide flex-1 mr-3"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {categories.map((cat) => {
            const isActive = cat.id === activeCategoryId;
            return (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                aria-pressed={isActive}
                className={`
                  relative flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium
                  transition-all duration-200 ease-out
                  ${
                    isActive
                      ? "text-white shadow-md"
                      : "bg-secondary/70 text-secondary-foreground hover:bg-secondary active:scale-95"
                  }
                `}
                style={isActive ? { backgroundColor: brandColor } : undefined}
              >
                {localName(cat, lang)}
                <span
                  className={`ml-1.5 text-xs ${
                    isActive ? "text-white/75" : "text-muted-foreground"
                  }`}
                >
                  {cat.itemCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// ─── MenuItemCard ──────────────────────────────────────────────────────────

function MenuItemCard({
  item,
  lang,
  labels,
  brandColor,
  onSelect,
}: {
  item: MenuItem;
  lang: Lang;
  labels: typeof LABELS.fr;
  brandColor: string;
  onSelect: (item: MenuItem) => void;
}) {
  const unavailable = !item.isAvailable;
  const hasVideo = !!item.videoUrl;
  const name = localItemName(item, lang);
  const desc = localItemDesc(item, lang);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(item);
        }
      }}
      className={`
        flex gap-3 p-3 rounded-xl border transition-colors duration-200 cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${
          unavailable
            ? "border-border/50 bg-muted/30 opacity-60"
            : "border-border bg-card hover:bg-accent/50"
        }
      `}
      style={{ borderColor: brandColor }}
      aria-label={name}
    >
      {/* Photo ou vidéo du plat */}
      {item.imageUrl || item.videoUrl ? (
        <div className="relative flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={name}
              loading="lazy"
              decoding="async"
              className={`
                w-full h-full object-cover transition-transform duration-300
                ${!unavailable ? "hover:scale-105" : "grayscale"}
              `}
            />
          ) : (
            <video
              src={item.videoUrl!}
              controls
              muted
              loop
              playsInline
              autoPlay
              preload="metadata"
              className={`w-full h-auto rounded-lg object-cover ${unavailable ? "grayscale" : ""}`}
            />
          )}
          {/* Icône Play si vidéo disponible */}
          {hasVideo && !unavailable && (
            <div className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <svg className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`
            flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-lg
            flex items-center justify-center bg-muted [&>span]:hidden
            ${unavailable ? "opacity-50" : ""}
          `}
        >
          <span className="text-3xl">🍽️</span>
        </div>
      )}

      {/* Contenu textuel */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`font-semibold text-sm sm:text-base leading-tight ${
                unavailable ? "line-through text-muted-foreground" : "text-foreground"
              }`}
            >
              {name}
            </h3>
            <span
              className={`flex-shrink-0 font-bold text-sm sm:text-base tabular-nums ${
                unavailable ? "text-muted-foreground" : ""
              }`}
              style={!unavailable ? { color: brandColor } : undefined}
            >
              {item.price.toLocaleString("fr-FR")} FCFA
            </span>
          </div>
          {desc && (
            <p
              className={`mt-1 text-xs sm:text-sm leading-relaxed line-clamp-2 ${
                unavailable ? "text-muted-foreground/60" : "text-muted-foreground"
              }`}
            >
              {desc}
            </p>
          )}
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 mt-1">
          {hasVideo && !unavailable && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium"
              style={{ color: brandColor }}
            >
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {labels.video}
            </span>
          )}
          {unavailable && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground border border-border">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
              {labels.unavailable}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Skeleton de chargement ────────────────────────────────────────────────

function DishDetailModal({
  item,
  lang,
  brandColor,
  onAddToCart,
  onClose,
}: {
  item: MenuItem | null;
  lang: Lang;
  brandColor: string;
  onAddToCart: (item: MenuItem, quantity: number) => void;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!item) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item, onClose]);

  useEffect(() => {
    if (item) setQuantity(1);
  }, [item]);

  if (!item) return null;

  const name = localItemName(item, lang);
  const desc = localItemDesc(item, lang);

  return (
    <div
      className="fixed inset-0 z-50 bg-white sm:flex sm:items-center sm:justify-center sm:bg-black/60 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-y-auto bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative shrink-0 bg-black">
          {item.videoUrl ? (
            <video
              src={item.videoUrl}
              controls
              muted
              loop
              playsInline
              autoPlay
              className="w-full h-auto rounded-lg"
              poster={item.imageUrl || undefined}
            />
          ) : item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={name}
              loading="lazy"
              decoding="async"
              className="h-[58vh] w-full object-cover bg-black sm:max-h-[60vh]"
            />
          ) : (
            <div className="flex h-[58vh] items-center justify-center bg-muted sm:h-80 [&>span]:hidden">
              <span className="text-5xl">ðŸ½ï¸</span>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl font-semibold leading-none text-black shadow"
            aria-label="Fermer"
          >
            x
          </button>
        </div>
        <div className="flex-1 space-y-4 p-5 pb-28 sm:pb-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-2xl font-bold leading-tight text-black">{name}</h2>
            <span
              className="shrink-0 text-lg font-bold tabular-nums"
              style={{ color: brandColor }}
            >
              {item.price.toLocaleString("fr-FR")} FCFA
            </span>
          </div>
          {desc && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {desc}
            </p>
          )}
        </div>
        <div className="sticky bottom-0 z-10 border-t border-border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 items-center rounded-full border border-border bg-white">
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                className="h-11 w-11 text-lg font-semibold text-black"
                aria-label="Diminuer la quantite"
              >
                -
              </button>
              <span className="min-w-8 text-center text-sm font-semibold tabular-nums text-black">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((value) => value + 1)}
                className="h-11 w-11 text-lg font-semibold text-black"
                aria-label="Augmenter la quantite"
              >
                +
              </button>
            </div>
            <button
              type="button"
              className="h-11 flex-1 rounded-full px-4 text-sm font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-60"
              style={{ backgroundColor: brandColor }}
              disabled={!item.isAvailable}
              onClick={() => {
                onAddToCart(item, quantity);
                onClose();
              }}
            >
              Ajouter au panier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Skeleton bannière */}
      <div className="h-48 sm:h-56 md:h-64 bg-muted animate-pulse" />
      {/* Skeleton logo + nom */}
      <div className="flex items-end gap-3 px-4 pb-3 -mt-10 z-10 relative">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-muted animate-pulse" />
        <div className="flex-1 space-y-2 pb-2">
          <div className="h-6 w-40 bg-muted rounded animate-pulse" />
          <div className="h-4 w-56 bg-muted rounded animate-pulse" />
        </div>
      </div>
      {/* Skeleton catégories */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-border p-3 flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-24 rounded-full bg-muted animate-pulse" />
        ))}
      </div>
      {/* Skeleton items */}
      <div className="p-3 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-xl border border-border">
            <div className="w-24 h-24 rounded-lg bg-muted animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-3 w-full bg-muted rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bouton « Charger plus » ───────────────────────────────────────────────

function LoadMoreButton({
  remaining,
  loading,
  onClick,
  label,
  brandColor,
}: {
  remaining: number;
  loading: boolean;
  onClick: () => void;
  label: string;
  brandColor: string;
}) {
  if (remaining <= 0) return null;

  return (
    <div className="flex justify-center py-4">
      <button
        onClick={onClick}
        disabled={loading}
        className="
          px-6 py-2.5 rounded-full text-sm font-medium
          text-white
          active:scale-95 transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        style={{ backgroundColor: brandColor }}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Loading...
          </span>
        ) : (
          label
        )}
      </button>
    </div>
  );
}

// ─── Page client principale ────────────────────────────────────────────────

function CartBar({
  cart,
  brandColor,
  onCheckout,
}: {
  cart: CartItem[];
  brandColor: string;
  onCheckout: () => void;
}) {
  if (cart.length === 0) return null;

  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 p-3 shadow-2xl backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-black">Mon Panier</p>
          <p className="truncate text-xs text-muted-foreground">
            {itemCount} article{itemCount > 1 ? "s" : ""} - {total.toLocaleString("fr-FR")} FCFA
          </p>
        </div>
        <button
          type="button"
          onClick={onCheckout}
          className="h-11 rounded-full px-5 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
          style={{ backgroundColor: brandColor }}
        >
          Passer la commande
        </button>
      </div>
    </div>
  );
}

function CheckoutDialog({
  open,
  cart,
  tableNumber,
  brandColor,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  cart: CartItem[];
  tableNumber: string;
  brandColor: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (form: {
    customerName: string;
    customerPhone: string;
    notes: string;
    tableNumber: string;
  }) => void;
}) {
  const [tableInput, setTableInput] = useState(tableNumber);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  useEffect(() => {
    setTableInput(tableNumber);

    if (!open) {
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
    }
  }, [open, tableNumber]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-black">Valider la commande</h2>
            <p className="text-sm text-muted-foreground">
              Total: {total.toLocaleString("fr-FR")} FCFA
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-black"
            aria-label="Fermer"
          >
            x
          </button>
        </div>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ customerName, customerPhone, notes, tableNumber: tableInput.trim() });
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-black" htmlFor="checkout-table">
              Numero de table
            </label>
            <input
              id="checkout-table"
              type="text"
              inputMode="numeric"
              value={tableInput}
              onChange={(event) => setTableInput(event.target.value)}
              placeholder="Ex: 3"
              required
              maxLength={20}
              className="h-10 w-full rounded-md border px-3 text-sm text-black"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-black" htmlFor="checkout-name">
              Nom complet
            </label>
            <input
              id="checkout-name"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              required
              maxLength={120}
              className="h-10 w-full rounded-md border px-3 text-sm text-black"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-black" htmlFor="checkout-phone">
              Numero de telephone
            </label>
            <input
              id="checkout-phone"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              required
              maxLength={40}
              className="h-10 w-full rounded-md border px-3 text-sm text-black"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-black" htmlFor="checkout-notes">
              Note optionnelle
            </label>
            <textarea
              id="checkout-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              placeholder="Ex: Sans piment"
              className="min-h-20 w-full rounded-md border px-3 py-2 text-sm text-black"
            />
          </div>
          {!tableInput.trim() && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              Indiquez le numero de votre table avant d'envoyer la commande.
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || !tableInput.trim() || cart.length === 0}
            className="h-11 w-full rounded-full text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? "Envoi..." : "Confirmer la commande"}
          </button>
        </form>
      </div>
    </div>
  );
}

function OrderStatusPanel({
  order,
  brandColor,
}: {
  order: PublicOrder | null;
  brandColor: string;
}) {
  if (!order) return null;

  const steps = [
    { id: "pending", label: "En attente" },
    { id: "ready", label: "Prete" },
    { id: "delivered", label: "Livree" },
  ];
  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === order.status));
  const statusMessage =
    order.status === "ready"
        ? "Votre commande est prete !"
        : order.status === "delivered"
          ? "Votre commande a ete servie. Bon appetit !"
          : "Votre commande a ete envoyee au restaurant.";

  return (
    <section className="mx-auto mb-24 mt-3 max-w-2xl rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-black">Commande #{order.id.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground">Table N° {order.tableNumber}</p>
          <p className="mt-1 text-sm font-medium text-black">{statusMessage}</p>
        </div>
        <p className="text-sm font-bold text-black">{order.totalPrice.toLocaleString("fr-FR")} FCFA</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {steps.map((step, index) => {
          const isDone = index <= activeIndex;
          return (
            <div key={step.id} className="text-center">
              <div
                className="mx-auto mb-1 h-2 rounded-full"
                style={{ backgroundColor: isDone ? brandColor : "#e5e7eb" }}
              />
              <p className="text-[11px] font-medium text-black">{step.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function MenuPageClient({ data }: { data: MenuData }) {
  const { restaurant, categories, items: allItems } = data;
  const brandColor = restaurant.primaryColor || "#000000";
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get("table")?.trim() || "";
  const cartStorageKey = `qr-cart:${restaurant.slug}:${tableNumber || "no-table"}`;
  const orderStorageKey = `qr-order:${restaurant.slug}:${tableNumber || "no-table"}`;

  // ─── Langue (état local, par défaut FR) ─────────────────────────────────
  const [lang, setLang] = useState<Lang>("fr");
  const labels = LABELS[lang];
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [activeOrder, setActiveOrder] = useState<PublicOrder | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // État de la catégorie active — null = « Tout »
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // Items filtrés par catégorie
  const filteredItems: MenuItem[] = activeCategoryId
    ? allItems.filter((item) => item.categoryId === activeCategoryId)
    : allItems;

  // Pagination par lot de 10
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Référence pour le scroll infini
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Handle catégorie click — reset la pagination dans le handler, pas dans un useEffect
  const handleCategorySelect = useCallback((id: string) => {
    setActiveCategoryId((prev) => (prev === id ? null : id));
    setVisibleCount(ITEMS_PER_PAGE);
  }, []);

  const visibleItems = filteredItems.slice(0, visibleCount);
  const remainingItems = filteredItems.length - visibleCount;

  // Charger plus d'items
  const loadMore = useCallback(() => {
    if (remainingItems <= 0 || isLoadingMore) return;
    setIsLoadingMore(true);
    requestAnimationFrame(() => {
      setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
      setIsLoadingMore(false);
    });
  }, [remainingItems, isLoadingMore]);

  useEffect(() => {
    try {
      const savedCart = window.localStorage.getItem(cartStorageKey);
      setCart(savedCart ? JSON.parse(savedCart) : []);
    } catch {
      setCart([]);
    }
  }, [cartStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, cartStorageKey]);

  useEffect(() => {
    try {
      setActiveOrderId(window.localStorage.getItem(orderStorageKey));
    } catch {
      setActiveOrderId(null);
    }
  }, [orderStorageKey]);

  const handleAddToCart = useCallback((item: MenuItem, quantity: number) => {
    const name = localItemName(item, lang);
    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.itemId === item.id);
      if (existing) {
        return current.map((cartItem) =>
          cartItem.itemId === item.id
            ? { ...cartItem, quantity: cartItem.quantity + quantity }
            : cartItem
        );
      }
      return [
        ...current,
        {
          itemId: item.id,
          name,
          price: item.price,
          quantity,
        },
      ];
    });
  }, [lang]);

  async function handleSubmitOrder(form: {
    customerName: string;
    customerPhone: string;
    notes: string;
    tableNumber: string;
  }) {
    const submittedTableNumber = form.tableNumber.trim();
    if (cart.length === 0 || !submittedTableNumber) return;
    setSubmittingOrder(true);
    try {
      const now = new Date().toISOString();
      const orderItems = cart.map((cartItem) => {
        const menuItem = allItems.find((item) => item.id === cartItem.itemId);
        const itemName = menuItem ? localItemName(menuItem, lang) : cartItem.name;

        return {
          id: cartItem.itemId,
          name: itemName,
          price: cartItem.price,
          quantity: cartItem.quantity,
        };
      });
      const totalPrice = orderItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );
      const orderPayload = {
        restaurantId: restaurant.id,
        tableNumber: submittedTableNumber,
        items: orderItems,
        status: "pending",
        totalPrice,
        createdAt: now,
        restaurantSlug: restaurant.slug,
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        notes: form.notes.trim() || null,
        updatedAt: now,
      };
      const orderRef = await addDoc(collection(firestoreDb, "orders"), orderPayload);

      setActiveOrderId(orderRef.id);
      setActiveOrder(normalizePublicOrder(orderRef.id, orderPayload));
      setCart([]);
      window.localStorage.removeItem(cartStorageKey);
      window.localStorage.setItem(orderStorageKey, orderRef.id);
      setCheckoutOpen(false);
    } catch (error) {
      console.error("Erreur creation commande Firestore:", error);
      alert("Impossible de creer la commande");
    } finally {
      setSubmittingOrder(false);
    }
  }

  useEffect(() => {
    if (!activeOrderId) return;

    const unsubscribe = onSnapshot(doc(firestoreDb, "orders", activeOrderId), (snapshot) => {
      if (!snapshot.exists()) return;
      setActiveOrder(normalizePublicOrder(snapshot.id, snapshot.data() as Record<string, unknown>));
    });

    return () => unsubscribe();
  }, [activeOrderId]);

  // Intersection Observer pour le scroll infini
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && remainingItems > 0 && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: `${SCROLL_THRESHOLD_PX}px` }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, remainingItems, isLoadingMore]);

  return (
    <div className="min-h-screen bg-background">
      <RestaurantHeader restaurant={restaurant} brandColor={brandColor} />

      {/* Bande titre + toggle langue */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/90 border-b border-border/50">
        <p className="text-sm text-muted-foreground truncate">
          {labels.menuSubtitle}
        </p>
        <LanguageToggle lang={lang} onLangChange={setLang} brandColor={brandColor} />
      </div>

      <CategoryBar
        categories={categories}
        activeCategoryId={activeCategoryId}
        onSelect={handleCategorySelect}
        lang={lang}
        labels={labels}
        brandColor={brandColor}
      />

      <main className="px-3 py-3 pb-28 space-y-2 max-w-2xl mx-auto" role="list" aria-label="Plats du menu">
        {/* Indicateur de filtre actif */}
        {activeCategoryId && (
          <div className="flex items-center justify-between py-2">
            <p className="text-xs text-muted-foreground">
              {labels.dishInCategory(filteredItems.length)}
            </p>
          </div>
        )}

        {/* Liste des plats visibles */}
        {visibleItems.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            lang={lang}
            labels={labels}
            brandColor={brandColor}
            onSelect={setSelectedItem}
          />
        ))}

        {/* Bouton ou scroll infini */}
        <LoadMoreButton
          remaining={remainingItems}
          loading={isLoadingMore}
          onClick={loadMore}
          label={labels.loadMore(remainingItems > ITEMS_PER_PAGE ? ITEMS_PER_PAGE : remainingItems)}
          brandColor={brandColor}
        />

        {/* Sentinelle pour l'intersection observer */}
        <div ref={sentinelRef} className="h-1" aria-hidden="true" />

        {/* Fin de liste */}
        {remainingItems <= 0 && filteredItems.length > 0 && (
          <p className="text-center text-xs text-muted-foreground py-6">
            {labels.endOfMenu}
          </p>
        )}

        {/* Catégorie vide */}
        {activeCategoryId && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl mb-3">🍽️</span>
            <p className="text-sm text-muted-foreground">
              {labels.noDish}
            </p>
          </div>
        )}
      </main>

      <OrderStatusPanel order={activeOrder} brandColor={brandColor} />

      <DishDetailModal
        item={selectedItem}
        lang={lang}
        brandColor={brandColor}
        onAddToCart={handleAddToCart}
        onClose={() => setSelectedItem(null)}
      />
      <CartBar
        cart={cart}
        brandColor={brandColor}
        onCheckout={() => setCheckoutOpen(true)}
      />
      <CheckoutDialog
        open={checkoutOpen}
        cart={cart}
        tableNumber={tableNumber}
        brandColor={brandColor}
        submitting={submittingOrder}
        onClose={() => setCheckoutOpen(false)}
        onSubmit={handleSubmitOrder}
      />
    </div>
  );
}

// Export du skeleton pour la page serveur
export { MenuSkeleton };
