import { useMemo, useState } from "react";
import { X, CreditCard, UploadCloud } from "lucide-react";

const FALLBACK_AMOUNT_MAP = {
  "مکالمه انگلیسی — 20 دالر": "20 دالر",
  "توسعه MERN Stack — 30 دالر": "30 دالر",
  "UI/UX Design — 35 دالر": "35 دالر",
  "اشتراک پریمیوم — 40 دالر": "40 دالر",
};

export default function NewPaymentModal({
  isOpen,
  onClose,
  onSubmit,
  checkoutItems = [],
  defaultCheckoutId = null,
}) {
  const [course, setCourse] = useState(defaultCheckoutId || "");
  const [method, setMethod] = useState("Card");

  const optionsMap = useMemo(() => {
    if (checkoutItems.length === 0) {
      return FALLBACK_AMOUNT_MAP;
    }
    return checkoutItems.reduce((acc, item) => {
      acc[item.id] = item.amount;
      return acc;
    }, {});
  }, [checkoutItems]);
  const selectedCourse = course && optionsMap[course]
    ? course
    : defaultCheckoutId || Object.keys(optionsMap)[0] || "";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-[32px] bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute left-6 top-6 text-slate-400 hover:text-slate-600 transition"
        >
          <X size={24} />
        </button>
        <h2 className="text-xl font-black text-slate-950 mb-6">پرداخت جدید</h2>

        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ selectedCourse, method });
            onClose();
          }}
        >
          <div>
            <label className="text-xs font-bold text-slate-700 mb-2 block">
              انتخاب کورس / خدمات
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setCourse(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            >
              {checkoutItems.length > 0
                ? checkoutItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.courseTitle}
                    </option>
                  ))
                : Object.keys(FALLBACK_AMOUNT_MAP).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-2 block">
                مبلغ قابل پرداخت
              </label>
              <input
                type="text"
                readOnly
                value={optionsMap[selectedCourse] || ""}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 p-4 text-sm font-black text-slate-500 outline-none"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 mb-2 block">
                روش پرداخت
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              >
                <option value="Card">کارت بانکی (Card)</option>
                <option value="PayPal">پی‌پال (PayPal)</option>
                <option value="Manual">رسید بانکی (Manual Upload)</option>
              </select>
            </div>
          </div>

          {method === "Manual" && (
            <div className="pt-2 animate-in fade-in slide-in-from-top-2">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-6 transition hover:border-primary-400 hover:bg-slate-100">
                <UploadCloud size={28} className="text-slate-400 mb-2" />
                <span className="text-sm font-bold text-slate-700">
                  آپلود عکس یا فایل رسید
                </span>
                <input type="file" className="hidden" />
              </label>
            </div>
          )}
          <button
            type="submit"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-4 text-sm font-black text-white shadow-glow transition hover:bg-primary-700 hover:-translate-y-0.5"
          >
            <CreditCard size={18} className="pe-0.5" /> پرداخت و ثبت
          </button>
        </form>
      </div>
    </div>
  );
}
