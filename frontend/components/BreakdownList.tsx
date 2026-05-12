export function BreakdownList({ title, data }: { title: string; data: Record<string, number> | Array<{ phrase?: string; count: number; department?: string }> }) {
  const entries = Array.isArray(data)
    ? data.map((item) => [item.phrase ?? item.department ?? "Unknown", item.count] as [string, number])
    : Object.entries(data ?? {});

  const max = Math.max(1, ...entries.map(([, value]) => value));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-3">
        {entries.length === 0 ? <p className="text-sm text-slate-500">No data yet.</p> : null}
        {entries.map(([label, value]) => (
          <div key={label}>
            <div className="flex justify-between text-sm">
              <span className="font-medium text-slate-700">{label}</span>
              <span className="text-slate-500">{value}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-slate-900" style={{ width: `${(value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
