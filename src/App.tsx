import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton, useClerk, useUser } from "@clerk/clerk-react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Kanban,
  LayoutGrid,
  List,
  Loader2,
  Package,
  Pencil,
  Scissors,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Trash2,
  Trophy,
  User,
  X,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { cn } from "./lib/cn";
import { useKlydeCart } from "./lib/useKlydeCart";
import { useUpload } from "./lib/useUpload";

type KlydeStatus = "stock" | "en_ligne" | "en_cours_envoi" | "envoye" | "gagne" | "archive";
type AppTab = "stock" | "suivi";
type StockMode = "cards" | "list";
type TrackingTab = "process" | "gagne";
type DetailMode = "article" | "demande";
type ShopRoute = "/boutique" | "/boutique/panier";

type FormState = {
  photos: Id<"_storage">[];
  previewUrls: string[];
  title: string;
  description: string;
  category: string;
  subcategory: string;
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

type ListedItem = Doc<"klydeItems"> & { photoUrls: string[] };
type ShopItem = ListedItem;

const initialForm: FormState = {
  photos: [],
  previewUrls: [],
  title: "",
  description: "",
  category: "Vêtements",
  subcategory: "",
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

const categoryTree = {
  Vêtements: [
    "Manteaux et vestes",
    "Pulls et gilets",
    "Sweats",
    "Chemises et blouses",
    "T-shirts et tops",
    "Robes",
    "Jupes",
    "Pantalons",
    "Jeans",
    "Shorts",
    "Ensembles",
    "Sous-vêtements",
    "Pyjamas",
    "Sport",
    "Maillots de bain",
  ],
  Chaussures: [
    "Baskets",
    "Bottes et bottines",
    "Sandales",
    "Escarpins",
    "Mocassins",
    "Chaussures de ville",
    "Chaussures de sport",
  ],
  Accessoires: [
    "Sacs",
    "Ceintures",
    "Chapeaux et bonnets",
    "Écharpes et foulards",
    "Bijoux",
    "Lunettes",
    "Accessoires cheveux",
  ],
  "Bébé et enfant": [
    "Bodies",
    "Pyjamas",
    "Hauts",
    "Bas",
    "Robes et ensembles",
    "Manteaux",
    "Chaussures enfant",
    "Accessoires enfant",
  ],
} as const;

const categories = Object.keys(categoryTree) as Array<keyof typeof categoryTree>;
const genders = ["Femme", "Homme", "Enfant", "Bébé", "Unisexe"];
const sizes = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "34",
  "36",
  "38",
  "40",
  "42",
  "44",
  "46",
  "48",
  "50",
  "Naissance",
  "1 mois",
  "3 mois",
  "6 mois",
  "9 mois",
  "12 mois",
  "18 mois",
  "2 ans",
  "3 ans",
  "4 ans",
  "5 ans",
  "6 ans",
  "8 ans",
  "10 ans",
  "12 ans",
  "14 ans",
  "16 ans",
  "Pointure 20-24",
  "Pointure 25-29",
  "Pointure 30-34",
  "Pointure 35-39",
  "Pointure 40-44",
  "Pointure 45+",
  "Unique",
];
const colors = [
  "Noir",
  "Blanc",
  "Beige",
  "Gris",
  "Bleu",
  "Marine",
  "Rouge",
  "Rose",
  "Vert",
  "Jaune",
  "Orange",
  "Violet",
  "Marron",
  "Multicolore",
];
const materials = [
  "Coton",
  "Lin",
  "Laine",
  "Cachemire",
  "Soie",
  "Cuir",
  "Daim",
  "Denim",
  "Polyester",
  "Viscose",
  "Élasthanne",
  "Synthétique",
  "Mélange",
];

const processColumns: Array<{ status: KlydeStatus; label: string }> = [
  { status: "en_ligne", label: "En ligne" },
  { status: "en_cours_envoi", label: "En cours d’envoi" },
  { status: "envoye", label: "Envoyé" },
];

function inputClass() {
  return "h-10 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]";
}

function asNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatPrice(value?: number) {
  if (value == null) return "Prix sur demande";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function currentRoute(): ShopRoute | "" {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash === "/boutique/panier") return "/boutique/panier" satisfies ShopRoute;
  if (hash === "/boutique") return "/boutique" satisfies ShopRoute;
  return "";
}

function goTo(path: ShopRoute | "") {
  window.location.hash = path;
}

function itemStatus(item: ListedItem): KlydeStatus {
  if (item.status === "en_stock" || item.status === "reserve") return "stock";
  if (item.status === "vendu") return "gagne";
  return item.status as KlydeStatus;
}

function statusLabel(status: string) {
  const normalized = status === "en_stock" || status === "reserve" ? "stock" : status;
  return (
    {
      stock: "Stock",
      en_ligne: "En ligne",
      en_cours_envoi: "En cours d’envoi",
      envoye: "Envoyé",
      gagne: "Gagné",
      vendu: "Gagné",
      archive: "Archivé",
    }[normalized] ?? "Stock"
  );
}

function revokeLocalPreview(url: string) {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export PNG impossible."))),
      "image/png",
      0.95,
    );
  });
}

