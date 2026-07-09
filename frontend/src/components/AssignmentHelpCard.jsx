import { Headphones } from "lucide-react";
import { Link } from "react-router-dom";

export default function AssignmentHelpCard({ language = "fa" }) {
  const isFa = language === "fa";
  return (
    <div className="rounded-[24px] border border-slate-200 bg-primary-50 p-6 shadow-sm text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm">
        <Headphones size={24} />
      </div>
      <h3 className="text-lg font-black text-slate-950">
        {isFa ? "به کمک نیاز دارید؟" : "Need Help?"}
      </h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-primary-800">
        {isFa
          ? "اگر در مورد تمرین‌ها سوالی دارید، با پشتیبانی در تماس باشید."
          : "If you have questions about assignments, contact support."}
      </p>
      <Link
        to="/student/messages"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-black text-primary-700 shadow-sm transition hover:bg-slate-50 hover:-translate-y-0.5"
      >
        {isFa ? "تماس با پشتیبانی" : "Contact Support"}
      </Link>
    </div>
  );
}
