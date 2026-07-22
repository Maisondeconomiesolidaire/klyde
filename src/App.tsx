import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { SignedIn, SignedOut, useClerk, useUser } from "@clerk/clerk-react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  ImagePlus,
  LayoutGrid,
  List,
  Kanban,
  Loader2,
  Menu,
  Moon,
  Package,
  Scissors,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Trophy,
  User,
  X,
  Camera,
  LogOut,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { cn } from "./lib/cn";
import { UpdateAvailableBanner } from "./components/UpdateAvailableBanner";
import { AppSwitcher } from "./components/AppSwitcher";
import { HelpButton } from "./components/HelpButton";
import { useKlydeCart } from "./lib/useKlydeCart";
import { useUpload } from "./lib/useUpload";

type KlydeStatus = "stock" | "stock_b" | "en_ligne" | "en_cours_envoi" | "envoye" | "gagne" | "archive";
type AppTab = "stock" | "stock_b" | "prolonges" | "suivi";

type TrackingTab = "process" | "gagne";
type DetailMode = "article" | "demande";
type ShopRoute = string;

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
  actualSalePrice: string;
  parcelSize: string;
  gender: string;
  style: string;
  location: string;
  sku: string;
  vinted: boolean;
  outlet: "klyd" | "mobifrip";
  quantity: string;
  aiConfidence?: number;
  aiNotes: string;
};

/** Enseignes disponibles pour un article Klyd. */
const OUTLETS = [
  { value: "klyd", label: "Klyd" },
  { value: "mobifrip", label: "Mobifrip" },
] as const;

type ListedItem = Doc<"klydeItems"> & { photoUrls: string[] };
type ShopItem = ListedItem;

/** Crée/rafraîchit le profil Convex à la connexion et rattache les données. */
function ProfileSync({ app }: { app: string }) {
  const syncProfile = useMutation(api.users.syncProfile);
  useEffect(() => {
    void syncProfile({
      source: { app, path: window.location.pathname + window.location.search + window.location.hash },
    });
  }, [app, syncProfile]);
  return null;
}

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
  actualSalePrice: "",
  parcelSize: "Moyen",
  gender: "",
  style: "",
  location: "",
  sku: "",
  vinted: false,
  outlet: "klyd",
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
    "Blousons et bombers",
    "Doudounes et parkas",
    "Trenchs et imperméables",
    "Pulls et gilets",
    "Sweats",
    "Chemises et blouses",
    "T-shirts et tops",
    "Tops et débardeurs",
    "Robes",
    "Combinaisons",
    "Jupes",
    "Pantalons",
    "Jeans",
    "Chinos et toiles",
    "Shorts",
    "Tailleurs et costumes",
    "Ensembles",
    "Joggings et survêtements",
    "Leggings",
    "Sport",
    "Maillots de bain",
    "Sous-vêtements",
    "Lingerie",
    "Pyjamas",
  ],
  Chaussures: [
    "Baskets",
    "Bottes et bottines",
    "Sandales",
    "Tongs et claquettes",
    "Escarpins",
    "Ballerines",
    "Mocassins",
    "Espadrilles",
    "Chaussures de ville",
    "Chaussures de sport",
    "Chaussons",
  ],
  Accessoires: [
    "Sacs",
    "Sacs à dos",
    "Portefeuilles et maroquinerie",
    "Ceintures",
    "Chapeaux et bonnets",
    "Écharpes et foulards",
    "Gants",
    "Bijoux",
    "Montres",
    "Lunettes",
    "Cravates et nœuds papillon",
    "Accessoires cheveux",
  ],
} as const;

const categories = Object.keys(categoryTree) as Array<keyof typeof categoryTree>;
const genders = ["Femme", "Homme", "Unisexe"];
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

const shopMenus = [
  {
    label: "Femme",
    category: "Vêtements",
    gender: "Femme",
    groups: [
      ["Vêtements", ["Manteaux et vestes", "Pulls et gilets", "Chemises et blouses", "T-shirts et tops", "Robes", "Jupes", "Pantalons", "Jeans"]],
      ["Tendances", ["Combinaisons", "Tailleurs et costumes", "Ensembles", "Leggings", "Sport", "Maillots de bain"]],
      ["Lingerie & nuit", ["Lingerie", "Sous-vêtements", "Pyjamas"]],
    ],
  },
  {
    label: "Homme",
    category: "Vêtements",
    gender: "Homme",
    groups: [
      ["Vêtements", ["Manteaux et vestes", "Blousons et bombers", "Pulls et gilets", "Chemises et blouses", "T-shirts et tops", "Pantalons", "Jeans", "Chinos et toiles", "Shorts"]],
      ["Style", ["Sweats", "Tailleurs et costumes", "Joggings et survêtements", "Sport", "Sous-vêtements"]],
    ],
  },
  {
    label: "Chaussures",
    category: "Chaussures",
    groups: [
      ["Femme", ["Baskets", "Escarpins", "Ballerines", "Bottes et bottines", "Sandales", "Espadrilles"]],
      ["Homme", ["Chaussures de ville", "Mocassins", "Chaussures de sport", "Tongs et claquettes"]],
      ["Toutes", ["Chaussons"]],
    ],
  },
  {
    label: "Accessoires",
    category: "Accessoires",
    groups: [
      ["Sacs & maroquinerie", ["Sacs", "Sacs à dos", "Portefeuilles et maroquinerie", "Ceintures"]],
      ["Accessoires", ["Chapeaux et bonnets", "Écharpes et foulards", "Gants", "Cravates et nœuds papillon"]],
      ["Bijoux & montres", ["Bijoux", "Montres", "Lunettes", "Accessoires cheveux"]],
    ],
  },
] as const;

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
  if (hash === "/profil") return "/profil";
  if (hash === "/boutique/panier") return "/boutique/panier" satisfies ShopRoute;
  if (hash === "/boutique/favoris") return "/boutique/favoris" satisfies ShopRoute;
  if (hash.startsWith("/boutique/recherche")) return hash;
  if (hash.startsWith("/boutique/categorie/")) return hash;
  if (hash.startsWith("/boutique/article/")) return hash;
  if (hash === "/boutique") return "/boutique" satisfies ShopRoute;
  return "";
}

function goTo(path: ShopRoute | "") {
  window.location.hash = path;
}

function shopCategoryPath(category: string, subcategory?: string, gender?: string) {
  const params = new URLSearchParams();
  if (subcategory) params.set("sous-categorie", subcategory);
  if (gender) params.set("genre", gender);
  const query = params.toString();
  return `/boutique/categorie/${encodeURIComponent(category)}${query ? `?${query}` : ""}`;
}

function parseShopCategory(route: ShopRoute) {
  const raw = route.replace("/boutique/categorie/", "");
  const [categoryPart, queryString = ""] = raw.split("?");
  const params = new URLSearchParams(queryString);
  return {
    category: decodeURIComponent(categoryPart || ""),
    subcategory: params.get("sous-categorie") ?? "",
    gender: params.get("genre") ?? "",
  };
}

function parseShopArticleId(route: ShopRoute) {
  return decodeURIComponent(route.replace("/boutique/article/", ""));
}

function parseSearchQuery(route: ShopRoute) {
  const [, queryString = ""] = route.split("?");
  return new URLSearchParams(queryString).get("q") ?? "";
}

const normalizeKey = (value: string) => value.normalize("NFC").trim().toLowerCase();

/** Retrouve la clé canonique d'une catégorie, tolérante aux accents/casse (NFC/NFD). */
function findCategoryKey(value: string): keyof typeof categoryTree | null {
  const target = normalizeKey(value);
  return (
    (categories.find((key) => normalizeKey(key) === target) as keyof typeof categoryTree) ?? null
  );
}

/** Champs de fiche pertinents selon la catégorie / sous-catégorie. */
const NO_SIZE_SUBCATEGORIES = new Set([
  "Sacs",
  "Sacs à dos",
  "Portefeuilles et maroquinerie",
  "Bijoux",
  "Montres",
  "Lunettes",
  "Écharpes et foulards",
  "Cravates et nœuds papillon",
  "Accessoires cheveux",
]);
const NO_MATERIAL_SUBCATEGORIES = new Set(["Montres", "Lunettes", "Bijoux"]);

function fieldRelevant(field: "size" | "material", category: string, subcategory: string) {
  if (field === "size") {
    if (category === "Accessoires") {
      // Seuls quelques accessoires ont une taille (ceinture, gants, bonnet...).
      return ["Ceintures", "Gants", "Chapeaux et bonnets"].includes(subcategory);
    }
    return !NO_SIZE_SUBCATEGORIES.has(subcategory);
  }
  if (field === "material") return !NO_MATERIAL_SUBCATEGORIES.has(subcategory);
  return true;
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
      stock_b: "Stock B",
      en_ligne: "En ligne",
      en_cours_envoi: "En cours d’envoi",
      envoye: "Envoyé",
      gagne: "Gagné",
      vendu: "Gagné",
      archive: "Archivé",
    }[normalized] ?? "Stock"
  );
}

/** Classe de la pastille de statut (repris du style boutique recyclerie). */
function statusPillClass(status: string) {
  const normalized = status === "en_stock" || status === "reserve" ? "stock" : status;
  return (
    {
      stock: "bg-[var(--primary)] text-white",
      stock_b: "bg-orange-600 text-white",
      en_ligne: "bg-sky-500 text-white",
      en_cours_envoi: "bg-amber-500 text-white",
      envoye: "bg-violet-500 text-white",
      gagne: "bg-emerald-600 text-white",
      vendu: "bg-emerald-600 text-white",
      archive: "bg-[var(--muted)] text-[var(--muted-foreground)]",
    }[normalized] ?? "bg-[var(--muted)] text-[var(--muted-foreground)]"
  );
}

/** Pastille de statut ronde, style « boutique ». */
function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        statusPillClass(status),
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

/** Pastille « Vinted » : l'article est mis en vente sur Vinted. */
function VintedBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
      Vinted
    </span>
  );
}

/** Pastille d'enseigne : Klyd ou Mobifrip. */
function OutletBadge({ outlet }: { outlet?: "klyd" | "mobifrip" | null }) {
  const value = outlet ?? "klyd";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        value === "mobifrip"
          ? "bg-indigo-500/15 text-indigo-600"
          : "bg-[var(--primary)]/12 text-[var(--primary)]",
      )}
    >
      {value === "mobifrip" ? "Mobifrip" : "Klyd"}
    </span>
  );
}

/**
 * Marqueur Vinted pour la liste : logo Vinted sur fond vert si l'article est en
 * vente sur Vinted, sur fond gris sinon.
 */
function VintedFlag({ on }: { on: boolean }) {
  return (
    <span
      title={on ? "En vente sur Vinted" : "Pas encore sur Vinted"}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-2 py-1",
        on ? "bg-emerald-500" : "bg-zinc-400/80",
      )}
    >
      <img src="/vinted.svg" alt="Vinted" className="h-3 w-auto" />
    </span>
  );
}

/** Chips multi-sélection (repris du filtre catégories de la boutique recyclerie). */
function MultiSelectChips({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const chipClass = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "border-[var(--primary)] bg-[var(--primary)]/12 text-[var(--primary)]"
        : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)]",
    );
  const toggle = (option: string) =>
    onChange(
      selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option],
    );
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => onChange([])} className={chipClass(selected.length === 0)}>
        Toutes
      </button>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => toggle(option)}
          className={chipClass(selected.includes(option))}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function revokeLocalPreview(url: string) {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
}

