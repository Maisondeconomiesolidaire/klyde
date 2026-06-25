import { DragEvent, FormEvent, useMemo, useState } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ImagePlus,
  Kanban,
  LayoutGrid,
  List,
  Loader2,
  Package,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { cn } from "./lib/cn";
import { useUpload } from "./lib/useUpload";

type KlydeStatus = "stock" | "en_ligne" | "en_cours_envoi" | "envoye" | "gagne" | "archive";
type AppTab = "stock" | "suivi";
type StockMode = "cards" | "list";
type TrackingTab = "process" | "gagne";
type DetailMode = "article" | "demande";

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

type ListedItem = Doc<"klydeItems"> & { photoUrls: string[] };

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

  const visibleItems = items ?? [];
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
          {[item.category, item.color].filter(Boolean).join(" · ")}
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
          {[item.brand, item.size, item.category, item.condition].filter(Boolean).join(" · ")}
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
          {[item.brand, item.size].filter(Boolean).join(" · ") || item.category}
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
      <aside className="hidden w-56 shrink-0 border-r border-[var(--border)] bg-[var(--sidebar)] p-4 md:block">
        <div className="flex justify-center">
          <Logo />
        </div>
        <nav className="mt-8 grid gap-1">
          {navButton("stock", <Package className="h-4 w-4" />, "Stock")}
          {navButton("suivi", <Kanban className="h-4 w-4" />, "Suivi")}
        </nav>
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
              <div className="inline-flex w-fit rounded-md border border-[var(--border)] p-1">
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
                    ["Catégorie", detailItem.category],
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
                  <input className={inputClass()} value={form.category} onChange={(event) => update("category", event.target.value)} required />
                </Field>
                <Field label="Marque">
                  <input className={inputClass()} value={form.brand} onChange={(event) => update("brand", event.target.value)} />
                </Field>
                <Field label="Taille">
                  <input className={inputClass()} value={form.size} onChange={(event) => update("size", event.target.value)} />
                </Field>
                <Field label="État">
                  <select className={inputClass()} value={form.condition} onChange={(event) => update("condition", event.target.value)}>
                    {conditions.map((condition) => (
                      <option key={condition}>{condition}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Couleur">
                  <input className={inputClass()} value={form.color} onChange={(event) => update("color", event.target.value)} />
                </Field>
                <Field label="Matière">
                  <input className={inputClass()} value={form.material} onChange={(event) => update("material", event.target.value)} />
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
                  <input className={inputClass()} value={form.gender} onChange={(event) => update("gender", event.target.value)} />
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
