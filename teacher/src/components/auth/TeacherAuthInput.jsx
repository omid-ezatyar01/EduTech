export default function TeacherAuthInput({
  label,
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  isRTL,
  name,
  autoComplete = "off",
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="px-1 text-sm font-bold text-[#0F172A]">{label}</label>
      <div className="relative flex items-center">
        <div className={`absolute text-slate-400 ${isRTL ? "right-4" : "left-4"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <input
          type={type}
          name={name}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={`h-14 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-sm font-semibold text-[#0F172A] outline-none transition focus:border-[#0B4FD8] focus:bg-white focus:ring-4 focus:ring-[#0B4FD8]/10 ${
            isRTL ? "pl-4 pr-12 text-right" : "pr-4 pl-12 text-left"
          }`}
        />
      </div>
    </div>
  );
}