async function composeNeutralWhiteBackground(foregroundBlob: Blob) {
  const image = await createImageBitmap(foregroundBlob);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas non disponible pour le détourage.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  image.close();

  return canvasToPngBlob(canvas);
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
  return (
    <picture className="block">
      <source srcSet="/logo-dark.png" media="(prefers-color-scheme: dark)" />
      <img
        src="/logo-light.png"
        alt="Klyde"
        className="h-12 w-auto object-contain"
      />
    </picture>
  );
}

function ArticleThumb({ item }: { item: ListedItem }) {
  return (
    <img
      src={item.photoUrls[0] ?? ""}
      alt=""
      className="aspect-square w-full rounded-t-md bg-[var(--muted)] object-cover"
    />
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<AppTab>("stock");
  const [stockMode, setStockMode] = useState<StockMode>("cards");
  const [trackingTab, setTrackingTab] = useState<TrackingTab>("process");
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<Id<"klydeItems"> | null>(null);
  const [detailItemId, setDetailItemId] = useState<Id<"klydeItems"> | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>("article");
  const [deleteTarget, setDeleteTarget] = useState<ListedItem | null>(null);
  const [trackingNoteDraft, setTrackingNoteDraft] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [extraDetails, setExtraDetails] = useState("");
  const [draggedId, setDraggedId] = useState<Id<"klydeItems"> | null>(null);
  const [dropTarget, setDropTarget] = useState<KlydeStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useUpload();
  const analyzePhotos = useAction(api.klyde.analyzePhotos);
  const createItem = useMutation(api.klyde.create);
  const updateItem = useMutation(api.klyde.update);
  const updateStatus = useMutation(api.klyde.updateStatus);
  const updateTrackingNotes = useMutation(api.klyde.updateTrackingNotes);
  const removeItem = useMutation(api.klyde.remove);
  const items = useQuery(api.klyde.list, { searchText: searchText || undefined });

  const allItems = items ?? [];
  const visibleItems = useMemo(
    () =>
      allItems.filter((item) => {
        if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
        if (subcategoryFilter !== "all" && item.subcategory !== subcategoryFilter) return false;
        if (genderFilter !== "all" && item.gender !== genderFilter) return false;
        if (sizeFilter !== "all" && item.size !== sizeFilter) return false;
        return true;
      }),
    [allItems, categoryFilter, genderFilter, sizeFilter, subcategoryFilter],
  );
  const availableSubcategories =
    categoryFilter !== "all" && categoryFilter in categoryTree
      ? categoryTree[categoryFilter as keyof typeof categoryTree]
      : Array.from(new Set(categories.flatMap((category) => categoryTree[category])));
  const processItems = useMemo(
    () => visibleItems.filter((item) => processColumns.some((column) => column.status === itemStatus(item))),
    [visibleItems],
  );
  const wonItems = useMemo(
    () => visibleItems.filter((item) => itemStatus(item) === "gagne"),
    [visibleItems],
  );
  const detailItem = useMemo(
    () => visibleItems.find((item) => item._id === detailItemId) ?? null,
    [detailItemId, visibleItems],
  );

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
    setDetailItemId(null);
    setEditingId(item._id);
    setForm({
      photos: item.photos,
      previewUrls: item.photoUrls,
      title: item.title,
      description: item.description,
      category: item.category,
      subcategory: item.subcategory ?? "",
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
    form.previewUrls.forEach(revokeLocalPreview);
    setDrawerOpen(false);
    setEditingId(null);
    setForm(initialForm);
    setExtraDetails("");
    setError(null);
  }

  function openDetail(item: ListedItem, mode: DetailMode) {
    setDetailItemId(item._id);
    setDetailMode(mode);
    setTrackingNoteDraft(item.trackingNotes ?? "");
  }

  function closeDetail() {
    setDetailItemId(null);
    setTrackingNoteDraft("");
  }

  function removePhoto(index: number) {
    revokeLocalPreview(form.previewUrls[index] ?? "");
    setForm((current) => ({
      ...current,
      photos: current.photos.filter((_, photoIndex) => photoIndex !== index),
      previewUrls: current.previewUrls.filter((_, photoIndex) => photoIndex !== index),
    }));
  }

  function requestDelete(item: ListedItem) {
    setDeleteTarget(item);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const targetId = deleteTarget._id;
    await removeItem({ id: targetId });
    setDeleteTarget(null);
    if (detailItemId === targetId) closeDetail();
  }

  async function moveItem(id: Id<"klydeItems">, status: KlydeStatus) {
    await updateStatus({ id, status });
  }

  async function saveTrackingNotes() {
    if (!detailItem) return;
    setBusy("notes");
    try {
      await updateTrackingNotes({
        id: detailItem._id,
        trackingNotes: trackingNoteDraft || undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  function handleDrop(event: DragEvent, status: KlydeStatus) {
    event.preventDefault();
    const raw = event.dataTransfer.getData("text/plain");
    const id = (raw || draggedId) as Id<"klydeItems"> | null;
    setDraggedId(null);
    setDropTarget(null);
    if (!id) return;
    void moveItem(id, status);
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

  async function removeBackgrounds() {
    if (form.photos.length === 0) {
      setError("Ajoute au moins une photo avant le détourage.");
      return;
    }

    const currentPhotoIds = form.photos;
    const currentPreviewUrls = form.previewUrls;

    setError(null);
    setBusy("background");
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const processedIds: Id<"_storage">[] = [];
      const processedUrls: string[] = [];

      for (let index = 0; index < currentPreviewUrls.length; index += 1) {
        const response = await fetch(currentPreviewUrls[index]);
        if (!response.ok) {
          throw new Error(`Photo ${index + 1} impossible à charger.`);
        }

        const sourceBlob = await response.blob();
        const cutoutBlob = await removeBackground(sourceBlob, {
          output: {
            format: "image/png",
            quality: 0.95,
          },
        });
        const finalBlob = await composeNeutralWhiteBackground(cutoutBlob);
        const file = new File([finalBlob], `klyde-detoure-${Date.now()}-${index + 1}.png`, {
          type: "image/png",
        });

        processedIds.push(await upload(file));
        processedUrls.push(URL.createObjectURL(finalBlob));
      }

      currentPreviewUrls.forEach(revokeLocalPreview);
      setForm((current) => {
        if (current.photos !== currentPhotoIds) return current;
        return {
          ...current,
          photos: processedIds,
          previewUrls: processedUrls,
        };
      });
    } catch (err) {
      setError(err instanceof Error ? `Détourage : ${err.message}` : "Erreur lors du détourage.");
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
        subcategory: result.subcategory ?? current.subcategory,
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
        subcategory: form.subcategory || undefined,
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

  const formSubcategories =
    form.category in categoryTree
      ? categoryTree[form.category as keyof typeof categoryTree]
      : [];

  const navButton = (tab: AppTab, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium",
        activeTab === tab && "bg-[var(--sidebar-active)]",
      )}
    >
      {icon}
      {label}
    </button>
  );

  const actionButtons = (item: ListedItem) => (
    <div className="grid gap-2">
      {activeTab === "stock" ? (
        itemStatus(item) === "stock" || itemStatus(item) === "archive" ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void moveItem(item._id, "en_ligne");
            }}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--primary)] text-sm font-semibold text-white"
          >
            En ligne
          </button>
        ) : (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void moveItem(item._id, "stock");
            }}
            className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--border)] text-sm font-medium"
          >
            Remettre en stock
          </button>
        )
      ) : null}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          requestDelete(item);
        }}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] text-sm font-medium text-red-600"
      >
        <Trash2 className="h-4 w-4" />
        Supprimer
      </button>
    </div>
  );

  const articleCard = (
    item: ListedItem,
    draggable = false,
    detailType: DetailMode = "article",
  ) => (
    <article
      key={item._id}
      draggable={draggable}
      onClick={() => openDetail(item, detailType)}
      onDragStart={(event) => {
        setDraggedId(item._id);
        event.dataTransfer.setData("text/plain", item._id);
      }}
      className="cursor-pointer rounded-md border border-[var(--border)] bg-[var(--card)]"
    >
      <ArticleThumb item={item} />
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
          {[item.gender, item.category, item.subcategory, item.color].filter(Boolean).join(" · ")}
        </div>
        <div className="flex items-center justify-between pt-1 text-xs text-[var(--muted-foreground)]">
          <span>Stock x{item.quantity}</span>
          <span>{statusLabel(item.status)}</span>
        </div>
        {actionButtons(item)}
      </div>
    </article>
  );

  const articleRow = (item: ListedItem) => (
    <article
      key={item._id}
      onClick={() => openDetail(item, "article")}
      className="grid gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-3 sm:grid-cols-[72px_1fr_auto]"
    >
      <img
        src={item.photoUrls[0] ?? ""}
        alt=""
        className="aspect-square w-20 rounded-md bg-[var(--muted)] object-cover sm:w-[72px]"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">{item.title}</h2>
          <span className="rounded-md bg-[var(--muted)] px-2 py-1 text-xs">
            {statusLabel(item.status)}
          </span>
        </div>
        <div className="mt-1 text-sm text-[var(--muted-foreground)]">
          {[item.brand, item.gender, item.size, item.category, item.subcategory, item.condition]
            .filter(Boolean)
            .join(" · ")}
        </div>
        <div className="mt-1 text-sm text-[var(--muted-foreground)]">
          {item.sku ? `Réf. ${item.sku}` : "Sans référence"}
        </div>
      </div>
      <div className="grid gap-2 sm:min-w-56 sm:justify-items-end">
        <div className="font-semibold">{item.price != null ? `${item.price.toFixed(2)} €` : "-"}</div>
        <div className="w-full sm:w-56">{actionButtons(item)}</div>
      </div>
    </article>
  );

  const kanbanCard = (item: ListedItem) => (
    <article
      key={item._id}
      draggable
      onClick={() => openDetail(item, "demande")}
      onDragStart={(event) => {
        setDraggedId(item._id);
        event.dataTransfer.setData("text/plain", item._id);
      }}
      onDragEnd={() => {
        setDraggedId(null);
        setDropTarget(null);
      }}
      className="grid cursor-grab grid-cols-[56px_1fr] gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] p-2 active:cursor-grabbing"
    >
      <img
        src={item.photoUrls[0] ?? ""}
        alt=""
        className="h-14 w-14 rounded-md bg-[var(--muted)] object-cover"
      />
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-xs font-semibold leading-4">{item.title}</h3>
          <span className="shrink-0 text-xs font-semibold">
            {item.price != null ? `${item.price.toFixed(0)} €` : "-"}
          </span>
        </div>
        <div className="mt-1 truncate text-[11px] text-[var(--muted-foreground)]">
          {[item.brand, item.gender, item.size].filter(Boolean).join(" · ") || item.subcategory || item.category}
        </div>
        <div className="mt-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              requestDelete(item);
            }}
            className="rounded border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-red-600"
          >
            Supprimer
          </button>
        </div>
      </div>
    </article>
  );

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] p-4 md:flex">
        <div>
          <div className="flex justify-center">
            <Logo />
          </div>
          <nav className="mt-8 grid gap-1">
            {navButton("stock", <Package className="h-4 w-4" />, "Stock")}
            {navButton("suivi", <Kanban className="h-4 w-4" />, "Suivi")}
          </nav>
        </div>
        <button
          type="button"
          onClick={() => goTo("/boutique")}
          className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-3 text-sm font-semibold text-white"
        >
          <ShoppingBag className="h-4 w-4" />
          Voir la boutique
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--background)] px-3 py-3 md:px-6">
          <div className="shrink-0 md:hidden">
            <Logo />
          </div>
          <h1 className="hidden text-lg font-semibold md:block">
            {activeTab === "stock" ? "Stock" : "Suivi"}
          </h1>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={openNewArticle}
              className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white sm:px-4"
            >
              Nouvel article
            </button>
            <button
              type="button"
              onClick={() => goTo("/boutique")}
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold md:hidden"
            >
              Boutique
            </button>
            <UserButton />
          </div>
        </header>

        <div className="grid grid-cols-2 border-b border-[var(--border)] md:hidden">
          <button
            type="button"
            onClick={() => setActiveTab("stock")}
            className={cn("py-3 text-sm font-medium", activeTab === "stock" && "bg-[var(--muted)]")}
          >
            Stock
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("suivi")}
            className={cn("py-3 text-sm font-medium", activeTab === "suivi" && "bg-[var(--muted)]")}
          >
            Suivi
          </button>
        </div>

        <main className="p-3 sm:p-4 md:p-6">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full max-w-md items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--input)] px-3">
              <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
              <input
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Rechercher un article"
              />
            </div>

            {activeTab === "stock" ? (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={categoryFilter}
                  onChange={(event) => {
                    setCategoryFilter(event.target.value);
                    setSubcategoryFilter("all");
                  }}
                  className="h-10 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
                >
                  <option value="all">Toutes catégories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <select
                  value={subcategoryFilter}
                  onChange={(event) => setSubcategoryFilter(event.target.value)}
                  className="h-10 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
                >
                  <option value="all">Toutes sous-catégories</option>
                  {availableSubcategories.map((subcategory) => (
                    <option key={subcategory} value={subcategory}>
                      {subcategory}
                    </option>
                  ))}
                </select>
                <select
                  value={genderFilter}
                  onChange={(event) => setGenderFilter(event.target.value)}
                  className="h-10 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
                >
                  <option value="all">Tous genres</option>
                  {genders.map((gender) => (
                    <option key={gender} value={gender}>
                      {gender}
                    </option>
                  ))}
                </select>
                <select
                  value={sizeFilter}
                  onChange={(event) => setSizeFilter(event.target.value)}
                  className="h-10 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
                >
                  <option value="all">Toutes tailles</option>
                  {sizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <div className="inline-flex rounded-md border border-[var(--border)] p-1">
                  <button
                    type="button"
                    onClick={() => setStockMode("cards")}
                    className={cn("rounded px-3 py-2", stockMode === "cards" && "bg-[var(--muted)]")}
                    aria-label="Mode cards"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockMode("list")}
                    className={cn("rounded px-3 py-2", stockMode === "list" && "bg-[var(--muted)]")}
                    aria-label="Mode liste"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="inline-flex w-fit rounded-md border border-[var(--border)] p-1">
                <button
                  type="button"
                  onClick={() => setTrackingTab("process")}
                  className={cn("rounded px-3 py-2 text-sm", trackingTab === "process" && "bg-[var(--muted)]")}
                >
                  En cours
                </button>
                <button
                  type="button"
                  onClick={() => setTrackingTab("gagne")}
                  className={cn("rounded px-3 py-2 text-sm", trackingTab === "gagne" && "bg-[var(--muted)]")}
                >
                  Gagné
                </button>
              </div>
            )}
          </div>

          {items === undefined ? (
            <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement du stock
            </div>
          ) : activeTab === "stock" ? (
            visibleItems.length === 0 ? (
              <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-8 text-sm text-[var(--muted-foreground)]">
                Aucun article.
              </div>
            ) : stockMode === "cards" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleItems.map((item) => articleCard(item))}
              </div>
            ) : (
              <div className="grid gap-3">{visibleItems.map((item) => articleRow(item))}</div>
            )
          ) : trackingTab === "gagne" ? (
            wonItems.length === 0 ? (
              <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-8 text-sm text-[var(--muted-foreground)]">
                Aucun article gagné.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {wonItems.map((item) => articleCard(item, false, "demande"))}
              </div>
            )
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {processColumns.map((column) => {
                const columnItems = processItems.filter((item) => itemStatus(item) === column.status);
                return (
                  <section
                    key={column.status}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      if (draggedId) setDropTarget(column.status);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (draggedId && dropTarget !== column.status) {
                        setDropTarget(column.status);
                      }
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setDropTarget((current) => (current === column.status ? null : current));
                      }
                    }}
                    onDrop={(event) => handleDrop(event, column.status)}
                    className={cn(
                      "min-h-72 rounded-md border bg-[var(--card)]",
                      dropTarget === column.status
                        ? "border-[var(--primary)]"
                        : "border-[var(--border)]",
                    )}
                  >
                    <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-3">
                      <h2 className="text-sm font-semibold">{column.label}</h2>
                      <span className="rounded-md bg-[var(--muted)] px-2 py-1 text-xs">
                        {columnItems.length}
                      </span>
                    </div>
                    <div className="grid gap-2 p-2">
                      {dropTarget === column.status ? (
                        <div className="rounded-md border border-dashed border-[var(--primary)] bg-[var(--muted)] px-3 py-2 text-center text-xs font-semibold text-[var(--primary)]">
                          Relâchez
                        </div>
                      ) : null}
                      {columnItems.length === 0 ? (
                        <div className="rounded-md border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
                          Glisse un article ici.
                        </div>
                      ) : (
                        columnItems.map((item) => (
                          <div key={item._id} className="grid gap-2">
                            {kanbanCard(item)}
                            {column.status === "envoye" ? (
                              <button
                                type="button"
                                onClick={() => void moveItem(item._id, "gagne")}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--primary)] text-sm font-semibold text-white"
                              >
                                <Trophy className="h-4 w-4" />
                                Marquer gagné
                              </button>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {detailItem ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-3">
          <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--card)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <div>
                <h2 className="font-semibold">
                  {detailMode === "demande" ? "Fiche demande" : "Fiche article"}
                </h2>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {statusLabel(detailItem.status)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-md border border-[var(--border)] p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-4 md:grid-cols-[220px_1fr]">
              <img
                src={detailItem.photoUrls[0] ?? ""}
                alt=""
                className="aspect-square w-full rounded-md bg-[var(--muted)] object-cover"
              />
              <div className="grid gap-4">
                <div>
                  <h3 className="text-xl font-semibold">{detailItem.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                    {detailItem.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                  {[
                    ["Prix", detailItem.price != null ? `${detailItem.price.toFixed(2)} €` : "-"],
                    ["Marque", detailItem.brand ?? "-"],
                    ["Taille", detailItem.size ?? "-"],
                    ["État", detailItem.condition],
                    ["Genre", detailItem.gender ?? "-"],
                    ["Catégorie", detailItem.category],
                    ["Sous-catégorie", detailItem.subcategory ?? "-"],
                    ["Couleur", detailItem.color ?? "-"],
                    ["Matière", detailItem.material ?? "-"],
                    ["Référence", detailItem.sku ?? "-"],
                    ["Quantité", String(detailItem.quantity)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-[var(--border)] p-3">
                      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
                      <div className="mt-1 font-medium">{value}</div>
                    </div>
                  ))}
                </div>

                {detailMode === "demande" ? (
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="tracking-notes">
                      Notes de suivi
                    </label>
                    <textarea
                      id="tracking-notes"
                      value={trackingNoteDraft}
                      onChange={(event) => setTrackingNoteDraft(event.target.value)}
                      className="min-h-32 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                      placeholder="Ajouter une note, un retour client, un numéro de suivi..."
                    />
                    <button
                      type="button"
                      onClick={() => void saveTrackingNotes()}
                      disabled={busy === "notes"}
                      className="h-10 rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busy === "notes" ? "Enregistrement..." : "Enregistrer les notes"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] px-4 py-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => requestDelete(detailItem)}
                className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-red-600"
              >
                Supprimer
              </button>
              {detailMode === "article" ? (
                <button
                  type="button"
                  onClick={() => openEditArticle(detailItem)}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
                >
                  <Pencil className="h-4 w-4" />
                  Modifier
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3">
          <section className="w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="font-semibold">Supprimer l’article</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Supprimer définitivement “{deleteTarget.title}” ? Cette action ne peut pas être annulée.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Supprimer
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/20">
          <form
            onSubmit={submit}
            className="h-full w-full overflow-y-auto bg-[var(--background)] sm:max-w-2xl sm:border-l sm:border-[var(--border)]"
          >
            <div className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--background)] px-3 py-3 sm:px-4">
              <h2 className="min-w-0 text-base font-semibold">
                {editingId ? "Modifier l’article" : "Nouvel article"}
              </h2>
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

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void removeBackgrounds()}
                  disabled={Boolean(busy) || form.photos.length === 0}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-semibold text-[var(--foreground)] disabled:opacity-50"
                >
                  {busy === "background" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Scissors className="h-4 w-4" />
                  )}
                  Détourer sur fond blanc
                </button>
                <button
                  type="button"
                  onClick={() => void runAnalysis()}
                  disabled={Boolean(busy) || form.photos.length === 0}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === "analysis" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Analyser les photos
                </button>
              </div>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Titre" wide>
                  <input
                    className={inputClass()}
                    value={form.title}
                    onChange={(event) => update("title", event.target.value)}
                    required
                  />
                </Field>
                <Field label="Description" wide>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
                    value={form.description}
                    onChange={(event) => update("description", event.target.value)}
                    required
                  />
                </Field>
                <Field label="Catégorie">
                  <select
                    className={inputClass()}
                    value={form.category}
                    onChange={(event) => {
                      update("category", event.target.value);
                      update("subcategory", "");
                    }}
                    required
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sous-catégorie">
                  <select
                    className={inputClass()}
                    value={form.subcategory}
                    onChange={(event) => update("subcategory", event.target.value)}
                  >
                    <option value="">À préciser</option>
                    {formSubcategories.map((subcategory) => (
                      <option key={subcategory} value={subcategory}>
                        {subcategory}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Marque">
                  <input className={inputClass()} value={form.brand} onChange={(event) => update("brand", event.target.value)} />
                </Field>
                <Field label="Taille">
                  <select className={inputClass()} value={form.size} onChange={(event) => update("size", event.target.value)}>
                    <option value="">À préciser</option>
                    {sizes.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="État">
                  <select className={inputClass()} value={form.condition} onChange={(event) => update("condition", event.target.value)}>
                    {conditions.map((condition) => (
                      <option key={condition}>{condition}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Couleur">
                  <select className={inputClass()} value={form.color} onChange={(event) => update("color", event.target.value)}>
                    <option value="">À préciser</option>
                    {colors.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Matière">
                  <select className={inputClass()} value={form.material} onChange={(event) => update("material", event.target.value)}>
                    <option value="">À préciser</option>
                    {materials.map((material) => (
                      <option key={material} value={material}>
                        {material}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Prix">
                  <input className={inputClass()} inputMode="decimal" value={form.price} onChange={(event) => update("price", event.target.value)} />
                </Field>
                <Field label="Colis">
                  <select className={inputClass()} value={form.parcelSize} onChange={(event) => update("parcelSize", event.target.value)}>
                    <option>Petit</option>
                    <option>Moyen</option>
                    <option>Grand</option>
                  </select>
                </Field>
                <Field label="Genre">
                  <select className={inputClass()} value={form.gender} onChange={(event) => update("gender", event.target.value)}>
                    <option value="">À préciser</option>
                    {genders.map((gender) => (
                      <option key={gender} value={gender}>
                        {gender}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Style">
                  <input className={inputClass()} value={form.style} onChange={(event) => update("style", event.target.value)} />
                </Field>
                <Field label="Emplacement">
                  <input className={inputClass()} value={form.location} onChange={(event) => update("location", event.target.value)} />
                </Field>
                <Field label="Référence">
                  <input className={inputClass()} value={form.sku} onChange={(event) => update("sku", event.target.value)} />
                </Field>
                <Field label="Quantité">
                  <input className={inputClass()} inputMode="numeric" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} />
                </Field>
                <Field label="Notes IA">
                  <input className={inputClass()} value={form.aiNotes} onChange={(event) => update("aiNotes", event.target.value)} />
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

function BoutiqueHeader({ cartCount }: { cartCount: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#1f1b18]/10 bg-[#f6eee5]/95 backdrop-blur">
      <div className="mx-auto flex min-h-20 max-w-[96rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={() => goTo("/boutique")} className="shrink-0">
          <img src="/logo-light.png" alt="Klyde" className="h-12 w-auto object-contain" />
        </button>
        <div className="hidden min-w-0 flex-1 items-center justify-center px-8 md:flex">
          <div className="flex w-full max-w-xl items-center gap-3 border-b border-[#1f1b18] pb-2">
            <Search className="h-5 w-5 text-[#1f1b18]/60" />
            <span className="text-sm uppercase tracking-[0.34em] text-[#1f1b18]/45">
              Recherche dans la sélection
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goTo("")}
            className="hidden rounded-full border border-[#1f1b18]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#1f1b18] sm:inline-flex"
          >
            CRM
          </button>
          <button
            type="button"
            onClick={() => goTo("/boutique/panier")}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#1f1b18]/15 text-[#1f1b18]"
            aria-label="Voir le panier"
          >
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>
      <nav className="border-t border-[#1f1b18]/10 bg-[#010102] px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-white/78">
        <span className="mx-3">Nouveautés</span>
        <span className="mx-3">Vestiaire</span>
        <span className="mx-3">Pièces fortes</span>
        <span className="mx-3">Sélection Klyde</span>
      </nav>
    </header>
  );
}

function BoutiqueShell({ route }: { route: ShopRoute }) {
  const cart = useKlydeCart();
  return (
    <div className="min-h-screen bg-[#f6eee5] text-[#1f1b18]">
      <BoutiqueHeader cartCount={cart.count} />
      {route === "/boutique/panier" ? <CartPage cart={cart} /> : <BoutiqueCatalog cart={cart} />}
    </div>
  );
}

function BoutiqueCatalog({ cart }: { cart: ReturnType<typeof useKlydeCart> }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [gender, setGender] = useState("");
  const [size, setSize] = useState("");
  const items = useQuery(api.klyde.listPublic, {
    searchText: search || undefined,
    category: category || undefined,
    gender: gender || undefined,
    size: size || undefined,
  });

  const heroItem = items?.[0];

  return (
    <main>
      <section className="grid min-h-[560px] border-b border-[#1f1b18]/10 lg:grid-cols-2">
        <div className="flex items-center px-5 py-14 sm:px-8 lg:px-14">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--primary)]">
              Collection privée
            </p>
            <h1 className="mt-6 font-serif text-5xl leading-[0.98] tracking-wide text-[#1f1b18] sm:text-7xl">
              Vestiaire Klyde
            </h1>
            <p className="mt-6 max-w-md text-base leading-8 text-[#1f1b18]/68">
              Une sélection textile haut de gamme, préparée pièce par pièce, disponible uniquement
              parmi les articles déjà mis en ligne.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a
                href="#catalogue"
                className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--primary)] px-7 text-sm font-semibold uppercase tracking-[0.16em] text-white"
              >
                Découvrir
              </a>
              <button
                type="button"
                onClick={() => goTo("/boutique/panier")}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#1f1b18]/18 px-6 text-sm font-semibold uppercase tracking-[0.16em]"
              >
                Panier
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="relative min-h-[420px] overflow-hidden bg-[#010102]">
          {heroItem?.photoUrls[0] ? (
            <img
              src={heroItem.photoUrls[0]}
              alt={heroItem.title}
              className="h-full w-full object-cover opacity-90"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/30">
              <ShoppingBag className="h-24 w-24" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6 text-white sm:p-10">
            <p className="text-xs uppercase tracking-[0.3em] text-white/70">Mise en avant</p>
            <h2 className="mt-2 max-w-md text-3xl font-semibold">
              {heroItem?.title ?? "La prochaine pièce Klyde arrive bientôt"}
            </h2>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 border-b border-[#1f1b18]/10 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#1f1b18]/70">
        <div className="px-3 py-4">Pièces contrôlées</div>
        <div className="border-x border-[#1f1b18]/10 px-3 py-4">Stock en ligne uniquement</div>
        <div className="px-3 py-4">Panier sans compte</div>
      </section>

      <section id="catalogue" className="mx-auto max-w-[96rem] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
              Boutique
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Sélection disponible
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 rounded-none border border-[#1f1b18]/15 bg-[#f6eee5] px-3 text-sm outline-none focus:border-[var(--primary)]"
              placeholder="Recherche"
            />
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 border border-[#1f1b18]/15 bg-[#f6eee5] px-3 text-sm">
              <option value="">Catégorie</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={gender} onChange={(event) => setGender(event.target.value)} className="h-11 border border-[#1f1b18]/15 bg-[#f6eee5] px-3 text-sm">
              <option value="">Genre</option>
              {genders.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={size} onChange={(event) => setSize(event.target.value)} className="h-11 border border-[#1f1b18]/15 bg-[#f6eee5] px-3 text-sm">
              <option value="">Taille</option>
              {sizes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </div>

        {items === undefined ? (
          <div className="flex items-center gap-2 py-16 text-sm text-[#1f1b18]/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement de la boutique
          </div>
        ) : items.length === 0 ? (
          <div className="border border-[#1f1b18]/10 px-6 py-16 text-center">
            <p className="text-sm uppercase tracking-[0.22em] text-[#1f1b18]/50">
              Aucun article en ligne pour le moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => <ShopProductCard key={item._id} item={item} cart={cart} />)}
          </div>
        )}
      </section>
    </main>
  );
}

function ShopProductCard({ item, cart }: { item: ShopItem; cart: ReturnType<typeof useKlydeCart> }) {
  const inCart = cart.has(item._id);
  return (
    <article className="group">
      <div className="relative aspect-[3/4] overflow-hidden bg-white">
        {item.photoUrls[0] ? (
          <img
            src={item.photoUrls[0]}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#1f1b18]/25">
            <Package className="h-12 w-12" />
          </div>
        )}
        <div className="absolute left-3 top-3 bg-[#f6eee5]/92 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
          {item.category}
        </div>
      </div>
      <div className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="line-clamp-2 text-sm font-semibold uppercase tracking-[0.08em]">
              {item.title}
            </h3>
            <p className="mt-1 text-xs text-[#1f1b18]/55">
              {[item.brand, item.size, item.condition].filter(Boolean).join(" · ")}
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold">{formatPrice(item.price)}</p>
        </div>
        <button
          type="button"
          onClick={() => (inCart ? goTo("/boutique/panier") : cart.add(item._id))}
          className={cn(
            "mt-4 inline-flex h-10 w-full items-center justify-center gap-2 border px-4 text-xs font-semibold uppercase tracking-[0.16em] transition",
            inCart
              ? "border-[#010102] bg-[#010102] text-white"
              : "border-[#1f1b18]/18 hover:border-[var(--primary)] hover:text-[var(--primary)]",
          )}
        >
          {inCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          {inCart ? "Voir le panier" : "Ajouter au panier"}
        </button>
      </div>
    </article>
  );
}

function CartPage({ cart }: { cart: ReturnType<typeof useKlydeCart> }) {
  const { isSignedIn, user } = useUser();
  const clerk = useClerk();
  const submitOrder = useMutation(api.klyde.submitCartOrder);
  const articles = useQuery(api.klyde.getManyPublic, {
    ids: cart.ids as Id<"klydeItems">[],
  });
  const [customer, setCustomer] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setCustomer((current) => ({
      ...current,
      firstName: current.firstName || user.firstName || "",
      lastName: current.lastName || user.lastName || "",
      email: current.email || user.primaryEmailAddress?.emailAddress || "",
    }));
  }, [user]);

  const availableArticles = (articles ?? []).filter((item) => item.status === "en_ligne");
  const unavailableArticles = (articles ?? []).filter((item) => item.status !== "en_ligne");
  const total = availableArticles.reduce((sum, item) => sum + (item.price ?? 0), 0);

  async function validateCart(event: FormEvent) {
    event.preventDefault();
    if (!isSignedIn) {
      clerk.openSignIn({});
      return;
    }
    if (availableArticles.length === 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await submitOrder({
        itemIds: availableArticles.map((item) => item._id),
        customer,
        note: note || undefined,
      });
      cart.clear();
      setMessage(`Commande enregistrée. Paiement carte en attente (${formatPrice(result.total)}).`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Validation impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  if (cart.count === 0 && !message) {
    return (
      <main className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4 py-16 text-center">
        <div>
          <ShoppingBag className="mx-auto h-12 w-12 text-[var(--primary)]" />
          <h1 className="mt-6 text-3xl font-semibold">Votre panier est vide</h1>
          <p className="mt-3 text-sm leading-6 text-[#1f1b18]/60">
            Ajoutez une pièce depuis la boutique pour préparer votre commande.
          </p>
          <button
            type="button"
            onClick={() => goTo("/boutique")}
            className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 text-sm font-semibold text-white"
          >
            Découvrir la boutique
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[96rem] px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => goTo("/boutique")}
        className="mb-8 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#1f1b18]/70"
      >
        <ArrowLeft className="h-4 w-4" />
        Continuer mes achats
      </button>

      <div className="grid gap-10 lg:grid-cols-[1fr_430px] lg:items-start">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
            Votre sélection
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Panier</h1>

          {articles === undefined ? (
            <div className="mt-10 flex items-center gap-2 text-sm text-[#1f1b18]/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement du panier
            </div>
          ) : (
            <div className="mt-8 grid gap-4">
              {availableArticles.map((item) => (
                <article key={item._id} className="grid grid-cols-[96px_1fr_auto] gap-4 border-b border-[#1f1b18]/10 pb-4">
                  <img src={item.photoUrls[0] ?? ""} alt="" className="h-24 w-24 bg-white object-cover" />
                  <div className="min-w-0">
                    <h2 className="font-semibold">{item.title}</h2>
                    <p className="mt-1 text-sm text-[#1f1b18]/55">
                      {[item.brand, item.size, item.condition].filter(Boolean).join(" · ")}
                    </p>
                    <button
                      type="button"
                      onClick={() => cart.remove(item._id)}
                      className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]"
                    >
                      Retirer
                    </button>
                  </div>
                  <div className="text-right text-sm font-semibold">{formatPrice(item.price)}</div>
                </article>
              ))}
              {unavailableArticles.map((item) => (
                <article key={item._id} className="flex items-center justify-between border-b border-[#1f1b18]/10 py-3 text-sm text-[#1f1b18]/45">
                  <span>{item.title} n’est plus disponible.</span>
                  <button type="button" onClick={() => cart.remove(item._id)} className="font-semibold">
                    Retirer
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <form onSubmit={validateCart} className="border border-[#1f1b18]/12 bg-[#010102] p-5 text-white sm:p-7">
          <div className="flex items-center justify-between border-b border-white/14 pb-5">
            <h2 className="text-xl font-semibold">Validation</h2>
            <span className="text-xl font-semibold">{formatPrice(total)}</span>
          </div>

          <div className="mt-6 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input required value={customer.firstName} onChange={(event) => setCustomer((current) => ({ ...current, firstName: event.target.value }))} className="h-11 border border-white/14 bg-white/5 px-3 text-sm outline-none focus:border-[var(--primary)]" placeholder="Prénom" />
              <input required value={customer.lastName} onChange={(event) => setCustomer((current) => ({ ...current, lastName: event.target.value }))} className="h-11 border border-white/14 bg-white/5 px-3 text-sm outline-none focus:border-[var(--primary)]" placeholder="Nom" />
            </div>
            <input required type="email" value={customer.email} onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))} className="h-11 border border-white/14 bg-white/5 px-3 text-sm outline-none focus:border-[var(--primary)]" placeholder="Email" />
            <input required value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} className="h-11 border border-white/14 bg-white/5 px-3 text-sm outline-none focus:border-[var(--primary)]" placeholder="Téléphone" />
            <textarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-24 border border-white/14 bg-white/5 px-3 py-3 text-sm outline-none focus:border-[var(--primary)]" placeholder="Note optionnelle" />
          </div>

          <button
            type="submit"
            disabled={submitting || availableArticles.length === 0}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-50"
          >
            {isSignedIn ? <Check className="h-4 w-4" /> : <User className="h-4 w-4" />}
            {submitting ? "Validation..." : isSignedIn ? "Valider le panier" : "Se connecter pour valider"}
          </button>

          <button
            type="button"
            disabled
            className="mt-3 h-12 w-full rounded-full border border-white/18 px-5 text-sm font-semibold uppercase tracking-[0.16em] text-white/35"
          >
            Paiement par carte
          </button>
          <p className="mt-3 text-xs leading-5 text-white/45">
            Le paiement par carte sera activé après branchement Stripe.
          </p>
          {message ? (
            <div className="mt-5 border border-white/14 bg-white/5 px-3 py-3 text-sm text-white/80">
              {message}
            </div>
          ) : null}
        </form>
      </div>
    </main>
  );
}

export default function App() {
  const [route, setRoute] = useState(() => currentRoute());

  useEffect(() => {
    function syncRoute() {
      setRoute(currentRoute());
    }
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  if (route) return <BoutiqueShell route={route} />;

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
