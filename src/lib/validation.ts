import { z } from "zod";

export const documentIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const priceSchema = z.number().finite().min(0).max(99999);
// Table identifiers are plain text, never markup. Preserve accented names and spaces.
export const tableNumberSchema = z.string().trim().min(1).max(40)
  .regex(/^[\p{L}\p{N} _.-]+$/u, "Numéro de table invalide.");
export function sanitizeTableNumber(value: unknown) {
  return typeof value === "string" ? value.replace(/[<>\u0000-\u001f\u007f]/g, "").trim().slice(0, 40) : "";
}
export const dishImageSchema = z.string().max(200_000).refine(
  value => value === "" || /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value),
  "Image JPEG/WebP compressée de maximum 200 Ko requise.",
);
const mediaUrl = z.string().max(2048).refine(value => value === "" || /^https:\/\//.test(value) || /^\/uploads\/[\w/.-]+$/.test(value), "URL média invalide.");
export const dishSchema = z.object({
  nameFr: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().max(200).nullable().optional(),
  descriptionFr: z.string().trim().max(2000).nullable().optional(),
  descriptionEn: z.string().trim().max(2000).nullable().optional(),
  price: priceSchema,
  categoryId: documentIdSchema,
  imageUrl: z.union([dishImageSchema, mediaUrl]).nullable().optional(),
  videoUrl: mediaUrl.nullable().optional(),
  isAvailable: z.boolean().optional(),
}).strict();
export const orderInputSchema = z.object({
  slug: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  tableNumber: tableNumberSchema,
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(1).max(40).regex(/^[+\d ()-]+$/),
  notes: z.string().trim().max(500).optional(),
  items: z.array(z.object({ itemId: documentIdSchema, quantity: z.number().int().min(1).max(50) }).strict()).min(1).max(100),
}).strict();
export const accountSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(254),
  password: z.string().min(6).max(128),
}).strict();
export const createAccountSchema = accountSchema.extend({ restaurantId: documentIdSchema }).strict();
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(8).max(128) }).strict();
export const restaurantAppearanceSchema = z.object({
  logoUrl: mediaUrl.nullable().optional(),
  bannerUrl: mediaUrl.nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).strict();
export const suspensionSchema = z.object({ isSuspended: z.boolean() }).strict();
export const restaurantCreationSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().regex(/^[a-z0-9_-]{1,100}$/),
  managerEmail: z.string().trim().email().max(254),
  password: z.string().min(6).max(128),
  bannerUrl: mediaUrl,
}).strict();
