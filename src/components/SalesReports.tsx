import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { BarChart3, Loader2, Mail, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { cn } from "../lib/cn";

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Nom porté par le rapport : une structure, ou les deux réunies. */
function structureName(outlet: "klyd" | "mobifrip" | null) {
  if (outlet === "mobifrip") return "Mobifrip";
  if (outlet === "klyd") return "Klyd";
  return "Klyd & Mobifrip";
}

function euro(value: number) {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

/** Poids en kg. Sous le kilo, deux décimales ; au-delà, une suffit. */
function weight(kg: number) {
  return `${kg.toLocaleString("fr-FR", {
    minimumFractionDigits: kg < 1 ? 2 : 1,
    maximumFractionDigits: kg < 1 ? 2 : 1,
  })} kg`;
}

function day(ms: number) {
  return new Date(ms).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/**
 * Récapitulatif des ventes par mois et par année, et partage du rapport par
 * email. Le chiffre d'affaires vient des articles enregistrés « Vendu » : la
 * confirmation ultérieure « Gagné » ne change pas le mois de vente.
 */
export function SalesReports({
  canShare,
  canEnterStore,
  canDeleteStore,
}: {
  canShare: boolean;
  canEnterStore: boolean;
  canDeleteStore: boolean;
}) {
  const [channel, setChannel] = useState<"enligne" | "magasin" | "analyse">("enligne");
  const years = useQuery(api.klydeReports.availableYears);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | null>(new Date().getMonth());
  // Mobifrip par défaut : c'est l'enseigne qui vend, et un rapport doit porter
  // le nom d'une structure, pas celui de l'outil.
  const [outlet, setOutlet] = useState<"klyd" | "mobifrip" | null>("mobifrip");
  const report = useQuery(api.klydeReports.salesReport, { year, month, outlet });
  const [shareOpen, setShareOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const bestMonth = useMemo(() => {
    if (!report) return null;
    const max = Math.max(...report.monthly);
    return max > 0 ? max : null;
  }, [report]);

  return (
    <div className="space-y-6">
      {notice ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      {/* Deux canaux, deux relevés : les ventes en ligne sortent du stock,
          le magasin est saisi à la main. Les mélanger masquerait la
          performance propre à chacun. */}
      <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1">
        {([
          ["enligne", "Ventes en ligne"],
          ["magasin", "Magasin"],
          ["analyse", "Analyse"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setChannel(value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
              channel === value
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {channel === "magasin" ? (
        <StoreReports canEnter={canEnterStore} canDelete={canDeleteStore} />
      ) : channel === "analyse" ? (
        <AnalysisPanel />
      ) : (
        <>
      {/* ── Période ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--muted-foreground)]">Année</span>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
          >
            {(years ?? [currentYear]).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--muted-foreground)]">Mois</span>
          <select
            value={month === null ? "" : month}
            onChange={(event) =>
              setMonth(event.target.value === "" ? null : Number(event.target.value))
            }
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
          >
            <option value="">Toute l'année</option>
            {MONTHS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1">
          {([
            ["mobifrip", "Mobifrip"],
            ["klyd", "Klyd"],
            [null, "Les deux"],
          ] as const).map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setOutlet(value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                outlet === value
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {canShare ? (
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="ml-auto flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white"
          >
            <Mail className="h-4 w-4" />
            Partager par email
          </button>
        ) : null}
      </div>

      {report === undefined ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calcul du rapport
        </div>
      ) : (
        <>
          {/* ── Chiffres clés ─────────────────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Chiffre d'affaires
              </p>
              <p className="mt-1 text-2xl font-black text-[var(--primary)]">
                {euro(report.revenue)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {structureName(outlet)} · {report.label}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Ventes
              </p>
              <p className="mt-1 text-2xl font-black">{report.salesCount}</p>
              {report.pendingCount > 0 ? (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  + {report.pendingCount} expédiée{report.pendingCount > 1 ? "s" : ""} non encaissée
                  {report.pendingCount > 1 ? "s" : ""} ({euro(report.pendingRevenue)})
                </p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Panier moyen
              </p>
              <p className="mt-1 text-2xl font-black">{euro(report.averageBasket)}</p>
              {outlet === null ? (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Klyd {euro(report.byOutlet.klyd)} · Mobifrip {euro(report.byOutlet.mobifrip)}
                </p>
              ) : null}
            </div>
            {/* Le poids vendu est le chiffre du réemploi : c'est lui qui dit
                combien de matière a été détournée du déchet. */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Poids vendu
              </p>
              <p className="mt-1 text-2xl font-black">{weight(report.weightKg)}</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Poids saisi, ou moyenne de la catégorie à défaut
              </p>
            </div>
          </div>

          {/* ── Répartition mensuelle ─────────────────────────────────────── */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="text-sm font-semibold">
              Chiffre d'affaires et poids mois par mois · {structureName(outlet)} · {year}
            </h2>
            <ul className="mt-3 space-y-1.5">
              {report.monthly.map((amount, index) => (
                <li
                  key={MONTHS[index]}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-1.5",
                    month === index && "bg-[var(--muted)]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setMonth(index)}
                    className="w-24 shrink-0 text-left text-sm capitalize hover:underline"
                  >
                    {MONTHS[index]}
                  </button>
                  {/* Barre proportionnelle au meilleur mois : la comparaison
                      d'un mois à l'autre se lit sans lire les chiffres. */}
                  <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                    <span
                      className="block h-full rounded-full bg-[var(--primary)]"
                      style={{
                        width: bestMonth ? `${Math.round((amount / bestMonth) * 100)}%` : "0%",
                      }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right text-sm text-[var(--muted-foreground)]">
                    {weight(report.monthlyWeight[index])}
                  </span>
                  <span
                    className={cn(
                      "w-24 shrink-0 text-right text-sm",
                      amount > 0 ? "font-semibold" : "text-[var(--muted-foreground)]",
                    )}
                  >
                    {euro(amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Détail des ventes de la période ───────────────────────────── */}
          {month !== null ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <h2 className="text-sm font-semibold">Ventes de {report.label}</h2>
              {report.sales.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                  Aucune vente enregistrée sur cette période.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-[var(--border)]">
                  {report.sales.map((sale) => (
                    <li key={sale.id} className="flex items-center gap-3 py-2">
                      <span className="w-16 shrink-0 text-xs text-[var(--muted-foreground)]">
                        {day(sale.soldAt)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{sale.title}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                          sale.outlet === "mobifrip"
                            ? "bg-orange-500 text-white"
                            : "bg-[var(--muted)] text-[var(--foreground)]",
                        )}
                      >
                        {sale.outlet === "mobifrip" ? "Mobifrip" : "Klyd"}
                      </span>
                      <span className="w-16 shrink-0 text-right text-xs text-[var(--muted-foreground)]">
                        {weight(sale.weightKg)}
                      </span>
                      <span className="w-20 shrink-0 text-right text-sm font-semibold">
                        {euro(sale.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <p className="flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
            <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Chiffre d'affaires calculé dès l'enregistrement « Vendu », au prix
            réellement renseigné. Le poids vendu additionne le poids de chaque article,
            saisi ou estimé d'après sa catégorie.
          </p>
        </>
      )}

      {shareOpen ? (
        <ShareReportDialog
          year={year}
          month={month}
          outlet={outlet}
          onClose={() => setShareOpen(false)}
          onSent={(to, label) => setNotice(`Rapport ${label} envoyé à ${to}.`)}
        />
      ) : null}
        </>
      )}
    </div>
  );
}

/** Envoi du rapport affiché : le destinataire, puis un message type modifiable. */
function ShareReportDialog({
  year,
  month,
  outlet,
  onClose,
  onSent,
}: {
  year: number;
  month: number | null;
  outlet: "klyd" | "mobifrip" | null;
  onClose: () => void;
  onSent: (to: string, label: string) => void;
}) {
  const draft = useQuery(api.klydeReports.emailDraft, { year, month, outlet });
  const sendByEmail = useAction(api.klydeReports.sendByEmail);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (draft && !loaded) {
    setLoaded(true);
    setSubject(draft.subject);
    setMessage(draft.message);
  }

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await sendByEmail({ to, year, month, outlet, subject, message });
      onSent(result.sentTo, result.label);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Partager le rapport</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              {structureName(outlet)} · {draft?.label ?? "Préparation…"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Email du destinataire</span>
            <input
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="destinataire@email.fr"
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3.5 text-sm outline-none"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Objet</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3.5 text-sm outline-none"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="flex items-center justify-between gap-2 text-sm font-medium">
              Message
              {draft ? (
                <button
                  type="button"
                  onClick={() => {
                    setSubject(draft.subject);
                    setMessage(draft.message);
                  }}
                  className="text-xs font-medium text-[var(--muted-foreground)] underline underline-offset-2"
                >
                  Rétablir le texte type
                </button>
              ) : null}
            </span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={7}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3.5 py-3 text-sm leading-relaxed outline-none"
            />
          </label>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-3 text-sm text-[var(--muted-foreground)]">
            Le rapport est joint en PDF, avec le récapitulatif
            {draft
              ? ` (${euro(draft.revenue)} · ${draft.salesCount} ventes · ${weight(draft.weightKg)})`
              : ""}
            .
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !to.trim()}
              className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Rapports magasin ────────────────────────────────────────────────────── */

const SITE_LABELS: Record<"60" | "76", string> = {
  "60": "Recyclerie 60",
  "76": "Recyclerie 76",
};

/** Semaines du relevé : l'équipe compte quatre semaines par mois. */
const STORE_WEEKS = [1, 2, 3, 4] as const;

/**
 * Chiffre d'affaires du magasin, relevé à la main.
 *
 * La boutique physique n'a pas de caisse reliée à Klyd : ses ventes sont
 * saisies par semaine et par recyclerie, et se lisent à côté des ventes en
 * ligne plutôt que fondues dedans.
 */
function StoreReports({
  canEnter,
  canDelete,
}: {
  canEnter: boolean;
  canDelete: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | null>(new Date().getMonth());
  const [site, setSite] = useState<"60" | "76" | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StoreEntry | null>(null);
  const report = useQuery(api.klydeReports.storeReport, { year, month, site });
  const removeEntry = useMutation(api.klydeReports.deleteStoreRevenue);

  const bestMonth = useMemo(() => {
    if (!report) return null;
    const max = Math.max(...report.monthly);
    return max > 0 ? max : null;
  }, [report]);

  const years = useMemo(() => {
    const list = new Set<number>([currentYear, year]);
    for (let value = currentYear; value >= currentYear - 4; value -= 1) list.add(value);
    return [...list].sort((a, b) => b - a);
  }, [currentYear, year]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--muted-foreground)]">Année</span>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--muted-foreground)]">Mois</span>
          <select
            value={month === null ? "" : month}
            onChange={(event) =>
              setMonth(event.target.value === "" ? null : Number(event.target.value))
            }
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
          >
            <option value="">Toute l'année</option>
            {MONTHS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1">
          {([
            [null, "Les deux"],
            ["60", "Recyclerie 60"],
            ["76", "Recyclerie 76"],
          ] as const).map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setSite(value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                site === value
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {canEnter ? (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="ml-auto flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Nouveau rapport magasin
          </button>
        ) : null}
      </div>

      {report === undefined ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calcul du rapport
        </div>
      ) : (
        <>
          {report.annualTotals.length > 0 ? (
            <div className="rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 p-4">
              <h2 className="text-sm font-semibold">Totaux annuels magasin · {year}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {report.annualTotals.map((annual) => (
                  <div key={annual.site}>
                    <p className="text-sm text-[var(--muted-foreground)]">{annual.site === "76" ? "Gournay · Recyclerie 76" : "Lachapelle · Recyclerie 60"}</p>
                    <p className="text-2xl font-bold">{euro(annual.amount)}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">Montants annuels de référence, sans répartition par mois ou par semaine. Les relevés détaillés éventuels ne s'ajoutent pas une seconde fois à ces totaux.</p>
              {month !== null ? <button type="button" onClick={() => setMonth(null)} className="mt-3 text-sm font-semibold text-[var(--primary)] underline">Voir toute l'année {year}</button> : null}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Chiffre d'affaires magasin
              </p>
              <p className="mt-1 text-2xl font-black text-[var(--primary)]">
                {month !== null && report.annualTotals.length > 0 && report.entries.length === 0 ? "Non renseigné" : euro(report.revenue)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {site ? SITE_LABELS[site] : "Les deux recycleries"} · {report.label}
              </p>
            </div>
            {(["60", "76"] as const).map((value) => (
              <div
                key={value}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-4"
              >
                <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  {SITE_LABELS[value]}
                </p>
                <p className="mt-1 text-2xl font-black">{month !== null && report.annualTotals.some((annual) => annual.site === value) && !report.entries.some((entry) => entry.site === value) ? "Non renseigné" : euro(report.bySite[value])}</p>
              </div>
            ))}
          </div>

          {/* Le relevé se fait par semaine : le rythme du mois se lit ici. */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="text-sm font-semibold">
              Par semaine · {report.label}
            </h2>
            {report.annualTotals.length > 0 && report.entries.length === 0 ? <p className="mt-3 text-sm text-[var(--muted-foreground)]">Détail hebdomadaire non renseigné.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {STORE_WEEKS.map((week, index) => (
                <div
                  key={week}
                  className="rounded-xl border border-[var(--border)] px-3 py-2"
                >
                  <p className="text-xs text-[var(--muted-foreground)]">Semaine {week}</p>
                  <p className="text-lg font-bold">{euro(report.weekly[index])}</p>
                </div>
              ))}
            </div>}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="text-sm font-semibold">
              Chiffre d'affaires magasin mois par mois · {year}
            </h2>
            {report.annualTotals.length > 0 ? <p className="mt-2 text-xs text-[var(--muted-foreground)]">Détail mensuel saisi uniquement ; « — » indique un mois non renseigné.</p> : null}
            <ul className="mt-3 space-y-1.5">
              {report.monthly.map((amount, index) => (
                <li
                  key={MONTHS[index]}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-1.5",
                    month === index && "bg-[var(--muted)]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setMonth(index)}
                    className="w-24 shrink-0 text-left text-sm capitalize hover:underline"
                  >
                    {MONTHS[index]}
                  </button>
                  <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                    <span
                      className="block h-full rounded-full bg-[var(--primary)]"
                      style={{
                        width: bestMonth ? `${Math.round((amount / bestMonth) * 100)}%` : "0%",
                      }}
                    />
                  </span>
                  <span
                    className={cn(
                      "w-24 shrink-0 text-right text-sm",
                      amount > 0 ? "font-semibold" : "text-[var(--muted-foreground)]",
                    )}
                  >
                    {report.annualTotals.length > 0 && !report.monthlyHasDetail[index] ? "—" : euro(amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="text-sm font-semibold">Relevés de {report.label}</h2>
            {report.entries.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                Aucun relevé sur cette période. Utilisez « Nouveau rapport magasin » pour
                saisir le chiffre d'affaires d'une semaine.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {report.entries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 py-2">
                    <span className="w-24 shrink-0 text-xs capitalize text-[var(--muted-foreground)]">
                      {MONTHS[entry.month]}
                    </span>
                    <span className="w-24 shrink-0 text-sm">Semaine {entry.week}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                        entry.site === "76"
                          ? "bg-orange-500 text-white"
                          : "bg-[var(--muted)] text-[var(--foreground)]",
                      )}
                    >
                      {SITE_LABELS[entry.site]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-[var(--muted-foreground)]">
                      {entry.note ?? ""}
                    </span>
                    <span className="w-24 shrink-0 text-right text-sm font-semibold">
                      {euro(entry.amount)}
                    </span>
                    {canEnter ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(entry);
                          setFormOpen(true);
                        }}
                        className="shrink-0 rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                        aria-label="Modifier le relevé"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => void removeEntry({ id: entry.id })}
                        className="shrink-0 rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                        aria-label="Supprimer le relevé"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
            <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Chiffre d'affaires saisi à la main, semaine par semaine et par recyclerie. Une
            semaine déjà renseignée est corrigée par une nouvelle saisie, jamais dupliquée.
          </p>
        </>
      )}

      {formOpen ? (
        <StoreRevenueDialog
          entry={editing}
          defaultYear={year}
          defaultMonth={month ?? new Date().getMonth()}
          defaultSite={site ?? "60"}
          onClose={() => setFormOpen(false)}
        />
      ) : null}
    </>
  );
}

type StoreEntry = {
  id: Id<"klydeStoreRevenues">;
  site: "60" | "76";
  year: number;
  month: number;
  week: number;
  amount: number;
  note?: string;
};

/** Saisie d'une semaine de chiffre d'affaires magasin. */
function StoreRevenueDialog({
  entry,
  defaultYear,
  defaultMonth,
  defaultSite,
  onClose,
}: {
  entry: StoreEntry | null;
  defaultYear: number;
  defaultMonth: number;
  defaultSite: "60" | "76";
  onClose: () => void;
}) {
  const save = useMutation(api.klydeReports.saveStoreRevenue);
  const [site, setSite] = useState<"60" | "76">(entry?.site ?? defaultSite);
  const [year, setYear] = useState(entry?.year ?? defaultYear);
  const [month, setMonth] = useState(entry?.month ?? defaultMonth);
  const [week, setWeek] = useState(entry?.week ?? 1);
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = Number(amount.replace(",", "."));
  const validAmount = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount >= 0;

  async function submit() {
    if (!validAmount) return;
    setBusy(true);
    setError(null);
    try {
      await save({
        site,
        year,
        month,
        week,
        amount: parsedAmount,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            {entry ? "Modifier le relevé" : "Nouveau rapport magasin"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-1.5 text-sm text-[var(--muted-foreground)]">Recyclerie</p>
            <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1">
              {(["60", "76"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSite(value)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                    site === value
                      ? "bg-[var(--primary)] text-white"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
                  )}
                >
                  {SITE_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1.5 block text-[var(--muted-foreground)]">Mois</span>
              <select
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
              >
                {MONTHS.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1.5 block text-[var(--muted-foreground)]">Année</span>
              <select
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
              >
                {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-1.5 text-sm text-[var(--muted-foreground)]">Semaine</p>
            <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1">
              {STORE_WEEKS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setWeek(value)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                    week === value
                      ? "bg-[var(--primary)] text-white"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
                  )}
                >
                  Semaine {value}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted-foreground)]">
              Chiffre d'affaires (€)
            </span>
            <input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Ex. 1 250,50"
              className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-base font-semibold"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted-foreground)]">
              Commentaire (facultatif)
            </span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex. braderie du samedi"
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
          ) : null}

          <p className="text-xs text-[var(--muted-foreground)]">
            Une semaine déjà saisie pour cette recyclerie est remplacée par ce montant.
          </p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !validAmount}
              className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Analyse : ce qui se vend, et en combien de temps ────────────────────── */

/** Onglet « Analyse » : sa propre période, indépendante des autres onglets. */
function AnalysisPanel() {
  const currentYear = new Date().getFullYear();
  const years = useQuery(api.klydeReports.availableYears);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | null>(null);
  const [outlet, setOutlet] = useState<"klyd" | "mobifrip" | null>(null);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--muted-foreground)]">Année</span>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
          >
            {(years ?? [currentYear]).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--muted-foreground)]">Mois</span>
          <select
            value={month === null ? "" : month}
            onChange={(event) =>
              setMonth(event.target.value === "" ? null : Number(event.target.value))
            }
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
          >
            <option value="">Toute l'année</option>
            {MONTHS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1">
          {([
            [null, "Les deux"],
            ["mobifrip", "Mobifrip"],
            ["klyd", "Klyd"],
          ] as const).map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setOutlet(value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                outlet === value
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <SalesAnalysis year={year} month={month} outlet={outlet} />
    </>
  );
}

/** Durée en jours, arrondie à la demi-journée près sous 10 jours. */
function days(value?: number) {
  if (value === undefined) return "—";
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${rounded.toLocaleString("fr-FR")} j`;
}

/**
 * Ce qui se vend le mieux, et en combien de temps.
 *
 * Un article de recyclerie est unique : classer les ventes par article n'aurait
 * aucun sens, deux robes ne sont jamais le même produit. L'analyse porte donc
 * sur ce qui se répète — catégorie, sous-catégorie, marque, état, taille.
 */
function SalesAnalysis({
  year,
  month,
  outlet,
}: {
  year: number;
  month: number | null;
  outlet: "klyd" | "mobifrip" | null;
}) {
  const analysis = useQuery(api.klydeReports.salesAnalysis, { year, month, outlet });
  const [dimension, setDimension] = useState<
    "categories" | "subcategories" | "brands" | "conditions" | "sizes"
  >("categories");

  if (analysis === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Analyse des ventes
      </div>
    );
  }

  const rows = analysis[dimension];
  const best = rows.length ? Math.max(...rows.map((row) => row.revenue)) : 0;
  const bucketMax = Math.max(...analysis.delay.buckets.map((bucket) => bucket.count), 1);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            Articles vendus
          </p>
          <p className="mt-1 text-2xl font-black text-[var(--primary)]">{analysis.salesCount}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {structureName(outlet)} · {analysis.label}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            Délai de vente médian
          </p>
          <p className="mt-1 text-2xl font-black">{days(analysis.delay.medianDays)}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Entre la mise en ligne et la vente
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            Délai moyen
          </p>
          <p className="mt-1 text-2xl font-black">{days(analysis.delay.averageDays)}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Sur {analysis.delay.measured} article{analysis.delay.measured > 1 ? "s" : ""} mesurable
            {analysis.delay.measured > 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            Délai inconnu
          </p>
          <p className="mt-1 text-2xl font-black">{analysis.delay.unknown}</p>
          {/* Sans date de mise en ligne, aucun délai n'est calculable : le dire
              évite de prendre la moyenne pour une vérité sur tout le stock. */}
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Articles vendus sans date de mise en ligne
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Ce qui se vend le mieux · {analysis.label}</h2>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--border)] p-1">
            {([
              ["categories", "Catégorie"],
              ["subcategories", "Sous-catégorie"],
              ["brands", "Marque"],
              ["conditions", "État"],
              ["sizes", "Taille"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDimension(value)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  dimension === value
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Aucune vente sur cette période.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {rows.map((row) => (
              <li key={row.label} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                <span className="w-40 shrink-0 truncate text-sm" title={row.label}>
                  {row.label}
                </span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                  <span
                    className="block h-full rounded-full bg-[var(--primary)]"
                    style={{ width: best ? `${Math.round((row.revenue / best) * 100)}%` : "0%" }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right text-xs text-[var(--muted-foreground)]">
                  {row.count} vendu{row.count > 1 ? "s" : ""}
                </span>
                <span className="w-20 shrink-0 text-right text-xs text-[var(--muted-foreground)]">
                  {days(row.averageDays)}
                </span>
                <span className="w-24 shrink-0 text-right text-sm font-semibold">
                  {euro(row.revenue)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-semibold">Combien de temps un article reste en ligne</h2>
        <ul className="mt-3 space-y-1.5">
          {analysis.delay.buckets.map((bucket) => (
            <li key={bucket.label} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
              <span className="w-36 shrink-0 text-sm">{bucket.label}</span>
              <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                <span
                  className="block h-full rounded-full bg-[var(--primary)]"
                  style={{ width: `${Math.round((bucket.count / bucketMax) * 100)}%` }}
                />
              </span>
              <span className="w-20 shrink-0 text-right text-sm font-semibold">
                {bucket.count}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {analysis.delay.fastest.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <DelayList title="Vendus le plus vite" entries={analysis.delay.fastest} />
          <DelayList title="Les plus longs à partir" entries={analysis.delay.slowest} />
        </div>
      ) : null}

      <p className="flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
        <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Le délai court de la mise en ligne — première publication Vinted ou boutique — à
        l'enregistrement de la vente. Un article vendu sans date de mise en ligne n'entre
        dans aucune moyenne.
      </p>
    </>
  );
}

function DelayList({
  title,
  entries,
}: {
  title: string;
  entries: Array<{
    id: string;
    title: string;
    category: string;
    brand?: string;
    amount: number;
    days?: number;
  }>;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-3 divide-y divide-[var(--border)]">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{entry.title}</span>
              <span className="block truncate text-xs text-[var(--muted-foreground)]">
                {[entry.brand, entry.category].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="w-16 shrink-0 text-right text-sm font-semibold">
              {days(entry.days)}
            </span>
            <span className="w-20 shrink-0 text-right text-xs text-[var(--muted-foreground)]">
              {euro(entry.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
