import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

const CONDITIONS = [
  "Neuf avec étiquette",
  "Neuf sans étiquette",
  "Très bon état",
  "Bon état",
  "Satisfaisant",
] as const;

const PARCEL_SIZES = ["Petit", "Moyen", "Grand"] as const;

const itemStatus = v.union(
  v.literal("stock"),
  v.literal("en_ligne"),
  v.literal("en_cours_envoi"),
  v.literal("envoye"),
  v.literal("gagne"),
  v.literal("archive"),
);

type KlydeAIResult = {
  title: string;
  description: string;
  category: string;
  brand?: string | null;
  size?: string | null;
  condition: string;
  color?: string | null;
  material?: string | null;
  price?: number | null;
  parcelSize?: string | null;
  gender?: string | null;
  style?: string | null;
  aiConfidence?: number | null;
  aiNotes?: string | null;
};

async function requireSignedIn(ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Connexion requise.");
  return identity;
}

async function withPhotoUrls(
  ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } },
  item: Doc<"klydeItems">,
) {
  const photoUrls = await Promise.all(item.photos.map((id) => ctx.storage.getUrl(id)));
  return { ...item, photoUrls: photoUrls.filter((url): url is string => Boolean(url)) };
}

function cleanOptional(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function normalizePrice(value?: number | null) {
  if (value == null || Number.isNaN(value)) return undefined;
  return Math.max(0, Math.round(value * 100) / 100);
}

function normalizeQuantity(value?: number) {
  if (!value || Number.isNaN(value) || value < 1) return 1;
  return Math.floor(value);
}

function sanitizeAnalysis(result: KlydeAIResult): KlydeAIResult {
  const condition = CONDITIONS.includes(result.condition as (typeof CONDITIONS)[number])
    ? result.condition
    : "Bon état";
  const parcelSize = PARCEL_SIZES.includes(result.parcelSize as (typeof PARCEL_SIZES)[number])
    ? result.parcelSize
    : undefined;

  return {
    title: cleanOptional(result.title)?.slice(0, 80) || "Article textile",
    description:
      cleanOptional(result.description)?.slice(0, 1200) ||
      "Article textile d'occasion. Détails à vérifier avant publication.",
    category: cleanOptional(result.category) || "Vêtements",
    brand: cleanOptional(result.brand),
    size: cleanOptional(result.size),
    condition,
    color: cleanOptional(result.color),
    material: cleanOptional(result.material),
    price: normalizePrice(result.price),
    parcelSize,
    gender: cleanOptional(result.gender),
    style: cleanOptional(result.style),
    aiConfidence:
      result.aiConfidence == null ? undefined : Math.max(0, Math.min(1, result.aiConfidence)),
    aiNotes: cleanOptional(result.aiNotes),
  };
}

async function callOpenAI<T>(apiKey: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur OpenAI (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  let cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  if (!cleaned.startsWith("{")) {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
  }
  return JSON.parse(cleaned) as T;
}

export const list = query({
  args: {
    searchText: v.optional(v.string()),
    status: v.optional(itemStatus),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const items = args.status
      ? await ctx.db
          .query("klydeItems")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .order("desc")
          .collect()
      : await ctx.db.query("klydeItems").order("desc").collect();

    const search = args.searchText?.trim().toLowerCase();
    const filtered = search
      ? items.filter((item) =>
          [
            item.title,
            item.description,
            item.category,
            item.brand,
            item.size,
            item.color,
            item.material,
            item.sku,
            item.location,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search),
        )
      : items;

    return Promise.all(filtered.map((item) => withPhotoUrls(ctx, item)));
  },
});

export const create = mutation({
  args: {
    photos: v.array(v.id("_storage")),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    brand: v.optional(v.string()),
    size: v.optional(v.string()),
    condition: v.string(),
    color: v.optional(v.string()),
    material: v.optional(v.string()),
    price: v.optional(v.number()),
    parcelSize: v.optional(v.string()),
    gender: v.optional(v.string()),
    style: v.optional(v.string()),
    location: v.optional(v.string()),
    sku: v.optional(v.string()),
    quantity: v.optional(v.number()),
    aiConfidence: v.optional(v.number()),
    aiNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    if (args.photos.length === 0) throw new Error("Ajoutez au moins une photo.");
    const now = Date.now();
    return await ctx.db.insert("klydeItems", {
      photos: args.photos,
      title: args.title.trim() || "Article textile",
      description: args.description.trim(),
      category: args.category.trim() || "Vêtements",
      brand: cleanOptional(args.brand),
      size: cleanOptional(args.size),
      condition: args.condition.trim() || "Bon état",
      color: cleanOptional(args.color),
      material: cleanOptional(args.material),
      price: normalizePrice(args.price),
      parcelSize: cleanOptional(args.parcelSize),
      gender: cleanOptional(args.gender),
      style: cleanOptional(args.style),
      location: cleanOptional(args.location),
      sku: cleanOptional(args.sku),
      quantity: normalizeQuantity(args.quantity),
      status: "stock",
      aiConfidence: args.aiConfidence,
      aiNotes: cleanOptional(args.aiNotes),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("klydeItems"),
    status: itemStatus,
  },
  handler: async (ctx, { id, status }) => {
    await requireSignedIn(ctx);
    await ctx.db.patch(id, { status, updatedAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    id: v.id("klydeItems"),
    photos: v.array(v.id("_storage")),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    brand: v.optional(v.string()),
    size: v.optional(v.string()),
    condition: v.string(),
    color: v.optional(v.string()),
    material: v.optional(v.string()),
    price: v.optional(v.number()),
    parcelSize: v.optional(v.string()),
    gender: v.optional(v.string()),
    style: v.optional(v.string()),
    location: v.optional(v.string()),
    sku: v.optional(v.string()),
    quantity: v.optional(v.number()),
    aiConfidence: v.optional(v.number()),
    aiNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    if (args.photos.length === 0) throw new Error("Ajoutez au moins une photo.");
    await ctx.db.patch(args.id, {
      photos: args.photos,
      title: args.title.trim() || "Article textile",
      description: args.description.trim(),
      category: args.category.trim() || "Vêtements",
      brand: cleanOptional(args.brand),
      size: cleanOptional(args.size),
      condition: args.condition.trim() || "Bon état",
      color: cleanOptional(args.color),
      material: cleanOptional(args.material),
      price: normalizePrice(args.price),
      parcelSize: cleanOptional(args.parcelSize),
      gender: cleanOptional(args.gender),
      style: cleanOptional(args.style),
      location: cleanOptional(args.location),
      sku: cleanOptional(args.sku),
      quantity: normalizeQuantity(args.quantity),
      aiConfidence: args.aiConfidence,
      aiNotes: cleanOptional(args.aiNotes),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("klydeItems") },
  handler: async (ctx, { id }) => {
    await requireSignedIn(ctx);
    await ctx.db.delete(id);
  },
});

export const analyzePhotos = action({
  args: {
    storageIds: v.array(v.id("_storage")),
    extraDetails: v.optional(v.string()),
  },
  handler: async (ctx, { storageIds, extraDetails }) => {
    await requireSignedIn(ctx);
    if (storageIds.length === 0) throw new Error("Aucune photo à analyser.");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Clé OpenAI absente du déploiement Convex partagé.");
    }

    const urls = await Promise.all(storageIds.slice(0, 8).map((id) => ctx.storage.getUrl(id)));
    const imageUrls = urls.filter((url): url is string => Boolean(url));
    if (imageUrls.length === 0) throw new Error("Photos introuvables dans le stockage Convex.");

    const prompt = `Tu remplis une fiche Vinted pour un stock textile français.
Analyse toutes les photos ensemble, y compris étiquettes, défauts, matières et coupe.
Retourne uniquement un JSON valide avec ces champs:
{
  "title": "titre Vinted clair, max 80 caractères",
  "description": "description prête à publier, objective, mentionne l'état et les défauts visibles",
  "category": "catégorie Vinted précise ex: Femmes > Robes, Hommes > Manteaux, Enfants > Hauts",
  "brand": "marque si visible ou null",
  "size": "taille si visible ou estimée prudemment, sinon null",
  "condition": "une de: Neuf avec étiquette | Neuf sans étiquette | Très bon état | Bon état | Satisfaisant",
  "color": "couleur principale, sinon null",
  "material": "matière si visible/probable, sinon null",
  "price": prix conseille en euros pour Vinted, nombre ou null,
  "parcelSize": "Petit | Moyen | Grand",
  "gender": "Femmes | Hommes | Enfants | Bébé | Unisexe ou null",
  "style": "style/mots utiles: vintage, casual, sport, chic... ou null",
  "aiConfidence": nombre entre 0 et 1,
  "aiNotes": "points à vérifier humainement"
}
Sois prudent: si marque, taille ou matière ne sont pas visibles, mets null.
${extraDetails?.trim() ? `Contexte fourni par l'utilisateur: ${extraDetails.trim()}` : ""}`;

    const result = await callOpenAI<KlydeAIResult>(apiKey, {
      model: "gpt-4o",
      temperature: 0.1,
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: [
            ...imageUrls.map((url) => ({
              type: "image_url",
              image_url: { url, detail: "high" },
            })),
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    return sanitizeAnalysis(result);
  },
});
