import { FormEvent, useState } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ImagePlus, Loader2, Package, Pencil, Search, Sparkles, X } from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { cn } from "./lib/cn";
import { useUpload } from "./lib/useUpload";

type FormState = {
  photos: Id<"_storage">[];
  previewUrls: string[];
  title: string;
  description: string;
  category: string;
  brand: string;
  size: string;
  condition: string;
  color: string;
  material: string;
  price: string;
  parcelSize: string;
  gender: string;
  style: string;
  location: string;
  sku: string;
  quantity: string;
  aiConfidence?: number;
  aiNotes: string;
};

const initialForm: FormState = {
  photos: [],
  previewUrls: [],
  title: "",
  description: "",
  category: "",
  brand: "",
  size: "",
  condition: "Bon état",
  color: "",
  material: "",
  price: "",
  parcelSize: "Moyen",
  gender: "",
  style: "",
  location: "",
  sku: "",
  quantity: "1",
  aiNotes: "",
};

const conditions = [
  "Neuf avec étiquette",
  "Neuf sans étiquette",
  "Très bon état",
  "Bon état",
  "Satisfaisant",
];

type ListedItem = Doc<"klydeItems"> & { photoUrls: string[] };

function inputClass() {
  return "h-10 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]";
}

function asNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={cn("grid gap-1.5", wide && "md:col-span-2")}>
      <span className="text-xs font-medium text-[var(--muted-foreground)]">{label}</span>
      {children}
    </label>
  );
}

function Logo() {
  return <div className="text-xl font-semibold text-[var(--logo)]">Klyde</div>;
}

