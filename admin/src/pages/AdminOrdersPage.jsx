import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  Receipt,
  Search,
  ShoppingCart,
  XCircle,
} from "lucide-react";
import { useAdminI18n } from "../i18n/AdminI18nContext.jsx";

const ORDER_ROWS = [];

const statusMeta = {
  completed: {
    label: "Completed",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  pending: {
    label: "Pending",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const formatMoney = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) =>
  new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

function SummaryCard({ icon: Icon, title, value, note, tone }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
        <Icon size={20} />
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-800">{value}</p>
      <p className="mt-2 text-sm font-normal text-slate-600">{note}</p>
    </article>
  );
}

export default function AdminOrdersPage() {
  const { t } = useAdminI18n();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return ORDER_ROWS.filter((order) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          order.id,
          order.studentName,
          order.studentEmail,
          order.paymentMethod,
          order.region,
          ...order.courses,
        ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));

      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesPayment = paymentFilter === "all" || order.paymentMethod === paymentFilter;

      return matchesQuery && matchesStatus && matchesPayment;
    });
  }, [paymentFilter, query, statusFilter]);

  const summary = useMemo(() => {
    return filteredOrders.reduce(
      (acc, order) => {
        acc.total += 1;
        acc.revenue += Number(order.amountUsd || 0);
        if (order.status === "completed") acc.completed += 1;
        if (order.status === "pending") acc.pending += 1;
        if (order.status === "cancelled") acc.cancelled += 1;
        return acc;
      },
      { total: 0, revenue: 0, completed: 0, pending: 0, cancelled: 0 },
    );
  }, [filteredOrders]);

  const paymentOptions = useMemo(
    () => ["all", ...new Set(ORDER_ROWS.map((order) => order.paymentMethod))],
    [],
  );

  return (
    <section className="space-y-6" dir="ltr">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-900 via-[#2459c7] to-[#38bdf8] p-6 text-slate-50 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-slate-100/85">Admin Orders</p>
            <h1 className="mt-3 text-3xl font-extrabold text-white">{t("pages.orders.title")}</h1>
            <p className="mt-2 max-w-2xl text-sm font-normal leading-7 text-slate-100/85">
              Track course purchases by payment method, region, and completion status from one clean view.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium text-slate-100">
            {filteredOrders.length} visible orders
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={ShoppingCart} title="Orders" value={summary.total} note="Visible in current filter" tone="bg-blue-50 text-blue-700" />
        <SummaryCard icon={DollarSign} title="Revenue" value={`$${formatMoney(summary.revenue)}`} note="Base USD order value" tone="bg-emerald-50 text-emerald-700" />
        <SummaryCard icon={CheckCircle2} title="Completed" value={summary.completed} note="Successfully paid orders" tone="bg-violet-50 text-violet-700" />
        <SummaryCard icon={Clock3} title="Pending / Cancelled" value={`${summary.pending} / ${summary.cancelled}`} note="Needs follow-up or was stopped" tone="bg-amber-50 text-amber-700" />
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_220px_220px]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search order ID, student, course, payment method..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
          >
            {paymentOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All payment methods" : option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-extrabold text-slate-800">Order list</h2>
          <p className="mt-1 text-sm font-normal text-slate-500">Real order data will appear here when the backend is connected.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-700">Order</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700">Student</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700">Courses</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700">Payment</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700">Region</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700">Amount</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No orders matched the current filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const meta = statusMeta[order.status] || statusMeta.pending;
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                            <Receipt size={18} />
                          </span>
                          <div>
                            <p className="font-extrabold text-slate-800">{order.id}</p>
                            <p className="text-xs font-medium text-slate-500">{order.courses.length} course(s)</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-extrabold text-slate-800">{order.studentName}</p>
                        <p className="text-xs font-medium text-slate-500">{order.studentEmail}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        <div className="space-y-1">
                          {order.courses.map((course) => (
                            <p key={course} className="font-medium">{course}</p>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                          <CreditCard size={14} />
                          {order.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-700">{order.region}</td>
                      <td className="px-4 py-4 font-extrabold text-slate-800">${formatMoney(order.amountUsd)}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-slate-500">
                        <div className="flex items-center gap-2">
                          <CalendarDays size={14} />
                          {formatDate(order.createdAt)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