type CropRect = { x: number; y: number; w: number; h: number };
type CropHandle = "move" | "nw" | "ne" | "sw" | "se";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function PhotoEditor({
  url,
  upload,
  onReplace,
  onClose,
}: {
  url: string;
  upload: (file: File) => Promise<Id<"_storage">>;
  onReplace: (newId: Id<"_storage">, newUrl: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"view" | "crop">("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropRect>({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ type: CropHandle; startX: number; startY: number; start: CropRect } | null>(
    null,
  );
  const replaceInputRef = useRef<HTMLInputElement>(null);

  function startDrag(type: CropHandle, event: React.PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { type, startX: event.clientX, startY: event.clientY, start: crop };
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent) {
    const drag = dragRef.current;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    const dx = (event.clientX - drag.startX) / rect.width;
    const dy = (event.clientY - drag.startY) / rect.height;
    const minSize = 0.08;
    let { x, y, w, h } = drag.start;
    if (drag.type === "move") {
      x = clamp01(Math.min(Math.max(x + dx, 0), 1 - w));
      y = clamp01(Math.min(Math.max(y + dy, 0), 1 - h));
    } else {
      let x2 = x + w;
      let y2 = y + h;
      if (drag.type.includes("n")) y = clamp01(Math.min(y + dy, y2 - minSize));
      if (drag.type.includes("s")) y2 = clamp01(Math.max(y2 + dy, y + minSize));
      if (drag.type.includes("w")) x = clamp01(Math.min(x + dx, x2 - minSize));
      if (drag.type.includes("e")) x2 = clamp01(Math.max(x2 + dx, x + minSize));
      w = x2 - x;
      h = y2 - y;
    }
    setCrop({ x, y, w, h });
  }

  function endDrag() {
    dragRef.current = null;
  }

  async function applyCrop() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Image introuvable.");
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      const sx = Math.round(crop.x * bitmap.width);
      const sy = Math.round(crop.y * bitmap.height);
      const sw = Math.max(1, Math.round(crop.w * bitmap.width));
      const sh = Math.max(1, Math.round(crop.h * bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponible.");
      context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
      bitmap.close?.();
      const output = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.9),
      );
      if (!output) throw new Error("Export impossible.");
      const file = new File([output], `klyde-rogne-${Date.now()}.webp`, { type: "image/webp" });
      const id = await upload(file);
      onReplace(id, URL.createObjectURL(output));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rognage impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReplaceFile(files: FileList | null) {
    const file = Array.from(files ?? []).find((item) => item.type.startsWith("image/"));
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const id = await upload(file);
      onReplace(id, URL.createObjectURL(file));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remplacement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/80 p-4 sm:p-8">
      <div className="flex items-center justify-between text-white">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em]">
          {mode === "crop" ? "Rogner l’image" : "Modifier l’image"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-white/30 p-2 text-white"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-4">
        <div ref={wrapperRef} className="relative inline-block select-none">
          <img
            src={url}
            alt=""
            draggable={false}
            className="max-h-[68vh] max-w-full object-contain"
          />
          {mode === "crop" ? (
            <div
              className="absolute inset-0 touch-none"
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
            >
              <div className="absolute inset-0 bg-black/45" />
              <div
                className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                }}
                onPointerDown={(event) => startDrag("move", event)}
              >
                {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                  <span
                    key={corner}
                    onPointerDown={(event) => startDrag(corner, event)}
                    className={cn(
                      "absolute h-4 w-4 rounded-full border-2 border-[#1f1b18] bg-white",
                      corner === "nw" && "-left-2 -top-2 cursor-nwse-resize",
                      corner === "ne" && "-right-2 -top-2 cursor-nesw-resize",
                      corner === "sw" && "-bottom-2 -left-2 cursor-nesw-resize",
                      corner === "se" && "-bottom-2 -right-2 cursor-nwse-resize",
                    )}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mx-auto mb-3 max-w-md rounded-md bg-red-500/90 px-3 py-2 text-center text-sm text-white">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => void handleReplaceFile(event.target.files)}
        />
        {mode === "view" ? (
          <>
            <button
              type="button"
              onClick={() => setMode("crop")}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-[#1f1b18] disabled:opacity-50"
            >
              <Scissors className="h-4 w-4" />
              Rogner
            </button>
            <button
              type="button"
              onClick={() => replaceInputRef.current?.click()}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/40 px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              Remplacer
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void applyCrop()}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Appliquer le rognage
            </button>
            <button
              type="button"
              onClick={() => setMode("view")}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center rounded-md border border-white/40 px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Annuler
            </button>
          </>
        )}
      </div>
    </div>
  );
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

function Logo({ theme = "light" }: { theme?: "light" | "dark" }) {
  return (
    <img
      src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
      alt="Klyd"
      className="h-12 w-auto object-contain"
    />
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

const VINTED_EXTENSION_AFTER_MS = 21 * 24 * 60 * 60 * 1000;
function vintedNeedsDecision(item: ListedItem) {
  return Boolean(item.vinted && item.vintedAt && Date.now() - item.vintedAt >= VINTED_EXTENSION_AFTER_MS);
}

function workflowIndex(status: string) {
  return ({ stock: 0, en_ligne: 1, en_cours_envoi: 2, envoye: 3, gagne: 4 }[status] ?? -1);
}

function vintedDaysOnline(vintedAt?: number) {
  if (!vintedAt) return null;
  return Math.max(0, Math.floor((Date.now() - vintedAt) / (24 * 60 * 60 * 1000)));
}

/** Thème clair/sombre persistant (comme les autres apps de l'écosystème). */
function useKlydeTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("klyd-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggle = () =>
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem("klyd-theme", next);
      return next;
    });
  return { theme, toggle };
}

function AppContent({
  theme,
  toggleTheme,
}: {
  theme: "light" | "dark";
  toggleTheme: () => void;
}) {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<AppTab>("stock");
  const [trackingTab, setTrackingTab] = useState<TrackingTab>("process");
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<Id<"klydeItems"> | null>(null);
  const [detailItemId, setDetailItemId] = useState<Id<"klydeItems"> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ListedItem | null>(null);
  const [trackingNoteDraft, setTrackingNoteDraft] = useState("");
  const [shipmentNote, setShipmentNote] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [articleSheetOpen, setArticleSheetOpen] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [justSaved, setJustSaved] = useState(false);
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"" | KlydeStatus>("");
  const [selectedGender, setSelectedGender] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [selectedOutlet, setSelectedOutlet] = useState<"" | "klyd" | "mobifrip">("");
  const [selectedVinted, setSelectedVinted] = useState<"" | "yes" | "no">("");
  const [stockView, setStockView] = useState<"list" | "grid">("list");
  // Volet « Nouvel article » : publier directement sur la boutique.
  const [publishOnCreate, setPublishOnCreate] = useState(false);
  const [draggedId, setDraggedId] = useState<Id<"klydeItems"> | null>(null);
  const [dropTarget, setDropTarget] = useState<KlydeStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useUpload();
  const analyzePhotos = useAction(api.klyde.analyzePhotos);
  const createItem = useMutation(api.klyde.create);
  const updateItem = useMutation(api.klyde.update);
  const updateStatus = useMutation(api.klyde.updateStatus);
  const advanceWorkflow = useMutation(api.klyde.advanceWorkflow);
  const updateTrackingNotes = useMutation(api.klyde.updateTrackingNotes);
  const moveToStockB = useMutation(api.klyde.moveToStockB);
  const extendVintedListing = useMutation(api.klyde.extendVintedListing);
  const setStockBDisposition = useMutation(api.klyde.setStockBDisposition);
  const removeItem = useMutation(api.klyde.remove);
  const setFeatured = useMutation(api.klyde.setFeatured);
  const access = useQuery(api.permissions.myAccess);
  const points = useQuery(api.points.myPoints, {}) ?? 100;
  const ensurePoints = useMutation(api.points.ensureMine);
  const can = (pageKey: string, action: string) => {
    if (!access) return false;
    if (access.isAdmin || access.bootstrapMode) return true;
    return Boolean(
      access.grants.find((grant) => grant.pageKey === pageKey)?.actions.includes(action),
    );
  };
  const canRead = can("klyde:stock", "read");
  const canCreate = can("klyde:stock", "create");
  const canUpdate = can("klyde:stock", "update");
  const canDelete = can("klyde:stock", "delete");
  const canAnalyze = can("klyde:stock", "analyze");
  const canPublish = canUpdate || can("klyde:boutique", "manage");

  useEffect(() => { void ensurePoints({}); }, [ensurePoints]);

  const items = useQuery(
    api.klyde.list,
    canRead ? { searchText: searchText || undefined } : "skip",
  );

  const allItems = items ?? [];
  const visibleItems = useMemo(
    () =>
      allItems.filter((item) => {
        if (selectedCategories.length > 0 && !selectedCategories.includes(item.category)) {
          return false;
        }
        if (selectedLocation && (item.location ?? "") !== selectedLocation) return false;
        if (selectedStatus && item.status !== selectedStatus) return false;
        if (selectedGender && (item.gender ?? "") !== selectedGender) return false;
        if (selectedSize && (item.size ?? "") !== selectedSize) return false;
        if (selectedCondition && item.condition !== selectedCondition) return false;
        if (selectedOutlet && (item.outlet ?? "klyd") !== selectedOutlet) return false;
        if (selectedVinted === "yes" && !item.vinted) return false;
        if (selectedVinted === "no" && item.vinted) return false;
        return true;
      }),
    [
      allItems,
      selectedCategories,
      selectedLocation,
      selectedStatus,
      selectedGender,
      selectedSize,
      selectedCondition,
      selectedOutlet,
      selectedVinted,
    ],
  );
  const tabItems = useMemo(() => {
    if (activeTab === "stock") return visibleItems.filter((item) => itemStatus(item) !== "stock_b" && !item.vintedExtensionCount);
    if (activeTab === "stock_b") return visibleItems.filter((item) => itemStatus(item) === "stock_b");
    if (activeTab === "prolonges") return visibleItems.filter((item) => (item.vintedExtensionCount ?? 0) > 0 && itemStatus(item) !== "stock_b");
    return visibleItems;
  }, [activeTab, visibleItems]);
  const locationOptions = useMemo(
    () =>
      Array.from(new Set(allItems.map((item) => item.location ?? "").filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "fr", { numeric: true }),
      ),
    [allItems],
  );
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
  // Article en cours d'édition dans la fiche : lu sur `allItems` (pas
  // `visibleItems`) pour que la fiche ne se ferme pas si un filtre l'exclut.
  const sheetItem = useMemo(
    () => allItems.find((item) => item._id === editingId) ?? null,
    [allItems, editingId],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (justSaved) setJustSaved(false);
  }

  function openNewArticle() {
    setEditingId(null);
    setForm(initialForm);
    setShipmentNote("");
    setPublishOnCreate(false);
    setError(null);
    setDrawerOpen(true);
  }

  function fillFormFromItem(item: ListedItem) {
    setForm({
      photos: item.photos,
      previewUrls: item.photoUrls,
      title: item.title,
      description: item.description,
      category: findCategoryKey(item.category) ?? item.category,
      subcategory: item.subcategory ?? "",
      brand: item.brand ?? "",
      size: item.size ?? "",
      condition: item.condition,
      color: item.color ?? "",
      material: item.material ?? "",
      price: item.price != null ? String(item.price) : "",
      actualSalePrice: item.actualSalePrice != null ? String(item.actualSalePrice) : "",
      parcelSize: item.parcelSize ?? "Moyen",
      gender: item.gender ?? "",
      style: item.style ?? "",
      location: item.location ?? "",
      sku: item.sku ?? "",
      vinted: item.vinted ?? false,
      outlet: item.outlet ?? "klyd",
      quantity: String(item.quantity),
      aiConfidence: item.aiConfidence,
      aiNotes: item.aiNotes ?? "",
    });
  }

  /** Ouvre la fiche article plein écran, champs directement modifiables. */
  function openArticleSheet(item: ListedItem) {
    setDetailItemId(null);
    setEditingId(item._id);
    fillFormFromItem(item);
    setActivePhotoIndex(0);
    setJustSaved(false);
    setShipmentNote(item.trackingNotes ?? "");
    setError(null);
    setArticleSheetOpen(true);
  }

  function closeArticleSheet() {
    form.previewUrls.forEach(revokeLocalPreview);
    setArticleSheetOpen(false);
    setEditingPhotoIndex(null);
    setEditingId(null);
    setForm(initialForm);
    setJustSaved(false);
    setError(null);
  }

  function closeDrawer() {
    form.previewUrls.forEach(revokeLocalPreview);
    setDrawerOpen(false);
    setEditingPhotoIndex(null);
    setEditingId(null);
    setForm(initialForm);
    setError(null);
  }

  function openDetail(item: ListedItem, mode: DetailMode) {
    if (mode === "article") {
      openArticleSheet(item);
      return;
    }
    setDetailItemId(item._id);
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

  /** Définit la photo `index` comme couverture (première photo de l'article). */
  function setCoverPhoto(index: number) {
    setForm((current) => {
      if (index <= 0 || index >= current.photos.length) return current;
      const photos = current.photos.slice();
      const previewUrls = current.previewUrls.slice();
      const [photo] = photos.splice(index, 1);
      const [url] = previewUrls.splice(index, 1);
      photos.unshift(photo);
      previewUrls.unshift(url);
      return { ...current, photos, previewUrls };
    });
    setActivePhotoIndex(0);
  }

  function replacePhotoAt(index: number, newId: Id<"_storage">, newUrl: string) {
    setForm((current) => {
      if (index < 0 || index >= current.photos.length) return current;
      revokeLocalPreview(current.previewUrls[index] ?? "");
      const photos = current.photos.slice();
      const previewUrls = current.previewUrls.slice();
      photos[index] = newId;
      previewUrls[index] = newUrl;
      return { ...current, photos, previewUrls };
    });
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
    if (articleSheetOpen && editingId === targetId) closeArticleSheet();
  }

  async function moveItem(id: Id<"klydeItems">, status: KlydeStatus) {
    await updateStatus({ id, status });
  }

  async function toggleFeatured(id: Id<"klydeItems">) {
    try {
      await setFeatured({ id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise en avant impossible.");
    }
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

  /** Télécharge une image (photo d'article ou essayage généré). */
  async function downloadImage(url: string, index: number) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
      link.download = `${form.sku || form.title || "klyd-article"}-${index + 1}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("Téléchargement de l'image impossible.");
    }
  }

  async function downloadPhotoPack() {
    if (form.previewUrls.length === 0) return;
    setError(null);
    setBusy("photo-pack");
    try {
      const { default: JSZip } = await import("jszip");
      const archive = new JSZip();
      await Promise.all(form.previewUrls.map(async (url, index) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Photo ${index + 1} inaccessible.`);
        const blob = await response.blob();
        const extension = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
        archive.file(`${String(index + 1).padStart(2, "0")}-${form.sku || "klyde-article"}.${extension}`, blob);
      }));
      const blob = await archive.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${form.sku || form.title || "klyde-article"}-photos.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Téléchargement du pack impossible.");
    } finally {
      setBusy(null);
    }
  }

  function buildItemPayload() {
    return {
      photos: form.photos,
      title: form.title,
      description: form.description,
      category: form.category,
      subcategory: form.subcategory || undefined,
      brand: form.brand || undefined,
      size: (showSizeField && form.size) || undefined,
      condition: form.condition,
      color: form.color || undefined,
      material: (showMaterialField && form.material) || undefined,
      price: asNumber(form.price),
      actualSalePrice: asNumber(form.actualSalePrice),
      parcelSize: form.parcelSize || undefined,
      gender: form.gender || undefined,
      style: form.style || undefined,
      location: form.location || undefined,
      sku: form.sku || undefined,
      vinted: Boolean(sheetItem && workflowIndex(sheetItem.status) >= workflowIndex("en_ligne")),
      outlet: form.outlet,
      quantity: asNumber(form.quantity),
      aiConfidence: form.aiConfidence,
      aiNotes: form.aiNotes || undefined,
    };
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
      const payload = buildItemPayload();
      if (editingId) {
        await updateItem({ id: editingId, ...payload });
      } else {
        await createItem({ ...payload, publishOnline: publishOnCreate || undefined });
      }
      closeDrawer();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(null);
    }
  }

  /** Enregistre la fiche article sans la fermer (édition en place). */
  async function saveArticleSheet() {
    if (!editingId) return;
    if (form.photos.length === 0) {
      setError("Ajoute au moins une photo.");
      return;
    }
    setError(null);
    setBusy("save");
    try {
      await updateItem({ id: editingId, ...buildItemPayload() });
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(null);
    }
  }

  /** Sauvegarde les champs de la fiche puis valide l'étape commerciale suivante. */
  async function advanceArticleWorkflow(status: Exclude<KlydeStatus, "stock" | "stock_b" | "archive">) {
    if (!editingId) return;
    setError(null);
    setBusy("workflow");
    try {
      await updateItem({ id: editingId, ...buildItemPayload() });
      if (status === "envoye") {
        await updateTrackingNotes({ id: editingId, trackingNotes: shipmentNote || undefined });
      }
      await advanceWorkflow({ id: editingId, status });
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de valider cette étape.");
    } finally {
      setBusy(null);
    }
  }

  /** Revenir à une étape précédente sans effacer les informations déjà saisies. */
  async function returnToWorkflowStep(status: KlydeStatus) {
    if (!editingId) return;
    setError(null);
    setBusy("workflow");
    try {
      await updateStatus({ id: editingId, status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de revenir à cette étape.");
    } finally {
      setBusy(null);
    }
  }

  const formCategoryKey = findCategoryKey(form.category);
  const formSubcategories = formCategoryKey ? categoryTree[formCategoryKey] : [];
  const showSizeField = fieldRelevant("size", form.category, form.subcategory);
  const showMaterialField = fieldRelevant("material", form.category, form.subcategory);

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
          canPublish ? (
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
          ) : null
        ) : canUpdate ? (
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
        ) : null
      ) : null}
      {activeTab === "stock_b" && canUpdate ? (
        <>
          <button type="button" onClick={(event) => { event.stopPropagation(); void setStockBDisposition({ id: item._id, disposition: "vente_exceptionnelle" }); }} className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--primary)] text-sm font-medium text-[var(--primary)]">
            Vente exceptionnelle
          </button>
          <button type="button" onClick={(event) => { event.stopPropagation(); void setStockBDisposition({ id: item._id, disposition: "magasin" }); }} className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--border)] text-sm font-medium">
            Mettre en magasin
          </button>
        </>
      ) : null}
      {canDelete ? (
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
      ) : null}
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
      className="cursor-pointer overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]"
    >
      <ArticleThumb item={item} />
      <div className="grid gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="line-clamp-2 text-sm font-semibold">{item.title}</h2>
          <span className="shrink-0 text-sm font-semibold">
            {item.price != null ? `${item.price.toFixed(2)} €` : "-"}
          </span>
        </div>
        <OutletBadge outlet={item.outlet} />
        <div className="text-xs text-[var(--muted-foreground)]">
          {[item.brand, item.size, item.condition].filter(Boolean).join(" · ")}
        </div>
        <div className="text-xs text-[var(--muted-foreground)]">
          {[item.gender, item.category, item.subcategory, item.color].filter(Boolean).join(" · ")}
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 text-xs text-[var(--muted-foreground)]">
          <span>Stock x{item.quantity}</span>
          <div className="flex items-center gap-1.5">
            <VintedFlag on={Boolean(item.vinted)} />
            <StatusPill status={item.status} />
          </div>
        </div>
        {actionButtons(item)}
        {vintedNeedsDecision(item) && canUpdate ? (
          <div className="grid grid-cols-2 gap-2 border-t border-amber-200 pt-2">
            <button type="button" onClick={(event) => { event.stopPropagation(); void moveToStockB({ id: item._id }); }} className="rounded-md border border-amber-300 px-2 py-1.5 text-xs font-semibold text-amber-800">Sortir du stock</button>
            <button type="button" onClick={(event) => { event.stopPropagation(); void extendVintedListing({ id: item._id }); }} className="rounded-md bg-amber-500 px-2 py-1.5 text-xs font-semibold text-white">Prolonger en ligne</button>
          </div>
        ) : null}
      </div>
    </article>
  );

  const articleRow = (item: ListedItem) => (
    <tr
      key={item._id}
      onClick={() => openDetail(item, "article")}
      className="cursor-pointer bg-[var(--background)] hover:bg-[var(--card)]"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--muted)]">
            {item.photoUrls[0] ? (
              <img src={item.photoUrls[0]} alt={item.title} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-4 w-4 text-[var(--muted-foreground)]" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="line-clamp-1 font-medium">{item.title}</p>
              <OutletBadge outlet={item.outlet} />
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              {[item.brand, item.size, item.condition].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-[var(--muted-foreground)]">{item.sku || "—"}</td>
      <td className="px-4 py-3 text-[var(--muted-foreground)]">
        {[item.category, item.subcategory].filter(Boolean).join(" · ") || "—"}
      </td>
      <td className="px-4 py-3 text-[var(--muted-foreground)]">{item.location || "—"}</td>
      <td className="px-4 py-3 font-semibold">
        {item.price != null ? `${item.price.toFixed(2)} €` : "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={item.status} />
          <VintedFlag on={Boolean(item.vinted)} />
        </div>
      </td>
    </tr>
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
        {canDelete ? (
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
        ) : null}
      </div>
    </article>
  );

  if (access === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--muted-foreground)]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6 text-[var(--foreground)]">
        <div className="w-full max-w-sm rounded-md border border-[var(--border)] bg-[var(--card)] p-6 text-center">
          <Logo theme={theme} />
          <h2 className="mt-4 text-lg font-semibold">Accès au CRM Klyd refusé</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Votre compte n’a pas les droits nécessaires pour accéder au stock Klyd. Contactez un
            administrateur pour obtenir un accès.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => goTo("/boutique")}
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              Voir la boutique
            </button>
            <button type="button" onClick={() => goTo("/profil")} className="rounded-full">
              <KlydeUserAvatar />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <HelpButton />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] md:flex">
        <div className="flex items-center justify-between gap-2 p-4">
          <Logo theme={theme} />
          <AppSwitcher current="klyde" />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-4">
          {navButton("stock", <Package className="h-4 w-4" />, "Stock")}
          {navButton("stock_b", <Package className="h-4 w-4" />, "Stock B")}
          {navButton("prolonges", <ArrowRight className="h-4 w-4" />, "Articles prolongés")}
          {navButton("suivi", <Kanban className="h-4 w-4" />, "Suivi")}
        </nav>
        <div className="space-y-3 border-t border-[var(--border)] p-4">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Mode clair" : "Mode sombre"}
          </button>
          <button
            type="button"
            onClick={() => goTo("/boutique")}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-3 text-sm font-semibold text-white"
          >
            <ShoppingBag className="h-4 w-4" />
            Voir la boutique
          </button>
          <button
            type="button"
            onClick={() => goTo("/profil")}
            className="flex w-full items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-left"
          >
            <KlydeUserAvatar />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{user?.firstName ?? user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Mon profil"}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)]/15 px-2 py-0.5 text-xs font-bold text-[var(--primary)]">{points} pts <span title="Les points récompensent vos réservations, retours et participations utiles.">?</span></span>
            </span>
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 md:pl-56">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--background)] px-3 py-3 md:px-6">
          <div className="shrink-0 md:hidden">
            <Logo theme={theme} />
          </div>
          <h1 className="hidden text-lg font-semibold md:block">
            {activeTab === "stock" ? "Stock" : activeTab === "stock_b" ? "Stock B" : activeTab === "prolonges" ? "Articles prolongés" : "Suivi"}
          </h1>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {canCreate ? (
              <button
                type="button"
                onClick={openNewArticle}
                className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white sm:px-4"
              >
                Nouvel article
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => goTo("/boutique")}
              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold md:hidden"
            >
              Boutique
            </button>
            <div className="md:hidden">
              <AppSwitcher current="klyde" />
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-md border border-[var(--border)] p-2 md:hidden"
              aria-label={theme === "dark" ? "Mode clair" : "Mode sombre"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => goTo("/profil")} className="rounded-full md:hidden">
              <KlydeUserAvatar />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-4 border-b border-[var(--border)] md:hidden">
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
          <button type="button" onClick={() => setActiveTab("stock_b")} className={cn("py-3 text-sm font-medium", activeTab === "stock_b" && "bg-[var(--muted)]")}>Stock B</button>
          <button type="button" onClick={() => setActiveTab("prolonges")} className={cn("py-3 text-sm font-medium", activeTab === "prolonges" && "bg-[var(--muted)]")}>Prolongés</button>
        </div>

        <main className="p-3 sm:p-4 md:p-6">
          {activeTab !== "suivi" ? (
            <div className="mb-6 space-y-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--input)] px-3.5">
                <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
                <input
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Rechercher par titre, référence…"
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--muted-foreground)]">
                  Filtrer par catégorie
                </p>
                <MultiSelectChips
                  options={categories}
                  selected={selectedCategories}
                  onChange={setSelectedCategories}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(() => {
                  const selectClass =
                    "h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 text-sm outline-none focus:border-[var(--primary)]";
                  const filterStatuses: KlydeStatus[] = [
                    "stock",
                    "stock_b",
                    "en_ligne",
                    "en_cours_envoi",
                    "envoye",
                    "gagne",
                    "archive",
                  ];
                  return (
                    <>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-medium text-[var(--muted-foreground)]">Emplacement</span>
                        <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className={selectClass}>
                          <option value="">Tous</option>
                          {locationOptions.map((location) => (
                            <option key={location} value={location}>{location}</option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-medium text-[var(--muted-foreground)]">Statut</span>
                        <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value as "" | KlydeStatus)} className={selectClass}>
                          <option value="">Tous</option>
                          {filterStatuses.map((status) => (
                            <option key={status} value={status}>{statusLabel(status)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-medium text-[var(--muted-foreground)]">Genre</span>
                        <select value={selectedGender} onChange={(e) => setSelectedGender(e.target.value)} className={selectClass}>
                          <option value="">Tous</option>
                          {genders.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-medium text-[var(--muted-foreground)]">Taille</span>
                        <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} className={selectClass}>
                          <option value="">Toutes</option>
                          {sizes.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-medium text-[var(--muted-foreground)]">État</span>
                        <select value={selectedCondition} onChange={(e) => setSelectedCondition(e.target.value)} className={selectClass}>
                          <option value="">Tous</option>
                          {conditions.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-medium text-[var(--muted-foreground)]">Vinted</span>
                        <select value={selectedVinted} onChange={(e) => setSelectedVinted(e.target.value as "" | "yes" | "no")} className={selectClass}>
                          <option value="">Tous</option>
                          <option value="yes">Sur Vinted</option>
                          <option value="no">Pas sur Vinted</option>
                        </select>
                      </label>
                    </>
                  );
                })()}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                <div className="flex gap-1">
                  {([
                    ["", "Tous"],
                    ["klyd", "Klyd"],
                    ["mobifrip", "Mobifrip"],
                  ] as const).map(([value, label]) => (
                    <button key={label} type="button" onClick={() => setSelectedOutlet(value)} className={cn("rounded-lg px-3 py-2 text-sm font-semibold transition-colors", selectedOutlet === value ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]")}>{label}</button>
                  ))}
                </div>
                <div className="inline-flex rounded-lg border border-[var(--border)] p-1">
                  <button type="button" onClick={() => setStockView("list")} className={cn("rounded-md p-2", stockView === "list" && "bg-[var(--muted)]")} aria-label="Vue liste" title="Vue liste"><List className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setStockView("grid")} className={cn("rounded-md p-2", stockView === "grid" && "bg-[var(--muted)]")} aria-label="Vue grille" title="Vue grille"><LayoutGrid className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex w-full items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--input)] px-3.5 sm:max-w-md">
                <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
                <input
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Rechercher un article"
                />
              </div>
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
            </div>
          )}

          {items === undefined ? (
            <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement du stock
            </div>
          ) : activeTab !== "suivi" ? (
            tabItems.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-sm text-[var(--muted-foreground)]">
                Aucun article.
              </div>
            ) : (
              stockView === "grid" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                  {tabItems.map((item) => articleCard(item))}
                </div>
              ) : <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
                <table className="min-w-[700px] w-full text-sm">
                  <thead className="bg-[var(--card)] text-[var(--muted-foreground)]">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Article</th>
                      <th className="px-4 py-3 text-left font-medium">Référence</th>
                      <th className="px-4 py-3 text-left font-medium">Catégorie</th>
                      <th className="px-4 py-3 text-left font-medium">Emplacement</th>
                      <th className="px-4 py-3 text-left font-medium">Prix</th>
                      <th className="px-4 py-3 text-left font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {tabItems.map((item) => articleRow(item))}
                  </tbody>
                </table>
              </div>
            )
          ) : trackingTab === "gagne" ? (
            wonItems.length === 0 ? (
              <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-8 text-sm text-[var(--muted-foreground)]">
                Aucun article gagné.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {wonItems.map((item) => (
                  <div key={item._id} className="grid gap-2">
                    {articleCard(item, false, "demande")}
                    {canUpdate ? (
                      <button
                        type="button"
                        onClick={() => void moveItem(item._id, "envoye")}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] text-sm font-semibold text-[var(--foreground)]"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Annuler « gagné »
                      </button>
                    ) : null}
                  </div>
                ))}
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
                <h2 className="font-semibold">Fiche demande</h2>
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
                    ["Vinted", detailItem.vinted ? "Oui" : "Non"],
                    ["Quantité", String(detailItem.quantity)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-[var(--border)] p-3">
                      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
                      <div className="mt-1 font-medium">{value}</div>
                    </div>
                  ))}
                </div>

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
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] px-4 py-3 sm:flex-row sm:justify-end">
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => requestDelete(detailItem)}
                  className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-red-600"
                >
                  Supprimer
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {articleSheetOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--background)]">
          {/* Barre supérieure : retour, statut, enregistrement en place. */}
          <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
            <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={closeArticleSheet}
                className="rounded-full border border-[var(--border)] p-2 transition hover:bg-[var(--muted)]"
                aria-label="Retour au stock"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{form.title || "Nouvel article"}</h1>
                  {sheetItem ? <StatusPill status={sheetItem.status} /> : null}
                  {sheetItem && workflowIndex(sheetItem.status) >= workflowIndex("en_ligne") ? <VintedBadge /> : null}
                </div>
                <p className="truncate text-xs text-[var(--muted-foreground)]">
                  {form.sku ? `Réf. ${form.sku}` : "Référence en attente"}
                </p>
              </div>
              {canDelete && sheetItem ? (
                <button
                  type="button"
                  onClick={() => requestDelete(sheetItem)}
                  className="hidden rounded-full border border-[var(--border)] p-2.5 text-red-600 transition hover:bg-red-50 sm:inline-flex"
                  aria-label="Supprimer l’article"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void saveArticleSheet()}
                disabled={!canUpdate || busy === "save"}
                className={cn(
                  "inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition disabled:opacity-50",
                  justSaved ? "bg-emerald-600" : "bg-[var(--primary)]",
                )}
              >
                {busy === "save" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enregistrement…
                  </>
                ) : justSaved ? (
                  <>
                    <Check className="h-4 w-4" />
                    Enregistré
                  </>
                ) : (
                  "Enregistrer"
                )}
              </button>
            </div>
          </div>

          <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
            {/* Colonne photos : grande image + miniatures, style boutique. */}
            <div className="grid gap-3 lg:sticky lg:top-24">
              <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--muted)]">
                {form.previewUrls.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setEditingPhotoIndex(Math.min(activePhotoIndex, form.previewUrls.length - 1))}
                    className="group block aspect-square w-full"
                    aria-label="Rogner la photo"
                  >
                    <img
                      src={form.previewUrls[Math.min(activePhotoIndex, form.previewUrls.length - 1)]}
                      alt={form.title}
                      className="h-full w-full object-cover"
                    />
                    <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white opacity-0 transition group-hover:opacity-100">
                      <Scissors className="h-3.5 w-3.5" />
                      Rogner
                    </span>
                  </button>
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center text-[var(--muted-foreground)]">
                    <Package className="h-10 w-10" />
                  </div>
                )}
                {form.previewUrls.length > 0 ? (
                  <div className="absolute right-3 top-3 flex gap-2">
                    <button type="button" onClick={() => void downloadPhotoPack()} disabled={busy === "photo-pack"} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-60" aria-label="Télécharger le pack de photos">
                      {busy === "photo-pack" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Pack photos
                    </button>
                    <button type="button" onClick={() => { const idx = Math.min(activePhotoIndex, form.previewUrls.length - 1); void downloadImage(form.previewUrls[idx], idx); }} className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black/75" aria-label="Télécharger la photo">
                      <Download className="h-3.5 w-3.5" /> Photo
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-5 gap-2">
                {form.previewUrls.map((url, index) => (
                  <div key={`${url}-${index}`} className="group relative">
                    <button
                      type="button"
                      onClick={() => setActivePhotoIndex(index)}
                      className={cn(
                        "block w-full overflow-hidden rounded-xl border-2 transition",
                        index === activePhotoIndex
                          ? "border-[var(--primary)]"
                          : "border-transparent hover:border-[var(--border)]",
                      )}
                      aria-label={`Voir la photo ${index + 1}`}
                    >
                      <img src={url} alt="" className="aspect-square w-full object-cover" />
                    </button>
                    {index === 0 ? (
                      <span className="pointer-events-none absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded-md bg-[var(--primary)] py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        Couverture
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCoverPhoto(index)}
                        className="absolute left-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100"
                        aria-label="Définir comme couverture"
                        title="Définir comme couverture"
                      >
                        <Star className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        removePhoto(index);
                        setActivePhotoIndex((current) => (current >= index && current > 0 ? current - 1 : current));
                      }}
                      className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100"
                      aria-label="Supprimer la photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] text-center text-[var(--muted-foreground)] transition hover:bg-[var(--muted)]">
                  {busy === "upload" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                  <span className="mt-1 text-[10px] font-semibold">Importer</span>
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => void handleFiles(event.target.files)}
                  />
                </label>
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] text-center text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] sm:hidden">
                  <Camera className="h-5 w-5" />
                  <span className="mt-1 text-[10px] font-semibold">Photo</span>
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => void handleFiles(event.target.files)}
                  />
                </label>
              </div>

              <div className="grid gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                <p className="text-sm text-[var(--muted-foreground)]">
                  Générez l’annonce à partir des photos ajoutées. Les champs restent modifiables ensuite.
                </p>
                <button
                  type="button"
                  onClick={() => void runAnalysis()}
                  disabled={Boolean(busy) || form.photos.length === 0 || !canAnalyze}
                  title={canAnalyze ? undefined : "Droit de génération d’annonce requis"}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === "analysis" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {busy === "analysis" ? "Génération..." : "Générer l’annonce depuis les photos"}
                </button>
              </div>
            </div>

            {/* Colonne détails : tous les champs directement modifiables. */}
            <div className="grid gap-5">
              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {sheetItem ? (() => {
                const current = workflowIndex(sheetItem.status);
                const steps = [
                  { status: "stock", label: "Article en stock", detail: "Fiche article et photos enregistrées." },
                  { status: "en_ligne", label: "Mis en ligne sur Vinted", detail: sheetItem.vintedAt ? `En ligne depuis ${vintedDaysOnline(sheetItem.vintedAt)} jour${vintedDaysOnline(sheetItem.vintedAt) === 1 ? "" : "s"}.` : "Prix affiché et case Vinted requis." },
                  { status: "en_cours_envoi", label: "Vendu", detail: "Prix de vente réel requis." },
                  { status: "envoye", label: "Expédié", detail: "Numéro de suivi ou note d'expédition requis." },
                  { status: "gagne", label: "Acheteur a accepté l'article", detail: "Vente définitivement gagnée." },
                ] as const;
                return (
                  <section className="grid gap-3 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
                    <div>
                      <h3 className="text-sm font-semibold">Avancement de la vente</h3>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">Chaque étape est sauvegardée et contrôlée avant validation.</p>
                    </div>
                    {sheetItem.status === "stock_b" ? (
                      <p className="rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-800">Cet article est dans le Stock B : il ne suit pas le parcours de vente en ligne.</p>
                    ) : steps.map((step, index) => {
                      const done = current >= index;
                      const next = current + 1 === index;
                      const target = step.status as Exclude<KlydeStatus, "stock" | "stock_b" | "archive">;
                      return (
                        <div key={step.status} className={cn("rounded-xl border p-3", done ? "border-emerald-500/40 bg-emerald-500/10" : "border-[var(--border)] bg-[var(--background)]")}>
                          <div className="flex items-start gap-3">
                            <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", done ? "bg-emerald-600 text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)]")}>{done ? <Check className="h-4 w-4" /> : index + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[var(--foreground)]">{step.label}</p>
                              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{step.detail}</p>
                            </div>
                            {next && index > 0 ? (
                              <button type="button" onClick={() => void advanceArticleWorkflow(target)} disabled={!canUpdate || busy === "workflow"} className="shrink-0 rounded-md bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                                {busy === "workflow" ? "Validation…" : "Valider"}
                              </button>
                            ) : null}
                            {done && index === current && index > 0 ? (
                              <button type="button" onClick={() => void returnToWorkflowStep(steps[index - 1].status)} disabled={!canUpdate || busy === "workflow"} className="shrink-0 rounded-md border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] disabled:opacity-50">
                                Décocher
                              </button>
                            ) : null}
                          </div>
                          {step.status === "en_cours_envoi" && next ? (
                            <label className="mt-3 grid gap-1.5 pl-9 text-xs font-medium text-[var(--muted-foreground)]">
                              Prix de vente réel
                              <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 focus-within:border-[var(--primary)]">
                                <input className="h-10 w-full bg-transparent text-base font-semibold text-[var(--foreground)] outline-none" inputMode="decimal" value={form.actualSalePrice} onChange={(event) => update("actualSalePrice", event.target.value)} placeholder="Prix encaissé" />
                                <span className="font-semibold text-[var(--muted-foreground)]">€</span>
                              </div>
                            </label>
                          ) : null}
                          {step.status === "envoye" && next ? (
                            <label className="mt-3 grid gap-1.5 pl-9 text-xs font-medium text-[var(--muted-foreground)]">
                              Numéro de suivi ou note d'expédition
                              <input className={inputClass()} value={shipmentNote} onChange={(event) => setShipmentNote(event.target.value)} placeholder="Ex. Colissimo 8A…" />
                            </label>
                          ) : null}
                        </div>
                      );
                    })}
                  </section>
                );
              })() : null}

              <div className="grid gap-4 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">Titre</span>
                  <input
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-lg font-semibold outline-none focus:border-[var(--primary)]"
                    value={form.title}
                    onChange={(event) => update("title", event.target.value)}
                    placeholder="Titre de l’article"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">Prix affiché</span>
                  <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 focus-within:border-[var(--primary)]">
                    <input
                      className="h-12 w-full bg-transparent text-2xl font-bold outline-none"
                      inputMode="decimal"
                      value={form.price}
                      onChange={(event) => update("price", event.target.value)}
                      placeholder="0"
                    />
                    <span className="text-xl font-semibold text-[var(--muted-foreground)]">€</span>
                  </div>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">Prix de vente réel</span>
                  <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 focus-within:border-[var(--primary)]">
                    <input className="h-12 w-full bg-transparent text-2xl font-bold outline-none" inputMode="decimal" value={form.actualSalePrice} onChange={(event) => update("actualSalePrice", event.target.value)} placeholder="Prix encaissé" />
                    <span className="text-xl font-semibold text-[var(--muted-foreground)]">€</span>
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)]">À renseigner si une offre est acceptée ; utilisé pour le chiffre d’affaires.</span>
                </label>
              </div>

              <div className="grid gap-4 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
                <h3 className="text-sm font-semibold">Caractéristiques</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Catégorie">
                    <select
                      className={inputClass()}
                      value={form.category}
                      onChange={(event) => {
                        update("category", event.target.value);
                        update("subcategory", "");
                      }}
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
                    <input
                      className={inputClass()}
                      value={form.brand}
                      onChange={(event) => update("brand", event.target.value)}
                    />
                  </Field>
                  {showSizeField ? (
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
                  ) : null}
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
                  {showMaterialField ? (
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
                  ) : null}
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
                  <Field label="Colis">
                    <select className={inputClass()} value={form.parcelSize} onChange={(event) => update("parcelSize", event.target.value)}>
                      <option>Petit</option>
                      <option>Moyen</option>
                      <option>Grand</option>
                    </select>
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
                  <Field label="Enseigne">
                    <select
                      className={inputClass()}
                      value={form.outlet}
                      onChange={(event) => update("outlet", event.target.value as FormState["outlet"])}
                    >
                      {OUTLETS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <div className="grid gap-4 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold">Description</span>
                  <textarea
                    className="min-h-32 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--primary)]"
                    value={form.description}
                    onChange={(event) => update("description", event.target.value)}
                  />
                </label>
              </div>

              {sheetItem?.vintedExtensionCount ? (
                <p className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-medium text-amber-900">
                  Annonce Vinted prolongée {sheetItem.vintedExtensionCount} fois.
                </p>
              ) : null}

              {canUpdate && sheetItem && vintedNeedsDecision(sheetItem) ? (
                <div className="grid gap-2 rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:grid-cols-2">
                  <p className="sm:col-span-2 text-sm font-semibold text-amber-900">Cette annonce Vinted est en ligne depuis plus de 3 semaines.</p>
                  <button type="button" onClick={() => void moveToStockB({ id: sheetItem._id })} className="h-10 rounded-md border border-amber-300 text-sm font-semibold text-amber-900">Sortir du stock</button>
                  <button type="button" onClick={() => void extendVintedListing({ id: sheetItem._id })} className="h-10 rounded-md bg-amber-500 text-sm font-semibold text-white">Prolonger en ligne</button>
                </div>
              ) : null}

              {canPublish && sheetItem?.status === "en_ligne" ? (
                <button type="button" onClick={() => void toggleFeatured(sheetItem._id)} className={cn("inline-flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-semibold", sheetItem.featured ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)]")}>
                  <Star className={cn("h-4 w-4", sheetItem.featured && "fill-[var(--primary)]")} />
                  {sheetItem.featured ? "Retirer de la mise en avant" : "Mettre en avant"}
                </button>
              ) : null}

              {canDelete && sheetItem ? (
                <button
                  type="button"
                  onClick={() => requestDelete(sheetItem)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-red-200 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 sm:hidden"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer l’article
                </button>
              ) : null}
            </div>
          </div>
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--background)]">
          <form onSubmit={submit} className="flex min-h-full w-full flex-col bg-[var(--background)]">
            <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]">
              <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-md border border-[var(--border)] p-2"
                  aria-label="Retour"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h2 className="min-w-0 truncate text-base font-semibold">
                  {editingId ? "Modifier l’article" : "Nouvel article"}
                </h2>
              </div>
            </div>

            <div className="mx-auto grid w-full max-w-3xl gap-4 p-4 sm:p-6">
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-[var(--card)] p-4 text-center">
                  <ImagePlus className="h-7 w-7 text-[var(--muted-foreground)]" />
                  <span className="mt-2 text-sm font-medium">Importer des photos</span>
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => void handleFiles(event.target.files)}
                  />
                </label>
                <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-[var(--card)] p-4 text-center sm:min-h-0">
                  <Camera className="h-7 w-7 text-[var(--muted-foreground)]" />
                  <span className="mt-2 text-sm font-medium">Prendre une photo</span>
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => void handleFiles(event.target.files)}
                  />
                </label>
              </div>

              {form.previewUrls.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {form.previewUrls.map((url, index) => (
                    <div key={`${url}-${index}`} className="group relative">
                      <button
                        type="button"
                        onClick={() => setEditingPhotoIndex(index)}
                        className="block w-full overflow-hidden rounded-md border border-[var(--border)]"
                        aria-label="Modifier la photo"
                      >
                        <img
                          src={url}
                          alt=""
                          className="aspect-square w-full object-cover transition group-hover:opacity-90"
                        />
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white opacity-0 transition group-hover:opacity-100">
                          <Scissors className="h-3 w-3" />
                          Rogner
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute right-1 top-1 rounded-md bg-black/70 p-1 text-white"
                        aria-label="Supprimer la photo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadImage(url, index)}
                        className="absolute left-1 top-1 rounded-md bg-black/70 p-1 text-white"
                        aria-label="Télécharger la photo"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      {index === 0 ? (
                        <span className="pointer-events-none absolute left-1 bottom-1 inline-flex items-center gap-1 rounded-md bg-[var(--primary)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          Couverture
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCoverPhoto(index)}
                          className="absolute left-1 bottom-1 rounded-md bg-black/70 p-1 text-white"
                          aria-label="Définir comme couverture"
                          title="Définir comme couverture"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
                <p className="text-sm text-[var(--muted-foreground)]">
                  L’annonce est générée automatiquement à partir des photos ajoutées.
                </p>
                <button
                  type="button"
                  onClick={() => void runAnalysis()}
                  disabled={Boolean(busy) || form.photos.length === 0 || !canAnalyze}
                  title={canAnalyze ? undefined : "Droit de génération d’annonce requis"}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === "analysis" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {busy === "analysis" ? "Génération..." : "Générer l’annonce depuis les photos"}
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
                {showSizeField ? (
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
                ) : null}
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
                {showMaterialField ? (
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
                ) : null}
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
                  <input
                    className={inputClass()}
                    value={form.sku}
                    onChange={(event) => update("sku", event.target.value)}
                    placeholder={editingId ? undefined : "Générée automatiquement si vide"}
                  />
                </Field>
                <Field label="Quantité">
                  <input className={inputClass()} inputMode="numeric" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} />
                </Field>
                <Field label="Enseigne">
                  <select
                    className={inputClass()}
                    value={form.outlet}
                    onChange={(event) => update("outlet", event.target.value as FormState["outlet"])}
                  >
                    {OUTLETS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {canPublish ? (
                <label className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
                  <span className="grid gap-0.5">
                    <span className="text-sm font-semibold">Mettre en ligne</span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      Publie directement l’article sur la boutique (prix requis).
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={publishOnCreate}
                    onChange={(event) => setPublishOnCreate(event.target.checked)}
                    className="h-5 w-5 rounded border-[var(--border)] accent-[var(--primary)]"
                  />
                </label>
              ) : null}

              <button
                type="submit"
                disabled={busy === "save" || busy === "upload"}
                className="h-11 rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "save"
                  ? "Enregistrement..."
                  : editingId
                    ? "Enregistrer les modifications"
                    : publishOnCreate
                      ? "Ajouter et mettre en ligne"
                      : "Ajouter au stock"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {(drawerOpen || articleSheetOpen) && editingPhotoIndex !== null && form.previewUrls[editingPhotoIndex] ? (
        <PhotoEditor
          url={form.previewUrls[editingPhotoIndex]}
          upload={upload}
          onReplace={(newId, newUrl) => replacePhotoAt(editingPhotoIndex, newId, newUrl)}
          onClose={() => setEditingPhotoIndex(null)}
        />
      ) : null}
    </div>
  );
}

function useShopWishlist(onAuthRequired: () => void) {
  const { isSignedIn } = useUser();
  const ids = useQuery(api.klyde.myWishlistIds, isSignedIn ? {} : "skip");
  const toggleMutation = useMutation(api.klyde.toggleWishlist);
  const idSet = useMemo(() => new Set((ids ?? []).map(String)), [ids]);

  async function toggle(itemId: string) {
    if (!isSignedIn) {
      onAuthRequired();
      return;
    }
    await toggleMutation({ itemId: itemId as Id<"klydeItems"> });
  }

  return { idSet, toggle };
}

function AuthRequiredModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <section className="w-full max-w-sm bg-[#f6eee5] p-6 text-center text-[#1f1b18] shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <Heart className="mx-auto h-8 w-8 text-[var(--primary)]" />
        <h2 className="mt-4 text-xl font-semibold">Connexion requise</h2>
        <p className="mt-2 text-sm leading-6 text-[#1f1b18]/62">
          Vous devez être connecté pour effectuer cette action.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-10 rounded-full bg-[#010102] px-6 text-sm font-semibold text-white"
        >
          Compris
        </button>
      </section>
    </div>
  );
}

function MenuLatest({
  category,
  label,
  gender,
  onNavigate,
}: {
  category: string;
  label: string;
  gender?: string;
  onNavigate: () => void;
}) {
  const items = useQuery(api.klyde.latestByCategory, { category, limit: 2 });
  return (
    <div className="hidden md:block">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#1f1b18]/70">
        Derniers articles · {label}
      </p>
      {items && items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <button
              key={item._id}
              type="button"
              onClick={() => {
                goTo(`/boutique/article/${item._id}`);
                onNavigate();
              }}
              className="group text-left"
            >
              <div className="aspect-[3/4] overflow-hidden bg-white">
                {item.photoUrls[0] ? (
                  <img
                    src={item.photoUrls[0]}
                    alt={item.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#1f1b18]/20">
                    <Package className="h-8 w-8" />
                  </div>
                )}
              </div>
              <p className="mt-2 line-clamp-1 text-xs font-medium normal-case tracking-normal">
                {item.title}
              </p>
              <p className="text-xs normal-case tracking-normal text-[var(--primary)]">
                {formatPrice(item.price)}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            goTo(shopCategoryPath(category, undefined, gender));
            onNavigate();
          }}
          className="flex aspect-[3/2] w-full items-center justify-center bg-white"
        >
          <img src="/logo-light.png" alt="Klyd" className="h-full w-full object-contain p-10" />
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          goTo(shopCategoryPath(category, undefined, gender));
          onNavigate();
        }}
        className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#1f1b18]/70 underline underline-offset-4 hover:text-[var(--primary)]"
      >
        Voir tout {label}
      </button>
    </div>
  );
}

