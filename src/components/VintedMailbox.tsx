import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  FileText,
  Link2,
  MessageSquare,
  Loader2,
  Mail,
  Paperclip,
  ReceiptText,
  RefreshCw,
  Send,
  Unplug,
  X,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { cn } from "../lib/cn";

/**
 * Natures d'emails Vinted importées, dans l'ordre d'importance opérationnelle.
 * Les notifications de messagerie ne sont pas stockées : rien à filtrer ici.
 */
const KINDS = [
  { value: "vente", label: "Ventes" },
  { value: "bordereau", label: "Bordereaux" },
  { value: "expedition", label: "Expéditions" },
  { value: "offre", label: "Offres" },
] as const;

type Kind = (typeof KINDS)[number]["value"];

const KIND_STYLES: Record<string, string> = {
  vente: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  bordereau: "bg-sky-500/10 text-sky-600 border-sky-500/30",
  expedition: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
  offre: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/30",
};

/** Repli pour une nature héritée d'un import antérieur. */
const NEUTRAL_KIND_STYLE = "bg-slate-500/10 text-slate-500 border-slate-500/30";

function formatDate(ms: number) {
  return new Date(ms).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(value?: number) {
  if (value === undefined) return null;
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

/**
 * Boîte Gmail Vinted : connexion OAuth du compte, import des emails et
 * rapprochement avec le stock Klyd. Vinted n'ayant pas d'API, c'est l'unique
 * source automatisable pour les ventes, bordereaux et virements.
 */
export function VintedMailbox({
  canUpdate,
  canManage,
}: {
  canUpdate: boolean;
  canManage: boolean;
}) {
  const accounts = useQuery(api.klydeGmail.listAccounts);
  const stats = useQuery(api.klydeGmail.stats);
  const [kind, setKind] = useState<Kind | "">("");
  const [search, setSearch] = useState("");
  const emails = useQuery(api.klydeGmail.listEmails, {
    kind: kind || undefined,
    searchText: search || undefined,
  });

  const connectUrl = useAction(api.klydeGmail.connectUrl);
  const syncNow = useAction(api.klydeGmail.syncNow);
  const disconnect = useAction(api.klydeGmail.disconnect);
  const generateInvoice = useAction(api.klydeInvoices.generate);

  const [busy, setBusy] = useState<string | null>(null);
  const [invoiceEmailFor, setInvoiceEmailFor] = useState<Id<"klydeVintedEmails"> | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; message: string } | null>(null);

  // Retour de Google : `?gmail=ok|error` posé par la route HTTP Convex.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("gmail");
    if (!status) return;
    if (status === "ok") {
      setNotice({
        tone: "ok",
        message: `Boîte ${params.get("email") ?? "Gmail"} connectée. Premier import en cours.`,
      });
    } else {
      setNotice({
        tone: "error",
        message: params.get("message") ?? "La connexion Gmail a échoué.",
      });
    }
    params.delete("gmail");
    params.delete("email");
    params.delete("message");
    const query = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (query ? `?${query}` : ""),
    );
  }, []);

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    setNotice(null);
    try {
      await task();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBusy(null);
    }
  };

  const handleConnect = () =>
    run("connect", async () => {
      const url = await connectUrl({ returnUrl: window.location.href.split("?")[0] });
      window.location.href = url;
    });

  const handleSync = () =>
    run("sync", async () => {
      const result = await syncNow({});
      setNotice({
        tone: "ok",
        message: `${result.imported} nouvel${result.imported > 1 ? "s" : ""} email${result.imported > 1 ? "s" : ""} importé${result.imported > 1 ? "s" : ""}.`,
      });
    });

  const kindCounts = stats?.byKind ?? {};
  const revenue = useMemo(() => formatAmount(stats?.revenue), [stats?.revenue]);

  if (accounts === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement de la boîte Vinted
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <div
          className={cn(
            "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
            notice.tone === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
              : "border-red-500/30 bg-red-500/10 text-red-600",
          )}
        >
          {notice.tone === "ok" ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      ) : null}

      {/* ── Comptes connectés ───────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Boîte Gmail connectée</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canUpdate && accounts.length > 0 ? (
              <button
                type="button"
                onClick={handleSync}
                disabled={busy === "sync"}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {busy === "sync" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Synchroniser
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                onClick={handleConnect}
                disabled={busy === "connect"}
                className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy === "connect" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {accounts.length ? "Connecter une autre boîte" : "Connecter Gmail"}
              </button>
            ) : null}
          </div>
        </div>

        {accounts.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
            Aucune boîte connectée.
          </p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {accounts.map((account) => (
              <li
                key={account._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{account.email}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {account.importedCount} email{account.importedCount > 1 ? "s" : ""} importé
                    {account.importedCount > 1 ? "s" : ""}
                    {account.lastSyncAt
                      ? ` · dernière synchro ${formatDate(account.lastSyncAt)}`
                      : " · jamais synchronisée"}
                  </p>
                  {account.lastSyncError ? (
                    <p className="mt-1 text-xs text-red-600">{account.lastSyncError}</p>
                  ) : null}
                </div>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() =>
                      run(`disconnect-${account._id}`, async () => {
                        await disconnect({ accountId: account._id });
                        setNotice({ tone: "ok", message: "Boîte déconnectée." });
                      })
                    }
                    disabled={busy === `disconnect-${account._id}`}
                    className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] disabled:opacity-60"
                  >
                    <Unplug className="h-4 w-4" />
                    Déconnecter
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Compteurs ───────────────────────────────────────────────────── */}
      {stats ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
            <p className="text-xs text-[var(--muted-foreground)]">Emails importés</p>
            <p className="text-lg font-black">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
            <p className="text-xs text-[var(--muted-foreground)]">Rattachés au stock</p>
            <p className="text-lg font-black">{stats.matched}</p>
          </div>
          <div className="rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-4 py-3">
            <p className="text-xs text-[var(--muted-foreground)]">Ventes détectées</p>
            <p className="text-lg font-black text-[var(--primary)]">{revenue ?? "—"}</p>
          </div>
        </div>
      ) : null}

      {/* ── Filtres ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setKind("")}
          className={cn(
            "rounded-full border border-[var(--border)] px-3 py-1.5 text-sm font-medium",
            kind === "" && "bg-[var(--muted)]",
          )}
        >
          Tout
        </button>
        {KINDS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => setKind(entry.value)}
            className={cn(
              "rounded-full border border-[var(--border)] px-3 py-1.5 text-sm font-medium",
              kind === entry.value && "bg-[var(--muted)]",
            )}
          >
            {entry.label}
            {kindCounts[entry.value] ? (
              <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                {kindCounts[entry.value]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Rechercher (article, acheteur, n° de suivi…)"
        className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3.5 text-sm outline-none"
      />

      {/* ── Liste des emails ────────────────────────────────────────────── */}
      {emails === undefined ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement des emails
        </div>
      ) : emails.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-sm text-[var(--muted-foreground)]">
          Aucun email Vinted pour ce filtre.
        </div>
      ) : (
        <ul className="grid gap-3">
          {emails.map((email) => (
            <li
              key={email._id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {email.outlet ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold text-white",
                          email.outlet === "mobifrip" ? "bg-orange-500" : "bg-[var(--primary)]",
                        )}
                      >
                        {email.outlet === "mobifrip" ? "Mobifrip" : "Klyd"}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs font-semibold",
                        KIND_STYLES[email.kind] ?? NEUTRAL_KIND_STYLE,
                      )}
                    >
                      {KINDS.find((k) => k.value === email.kind)?.label ?? email.kind}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {formatDate(email.sentAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold">{email.subject}</p>
                  {email.itemTitle ? (
                    <p className="text-sm text-[var(--muted-foreground)]">{email.itemTitle}</p>
                  ) : null}
                </div>
                {email.amount !== undefined ? (
                  <span className="text-lg font-black text-[var(--primary)]">
                    {formatAmount(email.amount)}
                  </span>
                ) : null}
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {email.buyer ? (
                  <div className="flex gap-2">
                    <dt className="text-[var(--muted-foreground)]">Acheteur</dt>
                    <dd className="font-medium">{email.buyer}</dd>
                  </div>
                ) : null}
                {email.orderRef ? (
                  <div className="flex gap-2">
                    <dt className="text-[var(--muted-foreground)]">Commande</dt>
                    <dd className="font-medium">{email.orderRef}</dd>
                  </div>
                ) : null}
                {email.trackingNumber ? (
                  <div className="flex gap-2">
                    <dt className="text-[var(--muted-foreground)]">Suivi</dt>
                    <dd className="font-medium">{email.trackingNumber}</dd>
                  </div>
                ) : null}
                {email.carrier ? (
                  <div className="flex gap-2">
                    <dt className="text-[var(--muted-foreground)]">Transporteur</dt>
                    <dd className="font-medium">{email.carrier}</dd>
                  </div>
                ) : null}
              </dl>

              {email.matchedItem ? (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-2">
                  {email.matchedItem.photoUrl ? (
                    <img
                      src={email.matchedItem.photoUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--border)]">
                      <Link2 className="h-4 w-4 text-[var(--muted-foreground)]" />
                    </span>
                  )}
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-semibold">{email.matchedItem.title}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {email.matchedItem.sku ? `${email.matchedItem.sku} · ` : ""}
                      Article rattaché
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {email.conversationUrl ? (
                  <a
                    href={email.conversationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Conversation Vinted
                  </a>
                ) : null}
                {email.itemUrl ? (
                  <a
                    href={email.itemUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Annonce
                  </a>
                ) : null}
                {email.kind === "vente" && email.invoiceUrl ? (
                  <a
                    href={email.invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
                  >
                    <FileText className="h-4 w-4" />
                    Voir la facture{email.invoiceNumber ? ` ${email.invoiceNumber}` : ""}
                  </a>
                ) : null}
                {canUpdate && email.kind === "vente" && email.invoiceUrl ? (
                  <button
                    type="button"
                    onClick={() => setInvoiceEmailFor(email._id)}
                    className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
                  >
                    <Send className="h-4 w-4" />
                    {email.invoiceSentAt ? "Renvoyer au client" : "Envoyer au client"}
                  </button>
                ) : null}
                {canUpdate && email.kind === "vente" ? (
                  <button
                    type="button"
                    onClick={() =>
                      run(`invoice-${email._id}`, async () => {
                        const result = await generateInvoice({ emailId: email._id });
                        setNotice({
                          tone: "ok",
                          message: `Facture ${result.invoiceNumber} générée.`,
                        });
                      })
                    }
                    disabled={busy === `invoice-${email._id}`}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60",
                      email.invoiceUrl
                        ? "border border-[var(--border)] text-[var(--muted-foreground)]"
                        : "bg-[var(--primary)] text-white",
                    )}
                  >
                    {busy === `invoice-${email._id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ReceiptText className="h-4 w-4" />
                    )}
                    {email.invoiceUrl ? "Regénérer la facture" : "Générer la facture"}
                  </button>
                ) : null}
                {email.labelUrl ? (
                  <a
                    href={email.labelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
                  >
                    Ouvrir le bordereau
                  </a>
                ) : null}
                {email.attachments.map((attachment) =>
                  attachment.url ? (
                    <a
                      key={attachment.storageId}
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium"
                    >
                      <Paperclip className="h-4 w-4" />
                      {attachment.filename}
                    </a>
                  ) : null,
                )}
              </div>
              {email.invoiceSentAt ? (
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  Facture envoyée le {formatDate(email.invoiceSentAt)}
                  {email.invoiceSentTo ? ` à ${email.invoiceSentTo}` : ""}.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {invoiceEmailFor ? (
        <InvoiceEmailDialog
          emailId={invoiceEmailFor}
          onClose={() => setInvoiceEmailFor(null)}
          onSent={(to) => setNotice({ tone: "ok", message: `Facture envoyée à ${to}.` })}
        />
      ) : null}
    </div>
  );
}

/**
 * Confirmation avant envoi au client. Le vendeur ne compose pas l'email : il
 * relit un message type et l'ajuste. L'ossature (en-tête Mobifrip,
 * récapitulatif, pièce jointe) est ajoutée côté serveur, donc un texte
 * raccourci reste un email complet.
 */
function InvoiceEmailDialog({
  emailId,
  onClose,
  onSent,
}: {
  emailId: Id<"klydeVintedEmails">;
  onClose: () => void;
  onSent: (to: string) => void;
}) {
  const draft = useQuery(api.klydeInvoices.emailDraft, { emailId });
  const sendByEmail = useAction(api.klydeInvoices.sendByEmail);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loaded || !draft) return;
    setLoaded(true);
    setTo(draft.to);
    setSubject(draft.subject);
    setMessage(draft.message);
  }, [draft, loaded]);

  const reset = () => {
    if (!draft) return;
    setSubject(draft.subject);
    setMessage(draft.message);
  };

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await sendByEmail({ emailId, to, subject, message });
      onSent(result.sentTo);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:max-w-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Envoyer la facture au client</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Relisez le message avant l'envoi.
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

        {draft === undefined ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Préparation du message
          </div>
        ) : draft === null ? (
          <p className="mt-6 text-sm text-red-600">Email introuvable.</p>
        ) : (
          <div className="mt-5 space-y-4">
            {draft.sentAt ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
                Déjà envoyée le {formatDate(draft.sentAt)}
                {draft.sentTo ? ` à ${draft.sentTo}` : ""}.
              </p>
            ) : null}

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Destinataire</span>
              <input
                value={to}
                onChange={(event) => setTo(event.target.value)}
                placeholder="client@email.fr"
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3.5 text-sm outline-none"
              />
              {!draft.to ? (
                <span className="text-xs text-amber-600">
                  Aucune adresse trouvée dans l'email Vinted : saisissez-la.
                </span>
              ) : null}
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
                <button
                  type="button"
                  onClick={reset}
                  className="text-xs font-medium text-[var(--muted-foreground)] underline underline-offset-2"
                >
                  Rétablir le texte type
                </button>
              </span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={9}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3.5 py-3 text-sm leading-relaxed outline-none"
              />
            </label>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-3 text-sm">
              <p className="font-medium">Ajouté automatiquement au message</p>
              <ul className="mt-1.5 space-y-1 text-[var(--muted-foreground)]">
                <li>En-tête Mobifrip · 4 rue de la Prairie · 60650 Lachapelle-aux-Pots</li>
                <li>Récapitulatif : facture {draft.invoiceNumber}, article et montant</li>
                <li className="flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  Facture-{draft.invoiceNumber}.pdf en pièce jointe
                </li>
              </ul>
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
                Envoyer la facture
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