function AppContent() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<Id<"klydeItems"> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [extraDetails, setExtraDetails] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useUpload();
  const analyzePhotos = useAction(api.klyde.analyzePhotos);
  const createItem = useMutation(api.klyde.create);
  const updateItem = useMutation(api.klyde.update);
  const updateStatus = useMutation(api.klyde.updateStatus);
  const items = useQuery(api.klyde.list, { searchText: searchText || undefined });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openNewArticle() {
    setEditingId(null);
    setForm(initialForm);
    setExtraDetails("");
    setError(null);
    setDrawerOpen(true);
  }

  function openEditArticle(item: ListedItem) {
    setEditingId(item._id);
    setForm({
      photos: item.photos,
      previewUrls: item.photoUrls,
      title: item.title,
      description: item.description,
      category: item.category,
      brand: item.brand ?? "",
      size: item.size ?? "",
      condition: item.condition,
      color: item.color ?? "",
      material: item.material ?? "",
      price: item.price != null ? String(item.price) : "",
      parcelSize: item.parcelSize ?? "Moyen",
      gender: item.gender ?? "",
      style: item.style ?? "",
      location: item.location ?? "",
      sku: item.sku ?? "",
      quantity: String(item.quantity),
      aiConfidence: item.aiConfidence,
      aiNotes: item.aiNotes ?? "",
    });
    setExtraDetails("");
    setError(null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingId(null);
    setForm(initialForm);
    setExtraDetails("");
    setError(null);
  }

  function removePhoto(index: number) {
    setForm((current) => ({
      ...current,
      photos: current.photos.filter((_, photoIndex) => photoIndex !== index),
      previewUrls: current.previewUrls.filter((_, photoIndex) => photoIndex !== index),
    }));
  }

  async function handleFiles(files: FileList | null) {
    const selected = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (selected.length === 0) return;
    setError(null);
    setBusy("upload");
    try {
      const uploaded: Id<"_storage">[] = [];
      for (const file of selected) {
        uploaded.push(await upload(file));
      }
      setForm((current) => ({
        ...current,
        photos: [...current.photos, ...uploaded],
        previewUrls: [...current.previewUrls, ...selected.map((file) => URL.createObjectURL(file))],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function runAnalysis() {
    if (form.photos.length === 0) {
      setError("Ajoute au moins une photo avant l'analyse.");
      return;
    }
    setError(null);
    setBusy("analysis");
    try {
      const result = await analyzePhotos({
        storageIds: form.photos,
        extraDetails: extraDetails || undefined,
      });
      setForm((current) => ({
        ...current,
        title: result.title ?? current.title,
        description: result.description ?? current.description,
        category: result.category ?? current.category,
        brand: result.brand ?? "",
        size: result.size ?? "",
        condition: result.condition ?? current.condition,
        color: result.color ?? "",
        material: result.material ?? "",
        price: result.price != null ? String(result.price) : current.price,
        parcelSize: result.parcelSize ?? current.parcelSize,
        gender: result.gender ?? "",
        style: result.style ?? "",
        aiConfidence: result.aiConfidence ?? undefined,
        aiNotes: result.aiNotes ?? "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analyse impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.photos.length === 0) {
      setError("Ajoute au moins une photo.");
      return;
    }
    setError(null);
    setBusy("save");
    try {
      const payload = {
        photos: form.photos,
        title: form.title,
        description: form.description,
        category: form.category,
        brand: form.brand || undefined,
        size: form.size || undefined,
        condition: form.condition,
        color: form.color || undefined,
        material: form.material || undefined,
        price: asNumber(form.price),
        parcelSize: form.parcelSize || undefined,
        gender: form.gender || undefined,
        style: form.style || undefined,
        location: form.location || undefined,
        sku: form.sku || undefined,
        quantity: asNumber(form.quantity),
        aiConfidence: form.aiConfidence,
        aiNotes: form.aiNotes || undefined,
      };
      if (editingId) {
        await updateItem({ id: editingId, ...payload });
      } else {
        await createItem(payload);
      }
      closeDrawer();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside className="hidden w-56 shrink-0 border-r border-[var(--border)] bg-[var(--sidebar)] p-4 md:block">
        <Logo />
        <nav className="mt-8">
          <button className="flex w-full items-center gap-2 rounded-md bg-[var(--sidebar-active)] px-3 py-2 text-left text-sm font-medium">
            <Package className="h-4 w-4" />
            Articles
          </button>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--background)] px-3 py-3 md:px-6">
          <div className="shrink-0 md:hidden">
            <Logo />
          </div>
          <h1 className="hidden text-lg font-semibold md:block">Articles</h1>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={openNewArticle}
              className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white sm:px-4"
            >
              Nouvel article
            </button>
            <UserButton />
          </div>
        </header>

        <main className="p-3 sm:p-4 md:p-6">
          <div className="mb-5 flex w-full max-w-md items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--input)] px-3">
            <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Rechercher un article"
            />
          </div>

          {items === undefined ? (
            <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement du stock
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-8 text-sm text-[var(--muted-foreground)]">
              Aucun article.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {items.map((item) => (
                <article
                  key={item._id}
                  className="rounded-md border border-[var(--border)] bg-[var(--card)]"
                >
                  <img
                    src={item.photoUrls[0] ?? ""}
                    alt=""
                    className="aspect-square w-full rounded-t-md bg-[var(--muted)] object-cover"
                  />
                  <div className="grid gap-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="line-clamp-2 text-sm font-semibold">{item.title}</h2>
                      <span className="shrink-0 text-sm font-semibold">
                        {item.price != null ? `${item.price.toFixed(2)} €` : "-"}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {[item.brand, item.size, item.condition].filter(Boolean).join(" · ")}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {[item.category, item.color].filter(Boolean).join(" · ")}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        Stock x{item.quantity}
                      </span>
                      <select
                        value={item.status}
                        onChange={(event) =>
                          void updateStatus({
                            id: item._id,
                            status: event.target.value as "en_stock" | "reserve" | "vendu" | "archive",
                          })
                        }
                        className="rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-xs"
                      >
                        <option value="en_stock">En stock</option>
                        <option value="reserve">Réservé</option>
                        <option value="vendu">Vendu</option>
                        <option value="archive">Archive</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditArticle(item)}
                      className="mt-1 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] text-sm font-medium"
                    >
                      <Pencil className="h-4 w-4" />
                      Modifier
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/20">
          <form
            onSubmit={submit}
            className="h-full w-full overflow-y-auto bg-[var(--background)] sm:max-w-2xl sm:border-l sm:border-[var(--border)]"
          >
            <div className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--background)] px-3 py-3 sm:px-4">
              <h2 className="min-w-0 text-base font-semibold">{editingId ? "Modifier l’article" : "Nouvel article"}</h2>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-md border border-[var(--border)] p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-4">
              <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-[var(--card)] p-4 text-center">
                <ImagePlus className="h-7 w-7 text-[var(--muted-foreground)]" />
                <span className="mt-2 text-sm font-medium">Ajouter des photos</span>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => void handleFiles(event.target.files)}
                />
              </label>

              {form.previewUrls.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {form.previewUrls.map((url, index) => (
                    <div key={`${url}-${index}`} className="relative">
                      <img
                        src={url}
                        alt=""
                        className="aspect-square w-full rounded-md border border-[var(--border)] object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute right-1 top-1 rounded-md bg-black/70 p-1 text-white"
                        aria-label="Supprimer la photo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <textarea
                value={extraDetails}
                onChange={(event) => setExtraDetails(event.target.value)}
                className="min-h-20 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                placeholder="Précision optionnelle pour l’IA"
              />

              <button
                type="button"
                onClick={() => void runAnalysis()}
                disabled={busy === "analysis" || busy === "upload" || form.photos.length === 0}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "analysis" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Analyser les photos
              </button>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Titre" wide>
                  <input className={inputClass()} value={form.title} onChange={(e) => update("title", e.target.value)} required />
                </Field>
                <Field label="Description" wide>
                  <textarea className="min-h-24 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" value={form.description} onChange={(e) => update("description", e.target.value)} required />
                </Field>
                <Field label="Catégorie">
                  <input className={inputClass()} value={form.category} onChange={(e) => update("category", e.target.value)} required />
                </Field>
                <Field label="Marque">
                  <input className={inputClass()} value={form.brand} onChange={(e) => update("brand", e.target.value)} />
                </Field>
                <Field label="Taille">
                  <input className={inputClass()} value={form.size} onChange={(e) => update("size", e.target.value)} />
                </Field>
                <Field label="État">
                  <select className={inputClass()} value={form.condition} onChange={(e) => update("condition", e.target.value)}>
                    {conditions.map((condition) => (
                      <option key={condition}>{condition}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Couleur">
                  <input className={inputClass()} value={form.color} onChange={(e) => update("color", e.target.value)} />
                </Field>
                <Field label="Matière">
                  <input className={inputClass()} value={form.material} onChange={(e) => update("material", e.target.value)} />
                </Field>
                <Field label="Prix">
                  <input className={inputClass()} inputMode="decimal" value={form.price} onChange={(e) => update("price", e.target.value)} />
                </Field>
                <Field label="Colis">
                  <select className={inputClass()} value={form.parcelSize} onChange={(e) => update("parcelSize", e.target.value)}>
                    <option>Petit</option>
                    <option>Moyen</option>
                    <option>Grand</option>
                  </select>
                </Field>
                <Field label="Genre">
                  <input className={inputClass()} value={form.gender} onChange={(e) => update("gender", e.target.value)} />
                </Field>
                <Field label="Style">
                  <input className={inputClass()} value={form.style} onChange={(e) => update("style", e.target.value)} />
                </Field>
                <Field label="Emplacement">
                  <input className={inputClass()} value={form.location} onChange={(e) => update("location", e.target.value)} />
                </Field>
                <Field label="Référence">
                  <input className={inputClass()} value={form.sku} onChange={(e) => update("sku", e.target.value)} />
                </Field>
                <Field label="Quantité">
                  <input className={inputClass()} inputMode="numeric" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} />
                </Field>
                <Field label="Notes IA">
                  <input className={inputClass()} value={form.aiNotes} onChange={(e) => update("aiNotes", e.target.value)} />
                </Field>
              </div>

              <button
                type="submit"
                disabled={busy === "save" || busy === "upload"}
                className="h-11 rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "save"
                  ? "Enregistrement..."
                  : editingId
                    ? "Enregistrer les modifications"
                    : "Ajouter au stock"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <>
      <SignedOut>
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6 text-[var(--foreground)]">
          <div className="w-full max-w-sm rounded-md border border-[var(--border)] bg-[var(--card)] p-6">
            <Logo />
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">
              Connecte-toi pour accéder à ton stock.
            </p>
            <SignInButton mode="modal">
              <button className="mt-6 w-full rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">
                Connexion
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <AppContent />
      </SignedIn>
    </>
  );
}
