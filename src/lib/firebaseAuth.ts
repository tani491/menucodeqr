import { getFirebasePublicConfig } from "./firebaseConfig";

export async function verifyFirebaseEmailPassword(email: string, password: string) {
  let apiKey = "";

  try {
    apiKey = getFirebasePublicConfig().apiKey || "";
  } catch {
    return null;
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
        cache: "no-store",
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}
