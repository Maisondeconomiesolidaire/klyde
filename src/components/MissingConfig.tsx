export function MissingConfig({ missing }: { missing: string[] }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
      <div className="w-full max-w-xl rounded-lg border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        <div className="text-lg font-semibold text-[var(--foreground)]">Klyde</div>
        <h1 className="mt-6 text-2xl font-semibold text-[var(--foreground)]">
          Configuration requise
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Variables manquantes pour lancer l'application.
        </p>
        <ul className="mt-5 space-y-2">
          {missing.map((item) => (
            <li
              key={item}
              className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 font-mono text-sm"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
