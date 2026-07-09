import { useState } from "react";
import { X, Lock, Eye, EyeOff } from "lucide-react";

export default function ChangePasswordModal({ isOpen, onClose, onSubmit }) {
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  if (!isOpen) return null;

  const toggleShow = (field) =>
    setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));

  const PasswordField = ({ label, fieldKey }) => (
    <div>
      <label className="text-xs font-bold text-slate-700 mb-2 block">
        {label}
      </label>
      <div className="relative flex items-center">
        <Lock size={18} className="absolute start-4 text-slate-400" />
        <input
          type={showPassword[fieldKey] ? "text" : "password"}
          placeholder="••••••••••"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pe-12 ps-11 text-sm font-semibold outline-none transition focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
          dir="ltr"
        />
        <button
          type="button"
          onClick={() => toggleShow(fieldKey)}
          className="absolute end-4 text-slate-400 hover:text-slate-600 transition"
        >
          {showPassword[fieldKey] ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute left-6 top-6 text-slate-400 hover:text-slate-600 transition bg-slate-50 hover:bg-slate-100 p-2 rounded-full"
        >
          <X size={20} />
        </button>
        <h2 className="text-xl font-black text-slate-950 mb-6">
          تغییر رمز عبور
        </h2>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
            onClose();
          }}
        >
          <PasswordField label="رمز عبور فعلی" fieldKey="current" />
          <PasswordField label="رمز عبور جدید" fieldKey="new" />
          <PasswordField label="تایید رمز عبور جدید" fieldKey="confirm" />

          <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-slate-100 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-200"
            >
              لغو
            </button>
            <button
              type="submit"
              className="flex-[2] rounded-xl bg-primary-600 py-3.5 text-sm font-black text-white shadow-glow transition hover:bg-primary-700 hover:-translate-y-0.5"
            >
              تغییر رمز عبور
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
