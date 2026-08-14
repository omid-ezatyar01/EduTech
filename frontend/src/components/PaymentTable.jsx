import { Download, MoreVertical, CreditCard } from "lucide-react";

const statusStyles = {
  success: "bg-green-50 text-green-700",
  pending: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  refunded: "bg-blue-50 text-blue-700",
  review: "bg-amber-50 text-amber-800",
  duplicate: "bg-orange-50 text-orange-800",
};

export default function PaymentTable({
  payments,
  onDownload,
  onDetails,
  language = "fa",
}) {
  const isFa = language === "fa";
  const t = {
    date: isFa ? "تاریخ" : "Date",
    descriptionCourse: isFa ? "شرح و کورس" : "Description & Course",
    amount: isFa ? "مبلغ" : "Amount",
    method: isFa ? "روش پرداخت" : "Payment Method",
    invoice: isFa ? "فاکتور" : "Invoice",
    status: isFa ? "وضعیت" : "Status",
    actions: isFa ? "عملیات" : "Actions",
    downloadInvoice: isFa ? "دانلود فاکتور" : "Download Invoice",
    details: isFa ? "جزئیات" : "Details",
    invoiceShort: isFa ? "فاکتور" : "Invoice",
    viewDetails: isFa ? "مشاهده جزئیات" : "View Details",
    pendingFollowUp: isFa ? "پیگیری پرداخت" : "Follow up",
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/50 font-bold text-slate-500">
            <tr>
              <th className="px-6 py-4 text-start font-bold">{t.date}</th>
              <th className="px-6 py-4 text-start font-bold">{t.descriptionCourse}</th>
              <th className="px-6 py-4 text-start font-bold">{t.amount}</th>
              <th className="px-6 py-4 text-start font-bold">{t.method}</th>
              <th className="px-6 py-4 text-start font-bold">{t.invoice}</th>
              <th className="px-6 py-4 text-start font-bold">{t.status}</th>
              <th className="px-6 py-4 text-end font-bold">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
            {payments.map((payment) => (
              <tr
                key={payment.id}
                className={`transition ${
                  payment.status === "pending"
                    ? "bg-amber-50/30 hover:bg-amber-50/50"
                    : "hover:bg-slate-50/50"
                }`}
              >
                <td className="px-6 py-5 whitespace-nowrap">
                  <p className="font-bold text-slate-900">{payment.date}</p>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    {payment.time}
                  </p>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                  <p className="font-black text-slate-950">
                    {payment.description}
                  </p>
                  <p className="text-xs font-bold text-slate-500 mt-1">
                    {payment.service}
                  </p>
                </td>
                <td
                  className="px-6 py-5 whitespace-nowrap font-black text-slate-900"
                  dir="ltr"
                >
                  {payment.amount}
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700 border border-slate-200">
                    <CreditCard size={14} className="text-slate-400" />{" "}
                    {payment.method}
                  </span>
                </td>
                <td className="px-6 py-5 whitespace-nowrap text-xs font-bold text-slate-500 font-mono tracking-wider">
                  {payment.invoice}
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                  <span
                    className={`inline-flex rounded-md px-2.5 py-1 text-[10px] font-black tracking-wider ${statusStyles[payment.status]}`}
                  >
                    {payment.statusLabel}
                  </span>
                </td>
                <td className="px-6 py-5 whitespace-nowrap text-end">
                  <div className="flex items-center justify-end gap-2">
                    {payment.status === "success" ? (
                      <button
                        onClick={() => onDownload(payment)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-primary-600"
                        title={t.downloadInvoice}
                      >
                        <Download size={16} />
                      </button>
                    ) : null}
                    <button
                      onClick={() => onDetails(payment)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-primary-600"
                      title={payment.status === "pending" ? t.pendingFollowUp : t.details}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden flex flex-col divide-y divide-slate-100">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className={`p-5 ${
              payment.status === "pending" ? "bg-amber-50/30" : ""
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-black text-slate-950">
                  {payment.description}
                </p>
                <p className="text-xs font-bold text-slate-500 mt-1">
                  {payment.service}
                </p>
              </div>
              <span
                className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-black ${statusStyles[payment.status]}`}
              >
                {payment.statusLabel}
              </span>
            </div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-lg font-black text-slate-900" dir="ltr">
                {payment.amount}
              </p>
              <p className="text-xs font-semibold text-slate-500">
                {payment.date} - {payment.time}
              </p>
            </div>
            <div className="flex gap-2">
              {payment.status === "success" ? (
                <button
                  onClick={() => onDownload(payment)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  <Download size={16} /> {t.invoiceShort}
                </button>
              ) : null}
              <button
                onClick={() => onDetails(payment)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-50 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-100"
              >
                {payment.status === "pending" ? t.pendingFollowUp : t.viewDetails}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
