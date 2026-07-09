import { MapPin, Edit } from "lucide-react";

export default function AddressCard({ user, onEdit }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <MapPin size={20} />
        </div>
      </div>

      <div className="space-y-4 border-b border-slate-100 pb-5">
        <div className="flex justify-between">
          <span className="text-xs font-bold text-slate-500">کشور</span>
          <span className="text-sm font-black text-slate-900">
            {user.country}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs font-bold text-slate-500">شهر</span>
          <span className="text-sm font-black text-slate-900">{user.city}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs font-bold text-slate-500">آدرس</span>
          <span className="text-sm font-black text-slate-900 max-w-[150px] text-end">
            {user.address}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs font-bold text-slate-500">کد پستی</span>
          <span
            className="text-sm font-black text-slate-900 font-mono"
            dir="ltr"
          >
            {user.postalCode}
          </span>
        </div>
      </div>

      <button
        onClick={onEdit}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 shadow-sm"
      >
        <Edit size={16} /> ویرایش نشانی
      </button>
    </div>
  );
}
