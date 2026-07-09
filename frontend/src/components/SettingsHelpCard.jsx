import { Headphones } from "lucide-react";

export default function SettingsHelpCard({ language = "fa" }) {
  const isFa = language === "fa";
  return (
    <div className="rounded-2xl bg-gradient-to-br from-teal-50 to-primary-50 p-6 border border-teal-100 shadow-sm hidden lg:block">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-600 mb-4">
        <Headphones className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-black text-slate-900 mb-2">
        {isFa ? "نیاز به کمک دارید؟" : "Need Help?"}
      </h3>
      <p className="text-sm font-medium text-slate-600 mb-6 leading-relaxed">
        {isFa
          ? "اگر در مورد تنظیمات سوالی دارید، با پشتیبانی در تماس باشید."
          : "If you have any questions about settings, contact support."}
      </p>
      <button className="w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-teal-700 shadow-sm transition hover:bg-teal-50 border border-teal-200">
        {isFa ? "تماس با پشتیبانی" : "Contact Support"}
      </button>
    </div>
  );
}
