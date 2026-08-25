import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { BarChart3, Loader2, Mail, Send, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
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

function day(ms: number) {
  return new Date(ms).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/**
 * Récapitulatif des ventes par mois et par année, et partage du rapport par
 * email. Le chiffre d'affaires vient des articles passés en « gagné » : toute
 * vente, Vinted comme boutique, finit par là.
 */
export function SalesReports({ canShare }: { canShare: boolean }) {
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
          <div className="grid gap-3 sm:grid-cols-3">
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
          </div>

          {/* ── Répartition mensuelle ─────────────────────────────────────── */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="text-sm font-semibold">
              Chiffre d'affaires mois par mois · {structureName(outlet)} · {year}
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
                  Aucune vente encaissée sur cette période.
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
            Chiffre d'affaires calculé sur les articles passés en « gagné », au prix
            réellement encaissé.
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
            {draft ? ` (${euro(draft.revenue)} · ${draft.salesCount} ventes)` : ""}.
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
