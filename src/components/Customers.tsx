import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Mail, MapPin, Pencil, Phone, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { cn } from "../lib/cn";

type CustomerList = NonNullable<ReturnType<typeof useQuery<typeof api.klydeCustomers.list>>>;
type Customer = CustomerList["customers"][number];

function euro(value: number) {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function day(ms?: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const SOURCE_LABELS: Record<Customer["source"], string> = {
  email: "Emails Vinted",
  manuel: "Saisi à la main",
  "les-deux": "Vinted + fiche",
};

/**
 * Clients Klyd.
 *
 * Les acheteurs ne sont saisis nulle part : ils viennent des emails Vinted, qui
 * portent le pseudo et, pour une vente Pro, le nom et l'adresse de facturation.
 * La liste les reconstitue à la lecture ; on n'ajoute à la main que ce qui n'est
 * pas passé par Vinted, ou un complément (téléphone, note) sur un acheteur connu.
 */
export function Customers({
  canCreate,
  canUpdate,
  canDelete,
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const data = useQuery(api.klydeCustomers.list);
  const remove = useMutation(api.klydeCustomers.removeCustomer);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"tous" | Customer["source"]>("tous");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const visible = useMemo(() => {
    const rows = data?.customers ?? [];
    const needle = search.trim().toLocaleLowerCase("fr-FR");
    return rows.filter((row) => {
      if (source !== "tous") {
        const matches =
          source === "email"
            ? row.source !== "manuel"
            : source === "manuel"
              ? row.source !== "email"
              : row.source === source;
        if (!matches) return false;
      }
      if (!needle) return true;
      return [row.name, row.email, row.vintedPseudo, row.address, row.note]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("fr-FR").includes(needle));
    });
  }, [data, search, source]);

  async function deleteCustomer(row: Customer) {
    if (deleting || !window.confirm(`Supprimer « ${row.name} » de la liste des clients ? Les emails et les ventes seront conservés.`)) return;
    setDeleting(row.key);
    setDeleteError(null);
    try {
      await remove({ key: row.key });
      if (openKey === row.key) setOpenKey(null);
    } catch {
      setDeleteError("Suppression impossible. Veuillez réessayer.");
    } finally {
      setDeleting(null);
    }
  }

  const opened = visible.find((row) => row.key === openKey) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nom, pseudo, email, adresse…"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] pl-9 pr-3 text-sm"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-1">
          {([
            ["tous", "Tous"],
            ["email", "Depuis Vinted"],
            ["manuel", "Ajoutés à la main"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSource(value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                source === value
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="ml-auto flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Nouveau client
          </button>
        ) : null}
      </div>

      {deleteError ? <p role="alert" className="text-sm text-red-600">{deleteError}</p> : null}

      {data === undefined ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lecture des clients
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Clients" value={String(data.stats.total)} primary />
            <Stat label="Reconnus dans les emails" value={String(data.stats.fromEmails)} />
            <Stat label="Clients fidèles" value={String(data.stats.repeat)} hint="Au moins deux achats" />
            <Stat label="Total acheté" value={euro(data.stats.revenue)} />
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center text-sm text-[var(--muted-foreground)]">
              {data.customers.length === 0
                ? "Aucun client pour l'instant. Les acheteurs apparaissent ici dès qu'un email de vente Vinted est importé."
                : "Aucun client ne correspond à cette recherche."}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              <table className="min-w-[880px] w-full text-sm">
                <thead className="bg-[var(--card)] text-[var(--muted-foreground)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-4 py-3 text-left font-medium">Client</th>
                    <th className="px-4 py-3 text-left font-medium">Coordonnées</th>
                    <th className="px-4 py-3 text-left font-medium">Achats</th>
                    <th className="px-4 py-3 text-left font-medium">Dernier achat</th>
                    <th className="px-4 py-3 text-left font-medium">Origine</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {visible.map((row) => (
                    <tr
                      key={row.key}
                      onClick={() => setOpenKey(row.key)}
                      className="cursor-pointer bg-[var(--background)] hover:bg-[var(--card)]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--muted)]">
                            <UserRound className="h-4 w-4 text-[var(--muted-foreground)]" />
                          </span>
                          <div className="min-w-0">
                            <p className="line-clamp-1 font-medium">{row.name}</p>
                            {row.vintedPseudo ? (
                              <p className="text-xs text-[var(--muted-foreground)]">
                                @{row.vintedPseudo.replace(/^@/, "")}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)]">
                        <p className="line-clamp-1">{row.email ?? "—"}</p>
                        {row.phone ? <p className="text-xs">{row.phone}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">{row.orders}</span>
                        {row.spent > 0 ? (
                          <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                            {euro(row.spent)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)]">
                        {day(row.lastOrderAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            row.source === "manuel"
                              ? "bg-[var(--muted)] text-[var(--foreground)]"
                              : "bg-[var(--primary)]/10 text-[var(--primary)]",
                          )}
                        >
                          {SOURCE_LABELS[row.source]}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {canCreate || canUpdate ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(row);
                                setFormOpen(true);
                              }}
                              className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                              aria-label={row.manualId ? "Modifier la fiche" : "Créer une fiche"}
                              title={
                                row.manualId
                                  ? "Modifier la fiche"
                                  : "Compléter ce client (téléphone, note…)"
                              }
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => void deleteCustomer(row)}
                              disabled={deleting !== null}
                              className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                              aria-label={`Supprimer ${row.name}`}
                              title="Supprimer le client"
                            >
                              {deleting === row.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-[var(--muted-foreground)]">
            Les clients « Depuis Vinted » sont reconstitués à la lecture des emails de vente :
            ils se mettent à jour automatiquement. Supprimer un client le retire de cette liste
            sans effacer ses emails ni ses ventes.
          </p>
        </>
      )}

      {opened ? <CustomerSheet customer={opened} onClose={() => setOpenKey(null)} /> : null}

      {formOpen ? (
        <CustomerDialog customer={editing} onClose={() => setFormOpen(false)} />
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  primary,
}: {
  label: string;
  value: string;
  hint?: string;
  primary?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-4",
        primary
          ? "border-[var(--primary)]/20 bg-[var(--primary)]/5"
          : "border-[var(--border)] bg-[var(--card)]",
      )}
    >
      <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
      <p className={cn("mt-1 text-2xl font-black", primary && "text-[var(--primary)]")}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted-foreground)]">{hint}</p> : null}
    </div>
  );
}

/** Fiche d'un client : coordonnées et historique d'achats. */
function CustomerSheet({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{customer.name}</h2>
            {customer.vintedPseudo ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                @{customer.vintedPseudo.replace(/^@/, "")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          {customer.email ? (
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              <a href={`mailto:${customer.email}`} className="underline underline-offset-2">
                {customer.email}
              </a>
            </p>
          ) : null}
          {customer.phone ? (
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              {customer.phone}
            </p>
          ) : null}
          {customer.address ? (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
              <span className="whitespace-pre-line">{customer.address}</span>
            </p>
          ) : null}
          {customer.note ? (
            <p className="rounded-lg bg-[var(--muted)] px-3 py-2 text-[var(--muted-foreground)]">
              {customer.note}
            </p>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-[var(--border)] px-2 py-2">
            <p className="text-xs text-[var(--muted-foreground)]">Achats</p>
            <p className="text-lg font-bold">{customer.orders}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] px-2 py-2">
            <p className="text-xs text-[var(--muted-foreground)]">Total</p>
            <p className="text-lg font-bold">{euro(customer.spent)}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] px-2 py-2">
            <p className="text-xs text-[var(--muted-foreground)]">Client depuis</p>
            <p className="text-sm font-bold">{day(customer.firstOrderAt)}</p>
          </div>
        </div>

        {customer.items.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Derniers achats</h3>
            <ul className="mt-2 divide-y divide-[var(--border)]">
              {customer.items.map((item, index) => (
                <li key={`${item.title}-${index}`} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-20 shrink-0 text-xs text-[var(--muted-foreground)]">
                    {day(item.at)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="shrink-0 font-semibold">
                    {item.amount != null ? euro(item.amount) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Création ou complément d'une fiche client. */
function CustomerDialog({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  const create = useMutation(api.klydeCustomers.create);
  const update = useMutation(api.klydeCustomers.update);
  const [name, setName] = useState(customer?.name ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [pseudo, setPseudo] = useState(customer?.vintedPseudo ?? "");
  const [note, setNote] = useState(customer?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manualId = customer?.manualId as Id<"klydeCustomers"> | undefined;

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const payload = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      vintedPseudo: pseudo.trim() || undefined,
      note: note.trim() || undefined,
    };
    try {
      if (manualId) await update({ id: manualId, ...payload });
      else await create(payload);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            {manualId ? "Modifier la fiche" : customer ? "Compléter ce client" : "Nouveau client"}
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

        {customer && !manualId ? (
          <p className="mt-3 rounded-lg bg-[var(--muted)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
            Ce client vient des emails Vinted. Enregistrer crée une fiche rattachée, qui
            ajoute ce que les emails ne portent pas — téléphone, note — sans les remplacer.
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          <Field label="Nom" value={name} onChange={setName} placeholder="Nom et prénom" />
          <Field label="Email" value={email} onChange={setEmail} placeholder="client@exemple.fr" />
          <Field label="Téléphone" value={phone} onChange={setPhone} placeholder="06…" />
          <Field label="Pseudo Vinted" value={pseudo} onChange={setPseudo} placeholder="@pseudo" />
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted-foreground)]">Adresse</span>
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm"
            />
          </label>
          <Field label="Note" value={note} onChange={setNote} placeholder="Vendu au marché de…" />

          {error ? (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>
          ) : null}

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
              disabled={busy || !name.trim()}
              className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-[var(--muted-foreground)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm"
      />
    </label>
  );
}
