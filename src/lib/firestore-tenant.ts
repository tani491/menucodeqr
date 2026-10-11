import { requireAuth } from "@/lib/api-auth";
import { getFirebaseAdminFirestore } from "@/lib/firebaseAdmin";
import { NextResponse } from "next/server";

export async function requireFirestoreRestaurant() {
  const auth = await requireAuth();
  if (auth.error) return { error: auth.error };
  if (auth.role !== "restaurateur" || !auth.restaurantId) return { error: NextResponse.json({ error: "Accès refusé." }, { status: 403 }) };
  const db = getFirebaseAdminFirestore();
  if (!db) throw new Error("Firebase Admin indisponible");
  const owned = await db.collection("restaurants").where("userId", "==", auth.userId).limit(2).get();
  const restaurant = owned.docs.find(doc => (doc.data().id || doc.id) === auth.restaurantId);
  if (!restaurant) return { error: NextResponse.json({ error: "Restaurant non autorisé." }, { status: 403 }) };
  const data = restaurant.data();
  if (data.status === "suspended" || data.isSuspended === true) return { error: NextResponse.json({ error: "Restaurant suspendu." }, { status: 403 }) };
  return { db, restaurantId: auth.restaurantId, restaurant };
}
