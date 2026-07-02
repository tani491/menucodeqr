export async function verifyFirebaseEmailPassword(email: string, password: string) {
  const apiKey = "AIzaSyBUJunuUW_346uq0lygcouc_66wrBIkYNU";

  if (!apiKey) {
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
