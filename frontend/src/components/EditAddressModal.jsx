import { X, MapPin } from "lucide-react";

export default function EditAddressModal({
  isOpen,
  onClose,
  addressData,
  onSubmit,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute left-6 top-6 text-slate-400 hover:text-slate-600 transition bg-slate-50 hover:bg-slate-100 p-2 rounded-full"
        >
          <X size={20} />
        </button>
        <h2 className="text-xl font-black text-slate-950 mb-6">ویرایش نشانی</h2>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
            onClose();
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-2 block">
                کشور
              </label>
              <input
                type="text"
                defaultValue={addressData.country}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 mb-2 block">
                شهر
              </label>
              <input
                type="text"
                defaultValue={addressData.city}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 mb-2 block">
              آدرس دقیق
            </label>
            <textarea
              rows="2"
              defaultValue={addressData.address}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            ></textarea>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 mb-2 block">
              کد پستی
            </label>
            <input
              type="text"
              defaultValue={addressData.postalCode}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              dir="ltr"
            />
          </div>
          <div className="flex gap-3 pt-4 border-t border-slate-100 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-slate-100 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-200"
            >
              لغو
            </button>
            <button
              type="submit"
              className="flex-[2] flex justify-center items-center gap-2 rounded-xl bg-primary-600 py-3.5 text-sm font-black text-white shadow-glow transition hover:bg-primary-700 hover:-translate-y-0.5"
            >
              <MapPin size={18} /> ذخیره نشانی
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
