import { z } from "zod";

// Keep Base64 documents comfortably below Firestore's 1 MiB document limit.
export const imageSchema = z.string().max(700_000).refine(
  (value) => value === "" || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value),
  "Image PNG, JPEG ou WebP invalide (maximum 500 Ko).",
);
export const testimonialSchema = z.object({
  restaurantName: z.string().trim().min(1).max(120),
  ownerName: z.string().trim().min(1).max(120),
  comment: z.string().trim().min(1).max(2000),
  rating: z.number().int().min(1).max(5),
  avatarBase64: imageSchema,
  isActive: z.boolean(),
});
export const settingsSchema = z.object({
  whatsappNumber: z.string().trim().regex(/^(?:[1-9]\d{7,14})?$/, "Numéro international sans + ni espaces."),
  defaultMessage: z.string().trim().max(1000),
  demoImageBase64: imageSchema,
  stats: z.object({
    totalRestaurants: z.number().int().min(0).max(1_000_000),
    satisfactionRate: z.number().min(0).max(100),
  }),
});
export type Testimonial = z.infer<typeof testimonialSchema> & { id: string; createdAt: string };
export type MarketingSettings = z.infer<typeof settingsSchema>;
export type MarketingData = { testimonials: Testimonial[]; settings: MarketingSettings };
export const defaultMarketingSettings: MarketingSettings = {
  whatsappNumber: "", defaultMessage: "Bonjour, je souhaite une démonstration de votre menu QR.",
  demoImageBase64: "", stats: { totalRestaurants: 0, satisfactionRate: 0 },
};

export async function marketingRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Impossible de charger le contenu marketing.");
  return body as T;
}

export function readMarketingImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 500_000) {
    return Promise.reject(new Error("Choisissez une image PNG, JPEG ou WebP de maximum 500 Ko."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture de l’image impossible."));
    reader.onload = () => {
      const parsed = imageSchema.safeParse(reader.result);
      if (parsed.success) resolve(parsed.data);
      else reject(new Error("Image invalide. Choisissez un fichier PNG, JPEG ou WebP."));
    };
    reader.readAsDataURL(file);
  });
}
