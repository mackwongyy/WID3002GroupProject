export function StatCard({ label, value, caption }: { label: string; value: string | number; caption?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
      {caption ? <p className="mt-1 text-sm text-slate-500">{caption}</p> : null}
    </div>
  );
}
