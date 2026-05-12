import clsx from "clsx";

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "red" | "orange" | "yellow" | "green" | "blue" | "slate" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        tone === "red" && "bg-red-100 text-red-700",
        tone === "orange" && "bg-orange-100 text-orange-700",
        tone === "yellow" && "bg-yellow-100 text-yellow-700",
        tone === "green" && "bg-emerald-100 text-emerald-700",
        tone === "blue" && "bg-blue-100 text-blue-700",
        tone === "slate" && "bg-slate-100 text-slate-700"
      )}
    >
      {children}
    </span>
  );
}
