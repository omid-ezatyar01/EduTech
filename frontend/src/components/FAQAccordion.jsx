import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FAQAccordion({ question, answer }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-primary-200">
      <button
        className="flex w-full items-center justify-between px-6 py-5 text-start focus:outline-none"
        onClick={() => setOpen(!open)}
      >
        <span className="text-base font-black text-slate-950">{question}</span>
        <ChevronDown
          className={`text-slate-500 transition-transform ${open ? "rotate-180 text-primary-600" : ""}`}
          size={20}
        />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-6 pb-5 pt-4 font-medium leading-7 text-slate-600">
          {answer}
        </div>
      )}
    </div>
  );
}
