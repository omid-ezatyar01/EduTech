import { Download, Plus, Upload } from "lucide-react";

export default function QuestionBankModal({ open, onClose, questions = [] }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-3" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <h3 className="text-xl font-black text-[#0F172A]">بانک سوالات</h3>
        <p className="mt-1 text-sm text-slate-600">سوالات چندگزینه‌ای، تشریحی و کدنویسی</p>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-slate-700"><Plus size={15} /> افزودن سوال</button>
          <button type="button" className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-slate-700"><Upload size={15} /> وارد کردن سوالات</button>
          <button type="button" className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-slate-700"><Download size={15} /> خروجی گرفتن</button>
        </div>

        <div className="mt-4 space-y-2">
          {questions.length ? (
            questions.map((item) => (
              <article key={item.id} className="rounded-xl border border-[#E2E8F0] p-3">
                <p className="text-xs font-bold text-[#0B4FD8]">{item.type || "-"}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{item.title || "-"}</p>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
              هنوز سوالی در بانک سوالات ثبت نشده است.
            </div>
          )}
        </div>

        <button type="button" onClick={onClose} className="mt-4 h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">بستن</button>
      </div>
    </div>
  );
}
