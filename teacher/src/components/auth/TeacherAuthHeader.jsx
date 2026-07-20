import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function TeacherAuthHeader({ language, isRTL, onLanguageChange }) {
  const logoSrc = "/logo.png";
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const languages = [
    { value: "fa", label: "فارسی" },
    { value: "en", label: "English" },
  ];

  const currentLabel = languages.find((item) => item.value === language)?.label || "فارسی";

  return (
    <header className={`flex h-20 items-center justify-between border-b border-[#E2E8F0] px-6 lg:px-10 ${isRTL ? "" : "flex-row-reverse"}`}>
      <img src={logoSrc} alt="EduTech" className="h-10 w-auto object-contain" />

      <div
        ref={menuRef}
        className={`relative flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm font-bold text-slate-700 shadow-sm ${isRTL ? "" : "flex-row-reverse"}`}
      >
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-sm font-bold text-slate-700 ring-1 ring-[#E2E8F0] transition hover:bg-slate-50 ${isRTL ? "" : "flex-row-reverse"}`}
        >
          {currentLabel}
          <ChevronDown size={14} className={`text-slate-500 transition ${open ? "rotate-180" : ""}`} />
        </button>

        {open ? (
          <div
            className={`absolute top-[calc(100%+8px)] z-50 min-w-[140px] rounded-xl border border-[#E2E8F0] bg-white p-1 shadow-xl ${isRTL ? "left-0" : "right-0"}`}
          >
            {languages.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  onLanguageChange(item.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  item.value === language
                    ? "bg-[#0B4FD8]/10 text-[#0B4FD8]"
                    : "text-slate-700 hover:bg-slate-50"
                } ${isRTL ? "" : "flex-row-reverse"}`}
              >
                <span>{item.label}</span>
                {item.value === language ? <Check size={14} /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}
