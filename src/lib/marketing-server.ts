import { getFirebaseAdminFirestore } from "@/lib/firebaseAdmin";
import { defaultMarketingSettings, settingsSchema, testimonialSchema, type Testimonial } from "@/lib/marketing";

export function marketingDatabase() {
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin non configuré.");
  return db;
}

export async function readMarketing(publicOnly = false) {
  const db = marketingDatabase();
  // No compound index required; sort by creation time after the active filter.
  const collection = db.collection("testimonials");
  const [reviews, config] = await Promise.all([
    (publicOnly ? collection.where("isActive", "==", true) : collection).get(),
    db.collection("site_settings").doc("marketing").get(),
  ]);
  const testimonials: Testimonial[] = reviews.docs.flatMap((doc) => {
    const data = doc.data();
    const { id: _id, createdAt: _createdAt, ...fields } = data;
    const parsed = testimonialSchema.safeParse(fields);
    if (!parsed.success) return [];
    const date = data.createdAt;
    return [{ ...parsed.data, id: doc.id, createdAt: typeof date === "string" ? date : date?.toDate?.().toISOString() || "" }];
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const settings = settingsSchema.safeParse(config.data());
  return { testimonials: publicOnly ? testimonials.slice(0, 3) : testimonials, settings: settings.success ? settings.data : defaultMarketingSettings };
}
