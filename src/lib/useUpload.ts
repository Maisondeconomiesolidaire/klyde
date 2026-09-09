import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Compression des photos avant envoi.
 *
 * Les photos du stock arrivaient telles quelles, à 3 ou 4 Mo pièce : la
 * conversion échouait en silence et le fichier d'origine repartait. Deux
 * causes, corrigées ici — les photos HEIC de l'iPhone, que `createImageBitmap`
 * ne sait pas lire, et le format de sortie annoncé sans vérifier ce que le
 * navigateur a réellement produit (sans encodeur WebP, `toBlob` rend un PNG).
 */
const MAX_DIMENSION = 1800;
const WEBP_QUALITY = 0.84;
const JPEG_QUALITY = 0.85;

/** Extension cohérente avec le type réellement produit par le navigateur. */
const EXTENSIONS: Record<string, string> = {
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

function isHeicImage(file: File) {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

/** Convertit une photo HEIC en JPEG ; `heic2any` n'est chargé qu'au besoin. */
async function convertHeicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(result) ? result[0] : result;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
    type: "image/jpeg",
  });
}

async function compressImage(file: File): Promise<File> {
  const heic = isHeicImage(file);
  if (!heic && (!file.type.startsWith("image/") || file.type === "image/gif")) return file;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return file;
  }

  let source = file;
  if (heic) {
    try {
      source = await convertHeicToJpeg(file);
    } catch {
      throw new Error("Impossible de convertir cette photo HEIC. Envoyez une photo en JPEG ou PNG.");
    }
  }

  try {
    const bitmap = await createImageBitmap(source);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return source;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const encode = (type: string, quality: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

    let blob = await encode("image/webp", WEBP_QUALITY);
    // Repli JPEG : sans encodeur WebP, `toBlob` rend un PNG non compressé,
    // souvent plus lourd que la photo d'origine — donc rejeté plus bas, et le
    // fichier de 4 Mo partait tel quel.
    if (blob && blob.type !== "image/webp") {
      blob = (await encode("image/jpeg", JPEG_QUALITY)) ?? blob;
    }
    if (!blob || blob.size >= source.size) return source;
    const extension = EXTENSIONS[blob.type] ?? ".img";
    return new File([blob], source.name.replace(/\.[^.]+$/, "") + extension, {
      type: blob.type,
    });
  } catch {
    return source;
  }
}

/** Recompression d'un fichier déjà stocké (rattrapage des photos trop lourdes). */
export async function optimizeImageFile(file: File) {
  return await compressImage(file);
}

export function useUpload() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  return async function upload(file: File): Promise<Id<"_storage">> {
    const optimized = await compressImage(file);
    const url = await generateUploadUrl();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": optimized.type },
      body: optimized,
    });
    if (!response.ok) throw new Error("Echec de l'envoi de la photo.");
    const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
    return storageId;
  };
}
