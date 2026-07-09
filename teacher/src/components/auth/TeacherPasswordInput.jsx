import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function TeacherPasswordInput({
  label,
  icon: Icon,
  placeholder,
  value,
  onChange,
  isRTL,
  name,
  autoComplete = "new-password",
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <label className="px-1 text-sm font-bold text-[#0F172A]">{label}</label>
      <div className="relative flex items-center">
        <div className={`absolute text-slate-400 ${isRTL ? "right-4" : "left-4"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <input
          type={showPassword ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={`h-14 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-sm font-semibold text-[#0F172A] outline-none transition focus:border-[#0B4FD8] focus:bg-white focus:ring-4 focus:ring-[#0B4FD8]/10 ${
            isRTL ? "pl-12 pr-12 text-right" : "pr-12 pl-12 text-left"
          }`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className={`absolute text-slate-400 hover:text-[#0B4FD8] transition ${isRTL ? "left-4" : "right-4"}`}
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}
