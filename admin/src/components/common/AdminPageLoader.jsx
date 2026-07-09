import { Loader2 } from "lucide-react";

export default function AdminPageLoader({
  label = "Loading",
  fullScreen = false,
  minHeight = "min-h-[360px]",
  className = "",
}) {
  const wrapperClass = fullScreen
    ? `flex min-h-screen items-center justify-center bg-slate-50 px-4 ${className}`
    : `flex ${minHeight} items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 ${className}`;

  return (
    <div className={wrapperClass}>
      <div className="inline-flex items-center justify-center gap-2 text-sm font-bold text-slate-600">
        <Loader2 size={18} className="shrink-0 animate-spin text-[#0B4FD8]" />
        <span>{label}</span>
      </div>
    </div>
  );
}
