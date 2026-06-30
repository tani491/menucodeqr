import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function requireAuth() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Non autorise" }, { status: 401 }) } as const;
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

