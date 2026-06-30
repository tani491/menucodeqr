import { NextRequest, NextResponse } from "next/server";
import { requireActiveRestaurateur } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getFirebaseAdminStorage } from "@/lib/firebaseAdmin";

async function uploadToFirebaseStorage({
  buffer,
  storagePath,
  contentType,
}: {
  buffer: Buffer;
  storagePath: string;
  contentType: string;
}) {
  const storage = getFirebaseAdminStorage();

  if (!storage) {
    return null;
  }

  const bucket = storage.bucket();
  const token = randomUUID();

  await bucket.file(storagePath).save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: "public, max-age=3600",
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    storagePath
  )}?alt=media&token=${token}`;
}

/**
 * POST /api/dashboard/upload
 * Upload de fichiers (image WebP/JPG ou vidéo MP4 ≤ 10 Mo).
 *
 * En local : sauvegarde dans /public/uploads/ et retourne l'URL relative.
 * En production Firebase : upload dans Firebase Storage si l'Admin SDK est configure.
 *
 * Sécurité :
 *   - Vérification authentification + rôle restaurateur
 *   - Validation stricte du type MIME et de la taille
 *   - Nom de fichier UUID pour éviter les collisions
 *   - Pas de restaurantId dans le body — il vient du JWT
 */
export async function POST(request: NextRequest) {
  const auth = await requireActiveRestaurateur();
  if (auth.error) return auth.error;

  if (!auth.restaurantId) {
    return NextResponse.json({ error: "Aucun restaurant associé" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const purpose = formData.get("purpose");

    if (!file) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    }

    // ─── Validation du type MIME ──────────────────────────────────────────
    const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
    const ALLOWED_VIDEO_TYPES = ["video/mp4"];
    const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Type de fichier non autorisé",
          allowed: "Images (JPG, WebP) ou vidéos (MP4)",
        },
        { status: 400 }
      );
    }

    // ─── Validation de la taille ──────────────────────────────────────────
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 Mo pour les images
    const MAX_VIDEO_SIZE = 10 * 1024 * 1024; // 10 Mo pour les vidéos

    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: isVideo
            ? `Vidéo trop volumineuse (${(file.size / 1024 / 1024).toFixed(1)} Mo / 10 Mo max)`
            : `Image trop volumineuse (${(file.size / 1024 / 1024).toFixed(1)} Mo / 5 Mo max)`,
        },
        { status: 400 }
      );
    }

    // ─── Détermination de l'extension ─────────────────────────────────────
    const extensionMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "video/mp4": "mp4",
    };
    const ext = extensionMap[file.type] || "bin";

    // ─── Chemin de sauvegarde ─────────────────────────────────────────────
    // Structure : /public/uploads/{restaurantId}/{uuid}.{ext}
    const filename = `${randomUUID()}.${ext}`;

    // ─── Écriture du fichier ──────────────────────────────────────────────
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const isRestaurantMedia = purpose === "restaurant-media";
    const storagePath = `${isRestaurantMedia ? "restaurant-medias" : "menu-assets"}/${auth.restaurantId}/${filename}`;

    const firebasePublicUrl = await uploadToFirebaseStorage({
      buffer,
      storagePath,
      contentType: file.type,
    });

    if (firebasePublicUrl) {
      return NextResponse.json({
        url: firebasePublicUrl,
        type: isVideo ? "video" : "image",
        filename,
        size: file.size,
        message: isVideo ? "VidÃ©o uploadÃ©e avec succÃ¨s" : "Image uploadÃ©e avec succÃ¨s",
      });
    }

    const dir = join(process.cwd(), "public", "uploads", auth.restaurantId);
    await mkdir(dir, { recursive: true });

    const filepath = join(dir, filename);
    await writeFile(filepath, buffer);

    // URL relative accessible publiquement
    const publicUrl = `/uploads/${auth.restaurantId}/${filename}`;

    return NextResponse.json({
      url: publicUrl,
      type: isVideo ? "video" : "image",
      filename,
      size: file.size,
      message: isVideo
        ? "Vidéo uploadée avec succès (max 10 Mo pour le mobile)"
        : "Image uploadée avec succès",
    });
  } catch (error) {
    console.error("[UPLOAD ERROR]", error);
    return NextResponse.json({ error: "Erreur lors de l'upload" }, { status: 500 });
  }
}
