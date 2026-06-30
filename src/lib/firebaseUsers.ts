import { getFirebaseAdminAuth } from "@/lib/firebaseAdmin";

function getFirebaseErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error ? String(error.code) : "";
}

export async function upsertFirebaseRestaurateur({
  name,
  email,
  password,
  restaurantId,
}: {
  name: string;
  email: string;
  password: string;
  restaurantId: string;
}) {
  const adminAuth = getFirebaseAdminAuth();

  if (!adminAuth) {
    return { synced: false, uid: null as string | null };
  }

  const normalizedEmail = email.trim().toLowerCase();
  let userRecord;

  try {
    userRecord = await adminAuth.getUserByEmail(normalizedEmail);
    userRecord = await adminAuth.updateUser(userRecord.uid, {
      displayName: name.trim(),
      password,
      disabled: false,
    });
  } catch (error) {
    const code = getFirebaseErrorCode(error);
    if (code !== "auth/user-not-found") {
      throw error;
    }

    userRecord = await adminAuth.createUser({
      email: normalizedEmail,
      password,
      displayName: name.trim(),
      emailVerified: false,
      disabled: false,
    });
  }

  await adminAuth.setCustomUserClaims(userRecord.uid, {
    role: "restaurateur",
    restaurantId,
  });

  return { synced: true, uid: userRecord.uid };
}
