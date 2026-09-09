import { useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { ImageDown, Loader2, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { optimizeImageFile, useUpload } from "../lib/useUpload";

/** Au-delà, une photo d'article est à recompresser (une vignette fait 40px). */
const HEAVY_BYTES = 500 * 1024;

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
  return `${Math.round(bytes / 1024)} Ko`;
}

/**
 * Rattrapage des photos trop lourdes.
 *
 * Les photos partaient telles qu'envoyées — 3 à 4 Mo pièce — parce que la
 * compression échouait en silence sur les fichiers HEIC et sur les navigateurs
 * sans encodeur WebP. La correction vaut pour les envois à venir ; celles déjà
 * en ligne se rattrapent ici, depuis un navigateur, le runtime Convex n'ayant
 * pas d'encodeur d'image.
 */
export function PhotoRecompressModal({ onClose }: { onClose: () => void }) {
  const items = useQuery(api.klyde.list, {});
  const convex = useConvex();
  const replacePhotos = useMutation(api.klyde.replacePhotos);
  const upload = useUpload();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [saved, setSaved] = useState(0);
  const [current, setCurrent] = useState("");
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");

  const total = items?.length ?? 0;

  async function run() {
    if (!items) return;
    setRunning(true);
    setError("");
    setFinished(false);
    setDone(0);
    let gained = 0;
    try {
      for (const item of items) {
        setCurrent(item.title);
        // Les photos se relisent article par article : la liste ne porte que
        // la couverture, et une requête ne peut pas se déclencher en boucle
        // depuis un hook.
        const urls = await convex.query(api.klyde.photoUrls, { id: item._id });
        const next: Id<"_storage">[] = [];
        let changed = false;
        for (let index = 0; index < urls.length; index += 1) {
          const original = item.photos[index];
          if (!original) continue;
          const response = await fetch(urls[index]);
          if (!response.ok) {
            next.push(original);
            continue;
          }
          const blob = await response.blob();
          if (blob.size <= HEAVY_BYTES) {
            next.push(original);
            continue;
          }
          const file = new File([blob], `photo-${index + 1}.jpg`, {
            type: blob.type || "image/jpeg",
          });
          const optimized = await optimizeImageFile(file);
          if (optimized.size >= blob.size) {
            next.push(original);
            continue;
          }
          next.push(await upload(optimized));
          gained += blob.size - optimized.size;
          changed = true;
        }
        if (changed && next.length > 0) {
          await replacePhotos({ id: item._id, photos: next });
        }
        setDone((value) => value + 1);
        setSaved(gained);
      }
      setFinished(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Recompression impossible.");
    } finally {
      setRunning(false);
      setCurrent("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Alléger les photos</h2>
          <button
            type="button"
            onClick={running ? undefined : onClose}
            disabled={running}
            className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] disabled:opacity-40"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Les photos de plus de {formatBytes(HEAVY_BYTES)} sont retéléchargées,
          recompressées puis renvoyées, et les anciens fichiers supprimés du stockage.
          Les articles gardent les mêmes photos, en plus léger. Laissez cet onglet
          ouvert pendant le traitement.
        </p>

        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>
              {done} / {total} articles traités
            </span>
            <span className="font-semibold tabular-nums text-[var(--primary)]">
              {formatBytes(saved)} économisés
            </span>
          </div>
          {running ? (
            <p className="mt-2 flex items-center gap-2 truncate text-xs text-[var(--muted-foreground)]">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              {current}
            </p>
          ) : null}
          {finished ? (
            <p className="mt-2 text-xs font-semibold text-emerald-500">Terminé.</p>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={() => void run()}
            disabled={running || total === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
            {running ? "Traitement…" : "Lancer"}
          </button>
        </div>
      </div>
    </div>
  );
}