function BoutiqueHeader() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-30 border-b border-[#1f1b18]/10 bg-white/95 text-[#1f1b18] backdrop-blur">
      <div className="relative flex h-20 items-center justify-between px-5 sm:h-24 sm:px-8">
        <div className="flex items-center gap-5 sm:gap-8">
          <button
            type="button"
            onClick={() => setOpenMenu((menu) => (menu ? null : shopMenus[0]?.label ?? null))}
            className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.04em] hover:opacity-60"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
            <span className="hidden sm:inline">Menu</span>
          </button>
          <button
            type="button"
            onClick={() => goTo("/boutique/recherche")}
            className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.04em] hover:opacity-60"
          >
            <Search className="h-5 w-5" />
            <span className="hidden sm:inline">Recherche</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => goTo("/boutique")}
          className="absolute left-1/2 -translate-x-1/2 text-xl font-semibold tracking-[0.18em] sm:text-3xl"
          aria-label="Accueil Klyde"
        >
          KLYDE
        </button>
        <div className="flex items-center gap-1 sm:gap-4">
          <button
            type="button"
            onClick={() => goTo("")}
            className="hidden text-xs font-medium tracking-[0.04em] hover:opacity-60 lg:inline-flex"
          >
            CRM
          </button>
          <button
            type="button"
            onClick={() => goTo("/boutique/favoris")}
            className="inline-flex h-10 w-10 items-center justify-center text-[#1f1b18] hover:opacity-60"
            aria-label="Voir les favoris"
          >
            <Heart className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => goTo("/boutique/panier")} className="inline-flex h-10 w-10 items-center justify-center hover:opacity-60" aria-label="Voir le panier">
            <ShoppingBag className="h-5 w-5" />
          </button>
        </div>
      </div>
      <nav
        onMouseLeave={() => setOpenMenu(null)}
        className="relative border-t border-[#1f1b18]/10 bg-white px-3 text-center text-[11px] font-medium tracking-[0.04em] text-[#1f1b18]/70"
      >
        <div className="mx-auto flex max-w-[96rem] items-center gap-1 overflow-x-auto sm:justify-center">
          <button
            type="button"
            onClick={() => goTo("/boutique")}
            className="shrink-0 border-b-2 border-[#1f1b18] px-4 py-4"
          >
            Tout voir
          </button>
          {shopMenus.map((menu) => (
            <button
              key={menu.label}
              type="button"
              onMouseEnter={() => setOpenMenu(menu.label)}
              onClick={() =>
                goTo(shopCategoryPath(menu.category, undefined, "gender" in menu ? menu.gender : undefined))
              }
              className="inline-flex shrink-0 items-center gap-1 border-b-2 border-transparent px-4 py-4 hover:border-[#1f1b18]/35"
            >
              {menu.label}
              <ChevronDown className="h-3 w-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => goTo("/boutique/favoris")}
            className="shrink-0 border-b-2 border-transparent px-4 py-4 hover:border-[#1f1b18]/35"
          >
            Favoris
          </button>
        </div>
        {openMenu ? (
          <div className="absolute inset-x-0 top-full z-40 border-b border-[#1f1b18]/10 bg-white px-6 py-8 text-left text-[#1f1b18] shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
            <div className="mx-auto grid max-w-[96rem] gap-8 md:grid-cols-[repeat(3,minmax(0,1fr))_300px]">
              {shopMenus
                .find((menu) => menu.label === openMenu)
                ?.groups.map(([title, links]) => (
                  <div key={title}>
                    <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#1f1b18]/70">
                      {title}
                    </h3>
                    <div className="grid gap-3">
                      {links.map((link) => {
                        const menu = shopMenus.find((item) => item.label === openMenu);
                        const validSubcategory =
                          menu &&
                          menu.category in categoryTree &&
                          (categoryTree[menu.category as keyof typeof categoryTree] as readonly string[]).includes(link);
                        return (
                          <button
                            key={link}
                            type="button"
                            onClick={() => {
                              const menu = shopMenus.find((item) => item.label === openMenu);
                              if (!menu) return;
                              goTo(
                                shopCategoryPath(
                                  menu.category,
                                  validSubcategory ? link : undefined,
                                  "gender" in menu ? menu.gender : undefined,
                                ),
                              );
                              setOpenMenu(null);
                            }}
                            className="text-left text-sm normal-case tracking-normal text-[#1f1b18]/68 hover:text-[var(--primary)]"
                          >
                            {link}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              {(() => {
                const menu = shopMenus.find((item) => item.label === openMenu);
                if (!menu) return null;
                return (
                  <MenuLatest
                    category={menu.category}
                    label={openMenu}
                    gender={"gender" in menu ? menu.gender : undefined}
                    onNavigate={() => setOpenMenu(null)}
                  />
                );
              })()}
            </div>
          </div>
        ) : null}
      </nav>
    </header>
  );
}

function BoutiqueShell({ route }: { route: ShopRoute }) {
  const cart = useKlydeCart();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const wishlist = useShopWishlist(() => setAuthModalOpen(true));
  return (
    <div className="flex min-h-screen flex-col bg-white text-[#1f1b18]">
      <BoutiqueHeader />
      <div className="flex-1">
        {route === "/boutique/panier" ? (
          <CartPage cart={cart} />
        ) : route === "/boutique/favoris" ? (
          <WishlistPage cart={cart} wishlist={wishlist} onAuthRequired={() => setAuthModalOpen(true)} />
        ) : route.startsWith("/boutique/recherche") ? (
          <SearchPage route={route} cart={cart} wishlist={wishlist} />
        ) : route.startsWith("/boutique/categorie/") ? (
          <CategoryPage route={route} cart={cart} wishlist={wishlist} />
        ) : route.startsWith("/boutique/article/") ? (
          <ProductDetailPage route={route} cart={cart} wishlist={wishlist} />
        ) : (
          <BoutiqueCatalog cart={cart} wishlist={wishlist} />
        )}
      </div>
      <BoutiqueFooter />
      {authModalOpen ? <AuthRequiredModal onClose={() => setAuthModalOpen(false)} /> : null}
    </div>
  );
}

function BoutiqueCatalog({
  cart,
  wishlist,
}: {
  cart: ReturnType<typeof useKlydeCart>;
  wishlist: ReturnType<typeof useShopWishlist>;
}) {
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
  const heroItem = useQuery(api.klyde.getFeatured, {});

  return (
    <main>
      <section className="relative h-[calc(100svh-8.5rem)] min-h-[34rem] overflow-hidden bg-[#171717] text-white sm:h-[calc(100svh-9.5rem)]">
        {heroItem?.photoUrls[0] ? (
          <button
            type="button"
            onClick={() => goTo(`/boutique/article/${heroItem._id}`)}
            className="group absolute inset-0 block h-full w-full text-left"
          >
            <img
              src={heroItem.photoUrls[0]}
              alt={heroItem.title}
              className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-[1.015]"
            />
          </button>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/30">
            <ShoppingBag className="h-24 w-24" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
        <div className="absolute left-5 top-5 rounded-full bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1f1b18] sm:left-8 sm:top-8">
          Article phare
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-12">
          <div className="max-w-md">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/75">
              {heroItem?.brand || "Sélection Klyde"}
            </p>
            <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-5xl">
              {heroItem?.title ?? "La prochaine pièce Klyde arrive bientôt"}
            </h1>
            {heroItem?.description ? (
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-white/85 sm:text-base sm:leading-7">
                {heroItem.description}
              </p>
            ) : (
              <p className="mt-4 text-sm leading-6 text-white/85 sm:text-base">
                Une pièce sélectionnée, prête à rejoindre votre vestiaire.
              </p>
            )}
            {heroItem ? <p className="mt-5 text-lg font-medium sm:text-xl">{formatPrice(heroItem.price)}</p> : null}
          </div>
        </div>
      </section>
      <section id="catalogue" className="bg-white">
        <div className="flex items-center justify-between border-b border-[#1f1b18]/10 px-5 py-3 sm:px-8">
          <p className="text-xs tracking-[0.04em] text-[#1f1b18]/60">Sélection Klyde</p>
          <details className="group relative">
            <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-full bg-[#010102] px-5 text-xs font-medium text-white marker:content-none">
              <Search className="h-4 w-4" />
              Filtres
            </summary>
            <div className="absolute right-0 top-12 z-20 grid w-[min(22rem,calc(100vw-2.5rem))] gap-2 border border-[#1f1b18]/10 bg-white p-3 shadow-xl sm:grid-cols-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 border border-[#1f1b18]/15 bg-white px-3 text-sm outline-none focus:border-[#1f1b18] sm:col-span-2"
              placeholder="Recherche"
            />
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 border border-[#1f1b18]/15 bg-white px-3 text-sm">
              <option value="">Catégorie</option>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={gender} onChange={(event) => setGender(event.target.value)} className="h-11 border border-[#1f1b18]/15 bg-white px-3 text-sm">
              <option value="">Genre</option>
              {genders.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={size} onChange={(event) => setSize(event.target.value)} className="h-11 border border-[#1f1b18]/15 bg-white px-3 text-sm sm:col-span-2">
              <option value="">Taille</option>
              {sizes.map((item) => <option key={item}>{item}</option>)}
            </select>
            </div>
          </details>
        </div>

        {items === undefined ? (
          <div className="flex items-center gap-2 py-16 text-sm text-[#1f1b18]/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement de la boutique
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm uppercase tracking-[0.22em] text-[#1f1b18]/50">
              Aucun article en ligne pour le moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <ShopProductCard key={item._id} item={item} cart={cart} wishlist={wishlist} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ShopProductCard({
  item,
  cart: _cart,
  wishlist,
}: {
  item: ShopItem;
  cart: ReturnType<typeof useKlydeCart>;
  wishlist: ReturnType<typeof useShopWishlist>;
}) {
  const saved = wishlist.idSet.has(item._id);
  const [photoIndex, setPhotoIndex] = useState(0);
  const hasMultiplePhotos = item.photoUrls.length > 1;
  const currentPhoto = item.photoUrls[photoIndex] ?? item.photoUrls[0];

  function previousPhoto() {
    setPhotoIndex((index) => (index - 1 + item.photoUrls.length) % item.photoUrls.length);
  }

  function nextPhoto() {
    setPhotoIndex((index) => (index + 1) % item.photoUrls.length);
  }

  return (
    <article className="group border-b border-r border-[#1f1b18]/10 bg-white">
      <div
        className="relative aspect-square overflow-hidden bg-[#f7f7f5]"
        onMouseEnter={() => hasMultiplePhotos && setPhotoIndex(1)}
        onMouseLeave={() => setPhotoIndex(0)}
      >
        <button
          type="button"
          onClick={() => void wishlist.toggle(item._id)}
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center text-[#1f1b18]/75 transition hover:text-[#1f1b18]"
          aria-label="Sauvegarder l’article"
        >
          <Heart className={cn("h-5 w-5", saved && "fill-[var(--primary)] text-[var(--primary)]")} />
        </button>
        {item.photoUrls[0] ? (
          <button type="button" onClick={() => goTo(`/boutique/article/${item._id}`)} className="block h-full w-full">
            <img
              key={currentPhoto}
              src={currentPhoto}
              alt={item.title}
              loading="lazy"
              decoding="async"
              className="shop-photo-fade h-full w-full object-contain transition duration-700 group-hover:scale-[1.025]"
            />
          </button>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#1f1b18]/25">
            <Package className="h-12 w-12" />
          </div>
        )}
        {hasMultiplePhotos ? (
          <>
            <button
              type="button"
              onClick={previousPhoto}
              className="absolute left-2 top-1/2 inline-flex h-10 w-8 -translate-y-1/2 items-center justify-center text-[#1f1b18]/70 opacity-0 transition hover:text-[#1f1b18] group-hover:opacity-100 focus:opacity-100"
              aria-label="Photo précédente"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={nextPhoto}
              className="absolute right-2 top-1/2 inline-flex h-10 w-8 -translate-y-1/2 items-center justify-center text-[#1f1b18]/70 opacity-0 transition hover:text-[#1f1b18] group-hover:opacity-100 focus:opacity-100"
              aria-label="Photo suivante"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 opacity-0 transition group-hover:opacity-100">
              {item.photoUrls.slice(0, 5).map((_, index) => (
                <span key={index} className={cn("h-1.5 rounded-full transition-all", index === photoIndex ? "w-4 bg-white" : "w-1.5 bg-white/70")} />
              ))}
            </div>
          </>
        ) : null}
      </div>
      <div className="min-h-[92px] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => goTo(`/boutique/article/${item._id}`)}
              className="line-clamp-2 text-left text-sm font-medium tracking-[0.02em] hover:opacity-55"
            >
              {item.title}
            </button>
            <p className="mt-1 text-xs text-[#1f1b18]/55">
              {[item.brand, item.size, item.condition].filter(Boolean).join(" · ")}
            </p>
          </div>
          <p className="shrink-0 text-sm font-medium">{formatPrice(item.price)}</p>
        </div>
      </div>
    </article>
  );
}

function SearchPage({
  route,
  cart,
  wishlist,
}: {
  route: ShopRoute;
  cart: ReturnType<typeof useKlydeCart>;
  wishlist: ReturnType<typeof useShopWishlist>;
}) {
  const query = parseSearchQuery(route);
  const [searchTerm, setSearchTerm] = useState(query);
  const items = useQuery(api.klyde.listPublic, query ? { searchText: query } : "skip");

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const trimmed = searchTerm.trim();
    if (trimmed) goTo(`/boutique/recherche?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <main className="mx-auto max-w-[96rem] px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
        Recherche
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {query ? `Résultats pour « ${query} »` : "Rechercher une pièce"}
      </h1>

      <form onSubmit={submitSearch} className="mt-7 flex max-w-xl border-b border-[#1f1b18]">
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Rechercher dans la sélection"
          className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#1f1b18]/45"
        />
        <button type="submit" className="inline-flex h-12 w-12 items-center justify-center" aria-label="Lancer la recherche">
          <Search className="h-5 w-5" />
        </button>
      </form>

      {!query ? (
        <p className="mt-10 text-sm text-[#1f1b18]/60">Saisissez un terme pour rechercher dans la sélection.</p>
      ) : items === undefined ? (
        <div className="mt-10 flex items-center gap-2 text-sm text-[#1f1b18]/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Recherche en cours
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 border border-[#1f1b18]/10 px-6 py-16 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-[#1f1b18]/50">
            Aucun article ne correspond à votre recherche.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#1f1b18]/45">
            {items.length} article{items.length > 1 ? "s" : ""}
          </p>
          <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => (
              <ShopProductCard key={item._id} item={item} cart={cart} wishlist={wishlist} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function BoutiqueFooter() {
  const { isSignedIn } = useUser();
  const access = useQuery(api.permissions.myAccess, isSignedIn ? {} : "skip");
  const hasKlydAccess = Boolean(
    access &&
      (access.isAdmin ||
        access.bootstrapMode ||
        access.grants.some((grant) => grant.pageKey.startsWith("klyde:"))),
  );

  return (
    <footer className="mt-16 border-t border-[#1f1b18]/10 bg-[#010102] text-white/75">
      <div className="mx-auto grid max-w-[96rem] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <div>
          <img src="/logo-light.png" alt="Klyd" className="h-10 w-auto object-contain" />
          <p className="mt-4 max-w-xs text-sm leading-6 text-white/55">
            Sélection textile haut de gamme, préparée pièce par pièce.
          </p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Boutique</h3>
          <ul className="mt-4 grid gap-2 text-sm">
            <li>
              <button type="button" onClick={() => goTo("/boutique")} className="hover:text-white">
                Nouveautés
              </button>
            </li>
            <li>
              <button type="button" onClick={() => goTo("/boutique/favoris")} className="hover:text-white">
                Favoris
              </button>
            </li>
            <li>
              <button type="button" onClick={() => goTo("/boutique/panier")} className="hover:text-white">
                Panier
              </button>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Maison</h3>
          <ul className="mt-4 grid gap-2 text-sm">
            <li className="text-white/55">Klyd — collection privée</li>
            {hasKlydAccess ? (
              <li>
                <button
                  type="button"
                  onClick={() => goTo("")}
                  className="inline-flex items-center gap-2 font-semibold text-white hover:text-[var(--primary)]"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Espace professionnel
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/40">
        © {new Date().getFullYear()} Klyd
      </div>
    </footer>
  );
}

function CategoryPage({
  route,
  cart,
  wishlist,
}: {
  route: ShopRoute;
  cart: ReturnType<typeof useKlydeCart>;
  wishlist: ReturnType<typeof useShopWishlist>;
}) {
  const parsed = parseShopCategory(route);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [brand, setBrand] = useState("");
  const [style, setStyle] = useState("");
  const [sort, setSort] = useState("recent");
  const rawItems = useQuery(api.klyde.listPublic, {
    category: parsed.category || undefined,
    subcategory: parsed.subcategory || undefined,
    gender: parsed.gender || undefined,
    size: size || undefined,
    searchText: color || material ? [color, material].filter(Boolean).join(" ") : undefined,
  });
  const brandOptions = useMemo(
    () =>
      Array.from(new Set((rawItems ?? []).map((item) => item.brand).filter((b): b is string => Boolean(b)))).sort(),
    [rawItems],
  );
  const styleOptions = useMemo(
    () =>
      Array.from(new Set((rawItems ?? []).map((item) => item.style).filter((s): s is string => Boolean(s)))).sort(),
    [rawItems],
  );
  const items = useMemo(() => {
    if (!rawItems) return rawItems;
    const filtered = rawItems.filter((item) => {
      if (brand && item.brand !== brand) return false;
      if (style && item.style !== style) return false;
      return true;
    });
    const sorted = [...filtered];
    if (sort === "price-asc") sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    else if (sort === "price-desc") sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    else sorted.sort((a, b) => b._creationTime - a._creationTime);
    return sorted;
  }, [rawItems, brand, style, sort]);
  const categorySubcategories =
    parsed.category in categoryTree
      ? categoryTree[parsed.category as keyof typeof categoryTree]
      : [];
  const pageTitle = parsed.subcategory || parsed.category || "Catalogue";

  return (
    <main>
      <section className="border-b border-[#1f1b18]/10 px-4 py-8 text-center sm:px-6">
        <div className="mx-auto max-w-[96rem]">
          <div className="mb-5 text-left text-sm italic text-[#1f1b18]/55">
            <button type="button" onClick={() => goTo("/boutique")} className="hover:text-[var(--primary)]">
              Accueil
            </button>
            <span className="mx-2">›</span>
            <span>{parsed.category}</span>
            {parsed.subcategory ? (
              <>
                <span className="mx-2">›</span>
                <span>{parsed.subcategory}</span>
              </>
            ) : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{pageTitle}</h1>
          <p className="mx-auto mt-5 max-w-4xl text-sm leading-7 text-[#1f1b18]/65">
            Découvrez les pièces Klyd actuellement disponibles dans cette sélection. Chaque article
            est contrôlé, photographié et préparé pour une expérience boutique haut de gamme.
          </p>
          <div className="mx-auto mt-6 flex max-w-5xl flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold underline underline-offset-4">
            {categorySubcategories.map((subcategory) => (
              <button
                key={subcategory}
                type="button"
                onClick={() => goTo(shopCategoryPath(parsed.category, subcategory, parsed.gender))}
                className={cn(
                  "text-[#1f1b18]/72 hover:text-[var(--primary)]",
                  parsed.subcategory === subcategory && "text-[var(--primary)]",
                )}
              >
                {subcategory}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-3 border-b border-[#1f1b18]/10 pb-6 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
          <select value={color} onChange={(event) => setColor(event.target.value)} className="h-11 border border-[#1f1b18]/12 bg-[#f6eee5] px-3 text-sm">
            <option value="">Couleur</option>
            {colors.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={material} onChange={(event) => setMaterial(event.target.value)} className="h-11 border border-[#1f1b18]/12 bg-[#f6eee5] px-3 text-sm">
            <option value="">Matière</option>
            {materials.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={size} onChange={(event) => setSize(event.target.value)} className="h-11 border border-[#1f1b18]/12 bg-[#f6eee5] px-3 text-sm">
            <option value="">Taille</option>
            {sizes.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={brand} onChange={(event) => setBrand(event.target.value)} disabled={brandOptions.length === 0} className="h-11 border border-[#1f1b18]/12 bg-[#f6eee5] px-3 text-sm disabled:text-[#1f1b18]/45">
            <option value="">Marques</option>
            {brandOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={style} onChange={(event) => setStyle(event.target.value)} disabled={styleOptions.length === 0} className="h-11 border border-[#1f1b18]/12 bg-[#f6eee5] px-3 text-sm disabled:text-[#1f1b18]/45">
            <option value="">Style</option>
            {styleOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-11 border border-[#1f1b18]/12 bg-[#f6eee5] px-3 text-sm lg:w-56">
            <option value="recent">Trier : nouveautés</option>
            <option value="price-asc">Prix croissant</option>
            <option value="price-desc">Prix décroissant</option>
          </select>
        </div>

        {items !== undefined ? (
          <p className="pt-5 text-xs uppercase tracking-[0.18em] text-[#1f1b18]/45">
            {items.length} article{items.length > 1 ? "s" : ""}
          </p>
        ) : null}

        {items === undefined ? (
          <div className="flex items-center gap-2 py-16 text-sm text-[#1f1b18]/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement des articles
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm uppercase tracking-[0.2em] text-[#1f1b18]/45">
            Aucun article dans cette catégorie.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-5 gap-y-10 pt-8 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <ShopProductCard key={item._id} item={item} cart={cart} wishlist={wishlist} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ProductDetailPage({
  route,
  cart,
  wishlist,
}: {
  route: ShopRoute;
  cart: ReturnType<typeof useKlydeCart>;
  wishlist: ReturnType<typeof useShopWishlist>;
}) {
  const itemId = parseShopArticleId(route);
  const item = useQuery(api.klyde.getPublic, { id: itemId as Id<"klydeItems"> });
  const [selectedPhoto, setSelectedPhoto] = useState(0);

  useEffect(() => {
    setSelectedPhoto(0);
  }, [itemId]);

  if (item === undefined) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center gap-2 text-sm text-[#1f1b18]/60">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement de l’article
      </main>
    );
  }

  if (!item) {
    return (
      <main className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Article indisponible</h1>
          <button
            type="button"
            onClick={() => goTo("/boutique")}
            className="mt-6 rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white"
          >
            Retour boutique
          </button>
        </div>
      </main>
    );
  }

  const saved = wishlist.idSet.has(item._id);
  const inCart = cart.has(item._id);
  const photo = item.photoUrls[selectedPhoto] ?? item.photoUrls[0] ?? "";
  const detailRows = [
    ["Catégorie", item.category],
    ["Sous-catégorie", item.subcategory],
    ["Marque", item.brand],
    ["État", item.condition],
    ["Matière", item.material],
    ["Référence", item.sku],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <main className="mx-auto max-w-[96rem] px-4 py-7 sm:px-6 lg:px-8">
      <div className="mb-6 text-sm italic text-[#1f1b18]/55">
        <button type="button" onClick={() => goTo("/boutique")} className="hover:text-[var(--primary)]">
          Accueil
        </button>
        <span className="mx-2">›</span>
        <button
          type="button"
          onClick={() => goTo(shopCategoryPath(item.category, item.subcategory, item.gender))}
          className="hover:text-[var(--primary)]"
        >
          {item.category}
        </button>
        {item.subcategory ? (
          <>
            <span className="mx-2">›</span>
            <span>{item.subcategory}</span>
          </>
        ) : null}
      </div>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_430px]">
        <div className="grid gap-3 lg:grid-cols-[92px_minmax(0,1fr)] lg:items-start">
          <div className="hidden grid-cols-1 content-start gap-3 lg:grid">
            {item.photoUrls.map((url, index) => (
              <button
                key={url}
                type="button"
                onClick={() => setSelectedPhoto(index)}
                className={cn(
                  "aspect-[3/4] overflow-hidden bg-white",
                  selectedPhoto === index && "ring-2 ring-[#010102]",
                )}
              >
                <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>

          <div className="relative min-h-[520px] bg-white">
            {photo ? (
              <img src={photo} alt={item.title} className="h-full max-h-[820px] w-full object-contain" />
            ) : (
              <div className="flex h-full min-h-[520px] items-center justify-center text-[#1f1b18]/25">
                <Package className="h-16 w-16" />
              </div>
            )}
          </div>
        </div>

        <aside className="lg:pl-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#1f1b18]/50">
                {item.subcategory || item.category}
              </p>
              <h1 className="mt-3 text-xl font-medium uppercase leading-7 tracking-[0.06em] text-[#1f1b18]/76">
                {item.title}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => void wishlist.toggle(item._id)}
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_16px_40px_rgba(0,0,0,0.08)]"
              aria-label="Sauvegarder l’article"
            >
              <Heart className={cn("h-6 w-6", saved && "fill-[var(--primary)] text-[var(--primary)]")} />
            </button>
          </div>

          <div className="mt-7 flex items-center gap-4">
            <span className="text-2xl font-semibold text-[var(--primary)]">
              {formatPrice(item.price)}
            </span>
          </div>

          <p className="mt-7 text-sm leading-7 text-[#1f1b18]/64">{item.description}</p>

          <div className="mt-7">
            <div className="flex items-center justify-between text-sm text-[#1f1b18]/58">
              <span>Taille : {item.size || "Unique"}</span>
              <span className="underline underline-offset-4">Guide des tailles</span>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {(item.size ? [item.size] : ["Unique"]).map((sizeValue) => (
                <button
                  type="button"
                  key={sizeValue}
                  className="h-12 border border-[#1f1b18]/15 bg-[#f6eee5] text-sm"
                >
                  {sizeValue}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => (inCart ? goTo("/boutique/panier") : cart.add(item._id))}
            className="mt-6 h-14 w-full bg-[#8f4a43] text-sm font-semibold uppercase tracking-[0.16em] text-white"
          >
            {inCart ? "Voir le panier" : "Ajouter au panier"}
          </button>
          <button
            type="button"
            disabled
            className="mt-3 h-14 w-full bg-[#010102] text-sm font-semibold uppercase tracking-[0.16em] text-white/45"
          >
            Paiement par carte
          </button>

          <div className="mt-6 bg-[#e9aaa0] p-5 text-sm">
            <p className="font-semibold uppercase tracking-[0.12em]">Service Klyd</p>
            <ul className="mt-4 grid gap-3 text-[#1f1b18]/76">
              <li>✓ Article contrôlé avant publication</li>
              <li>✓ Panier sauvegardé sans compte</li>
              <li>✓ Validation sécurisée après connexion</li>
            </ul>
          </div>

          <dl className="mt-6 grid gap-3 border-t border-[#1f1b18]/10 pt-5 text-sm">
            {detailRows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-[#1f1b18]/50">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>
    </main>
  );
}

function WishlistPage({
  cart,
  wishlist,
  onAuthRequired,
}: {
  cart: ReturnType<typeof useKlydeCart>;
  wishlist: ReturnType<typeof useShopWishlist>;
  onAuthRequired: () => void;
}) {
  const { isSignedIn } = useUser();
  const ids = useQuery(api.klyde.myWishlistIds, isSignedIn ? {} : "skip");
  const articles = useQuery(
    api.klyde.getManyPublic,
    ids && ids.length > 0 ? { ids: ids as Id<"klydeItems">[] } : "skip",
  );

  if (!isSignedIn) {
    return (
      <main className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4 py-16 text-center">
        <div>
          <Heart className="mx-auto h-12 w-12 text-[var(--primary)]" />
          <h1 className="mt-6 text-3xl font-semibold">Vos favoris</h1>
          <p className="mt-3 text-sm leading-6 text-[#1f1b18]/60">
            Connectez-vous pour retrouver les pièces que vous avez sauvegardées.
          </p>
          <button
            type="button"
            onClick={onAuthRequired}
            className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 text-sm font-semibold text-white"
          >
            Se connecter
          </button>
        </div>
      </main>
    );
  }

  const items = (articles ?? []).filter((item) => item.status === "en_ligne");

  return (
    <main className="mx-auto max-w-[96rem] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--primary)]">
          Sélection sauvegardée
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Mes favoris</h1>
      </div>

      {ids === undefined || (ids.length > 0 && articles === undefined) ? (
        <div className="flex items-center gap-2 py-16 text-sm text-[#1f1b18]/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement de vos favoris
        </div>
      ) : items.length === 0 ? (
        <div className="grid place-items-center border border-[#1f1b18]/10 px-6 py-20 text-center">
          <Heart className="h-10 w-10 text-[var(--primary)]" />
          <p className="mt-4 text-sm uppercase tracking-[0.2em] text-[#1f1b18]/50">
            Aucun favori pour le moment.
          </p>
          <button
            type="button"
            onClick={() => goTo("/boutique")}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 text-sm font-semibold text-white"
          >
            Découvrir la boutique
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {items.map((item) => (
            <ShopProductCard key={item._id} item={item} cart={cart} wishlist={wishlist} />
          ))}
        </div>
      )}
    </main>
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
                  <img src={item.photoUrls[0] ?? ""} alt="" loading="lazy" decoding="async" className="h-24 w-24 bg-white object-cover" />
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

function KlydeUserAvatar({ large = false }: { large?: boolean }) {
  const { user } = useUser();
  const name = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Moi";
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--primary)] font-semibold text-white", large ? "h-24 w-24 text-2xl" : "h-9 w-9 text-xs")}>
      {user?.imageUrl ? <img src={user.imageUrl} alt="" className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function KlydeProfilePage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  if (!isLoaded) {
    return <div className="grid min-h-screen place-items-center bg-[var(--background)] text-[var(--muted-foreground)]"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!user) return null;

  const accountUser = user;
  const currentFirstName = firstName || accountUser.firstName || "";
  const currentLastName = lastName || accountUser.lastName || "";
  const email = accountUser.primaryEmailAddress?.emailAddress ?? "";
  const displayName = [accountUser.firstName, accountUser.lastName].filter(Boolean).join(" ") || email || "Mon profil";

  async function saveProfile() {
    setSaving(true);
    setMessage("");
    try {
      await accountUser.update({ firstName: currentFirstName.trim(), lastName: currentLastName.trim() });
      await accountUser.reload();
      setMessage("Profil enregistré.");
    } catch {
      setMessage("Impossible d'enregistrer le profil.");
    } finally {
      setSaving(false);
    }
  }

  async function changePhoto(file?: File) {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      await accountUser.setProfileImage({ file });
      await accountUser.reload();
      setMessage("Photo mise à jour.");
    } catch {
      setMessage("Impossible de mettre à jour la photo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] p-4 text-[var(--foreground)] sm:p-8">
      <button type="button" onClick={() => goTo("")} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted-foreground)]">
        <ArrowLeft className="h-4 w-4" /> Retour au CRM
      </button>
      <section className="mx-auto max-w-2xl rounded-md border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <KlydeUserAvatar large />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold">{displayName}</h1>
            <p className="text-sm text-[var(--muted-foreground)]">{email}</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => changePhoto(event.target.files?.[0])} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border)] px-4 text-sm font-semibold">
              <Camera className="h-4 w-4" /> {uploading ? "Envoi..." : "Changer la photo"}
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Prénom<input className={inputClass()} value={currentFirstName} onChange={(event) => setFirstName(event.target.value)} /></label>
          <label className="text-sm font-medium">Nom<input className={inputClass()} value={currentLastName} onChange={(event) => setLastName(event.target.value)} /></label>
          <label className="text-sm font-medium sm:col-span-2">Email<input className={inputClass()} value={email} disabled /></label>
        </div>
        {message ? <p className="mt-4 rounded-md bg-[var(--muted)] p-3 text-sm">{message}</p> : null}
        <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-[var(--border)] pt-4">
          <button type="button" onClick={() => void signOut({ redirectUrl: "/" })} className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border)] px-4 text-sm font-semibold">
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
          <button type="button" onClick={saveProfile} disabled={saving} className="h-10 rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [route, setRoute] = useState(() => currentRoute());
  const clerk = useClerk();
  const { theme, toggle: toggleTheme } = useKlydeTheme();

  useEffect(() => {
    function syncRoute() {
      setRoute(currentRoute());
    }
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  if (route === "/profil") {
    return (
      <>
        <UpdateAvailableBanner appName="Klyde" />
        <SignedOut>
          <div className="grid min-h-screen place-items-center bg-[var(--background)] p-6 text-[var(--foreground)]">
            <AuthChoicePanel
              onSignIn={() => clerk.openSignIn({})}
              onSignUp={() => clerk.openSignUp({})}
            />
          </div>
        </SignedOut>
        <SignedIn>
          <ProfileSync app="klyde" />
          <KlydeProfilePage />
        </SignedIn>
      </>
    );
  }

  if (route) {
    return (
      <>
        <UpdateAvailableBanner appName="Klyde" />
        <SignedIn>
          <ProfileSync app="klyde" />
        </SignedIn>
        <BoutiqueShell route={route} />
      </>
    );
  }

  return (
    <>
      <UpdateAvailableBanner appName="Klyde" />
      <SignedOut>
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6 text-[var(--foreground)]">
          <div className="w-full max-w-sm rounded-md border border-[var(--border)] bg-[var(--card)] p-6">
            <Logo theme={theme} />
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">
              Connecte-toi pour accéder à ton stock.
            </p>
            <div className="mt-6">
              <AuthChoicePanel
                onSignIn={() => clerk.openSignIn({})}
                onSignUp={() => clerk.openSignUp({})}
              />
            </div>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <ProfileSync app="klyde" />
        <AppContent theme={theme} toggleTheme={toggleTheme} />
      </SignedIn>
    </>
  );
}

function AuthChoicePanel({
  onSignIn,
  onSignUp,
}: {
  onSignIn: () => void;
  onSignUp: () => void;
}) {
  return (
    <div className="grid w-full gap-3">
      <button
        type="button"
        onClick={onSignIn}
        className="rounded-2xl bg-[var(--primary)] px-5 py-4 text-base font-bold text-white shadow-sm transition hover:-translate-y-0.5"
      >
        J'ai déjà un compte, me connecter
      </button>
      <button
        type="button"
        onClick={onSignUp}
        className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 text-base font-bold text-[var(--foreground)] shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--accent)]"
      >
        Je m'inscris
      </button>
    </div>
  );
}
