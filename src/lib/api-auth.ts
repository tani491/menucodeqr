import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebaseAdmin";

export async function requireAuth() {
  if (!process.env.NEXTAUTH_SECRET) {
    return { error: NextResponse.json({ error: "Authentification indisponible." }, { status: 503 }) } as const;
  }
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Non autorise" }, { status: 401 }) } as const;
  }

  // A signed token must not retain privileges after a role/tenant reassignment.
  try {
    const firestore = getFirebaseAdminFirestore();
    const firebaseAuth = getFirebaseAdminAuth();
    if (!firestore || !firebaseAuth) throw new Error("Firebase Admin indisponible");
    const user = await firebaseAuth.getUser(session.user.id);
    let profile = await firestore.collection("users").doc(session.user.id).get();
    if (!profile.exists) profile = await firestore.collection("accounts").doc(session.user.id).get();
    const data = profile.data();
    if (user.disabled || !data || data.status === "suspended" || data.role !== session.user.role ||
        (data.restaurantId || null) !== session.user.restaurantId) {
      return { error: NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 }) } as const;
    }
  } catch {
    return { error: NextResponse.json({ error: "Vérification de session indisponible." }, { status: 503 }) } as const;
  }

  return {
    session,
    userId: session.user.id as string,
    role: session.user.role as string,
    restaurantId: session.user.restaurantId as string | null,
  };
}

export async function requireRestaurateur() {
  const auth = await requireAuth();
  if (auth.error) return auth;

  if (auth.role !== "restaurateur") {
    return { error: NextResponse.json({ error: "Acces reserve aux restaurateurs" }, { status: 403 }) } as const;
  }

  if (!auth.restaurantId) {
    return { error: NextResponse.json({ error: "Aucun restaurant associe" }, { status: 403 }) } as const;
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: auth.restaurantId },
    select: { isSuspended: true },
  });

  if (!restaurant) {
    return { error: NextResponse.json({ error: "Restaurant introuvable" }, { status: 404 }) } as const;
  }

  return {
    ...auth,
    restaurantId: auth.restaurantId,
    restaurantIsSuspended: restaurant.isSuspended,
  };
}

export async function requireActiveRestaurateur() {
  const auth = await requireRestaurateur();
  if (auth.error) return auth;

  if (auth.restaurantIsSuspended) {
    return {
      error: NextResponse.json(
        {
          error:
            "Votre compte a ete suspendu pour defaut de paiement. Veuillez contacter l'administrateur de l'application pour regulariser votre situation.",
        },
        { status: 402 }
      ),
    } as const;
  }

  return auth;
}

export function validateRestaurantOwnership(
  userRestaurantId: string | null | undefined,
  requestRestaurantId: string | null | undefined
): boolean {
  if (!userRestaurantId) return false;
  return userRestaurantId === requestRestaurantId;
}

