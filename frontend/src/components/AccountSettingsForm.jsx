import { useState } from "react";
import { User, Camera } from "lucide-react";

export default function AccountSettingsForm({ data }) {
  const [formData, setFormData] = useState({
    firstName: data.firstNameFa || "",
    lastName: data.lastNameFa || "",
    email: data.email || "",
    phone: data.phone || "",
    birthDate: data.birthDate || "",
    gender: data.gender || "",
    country: data.country || "",
    city: data.city || "",
    bio: data.bio || "",
  });
  const [toastMsg, setToastMsg] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setToastMsg("تنظیمات حساب با موفقیت ذخیره شد");
    setTimeout(() => setToastMsg(""), 3000);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-primary-600">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">اطلاعات حساب</h2>
            <p className="text-sm font-medium text-slate-500">
              اطلاعات شخصی خود را به‌روزرسانی کنید.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-8 flex items-center gap-6">
          <div className="relative">
            <img
              src={data.avatar}
              alt="Avatar"
              className="h-24 w-24 rounded-full object-cover border-4 border-slate-50"
            />
            <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white shadow-md hover:bg-primary-700 transition">
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-600">
              حداکثر 2MB
              <br />
              JPG, PNG
            </span>
            <button className="text-sm font-bold text-primary-600 hover:text-primary-700 w-fit">
              تغییر عکس
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">نام</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 transition"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">
                نام خانوادگی
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 transition"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">ایمیل</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 transition text-left"
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">
                شماره موبایل
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 transition text-left"
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">
                تاریخ تولد
              </label>
              <input
                type="text"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 transition"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">جنسیت</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 transition"
              >
                <option value="مرد">مرد</option>
                <option value="زن">زن</option>
                <option value="دیگر">دیگر</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">کشور</label>
              <select
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 transition"
              >
                <option value="افغانستان">افغانستان</option>
                <option value="ایران">ایران</option>
                <option value="تاجیکستان">تاجیکستان</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">شهر</label>
              <select
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 transition"
              >
                <option value="کابل">کابل</option>
                <option value="هرات">هرات</option>
                <option value="مزار شریف">مزار شریف</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">
              درباره من
            </label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              rows="4"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 transition"
            ></textarea>
          </div>

          <div className="pt-4 flex items-center justify-between flex-wrap gap-4">
            {toastMsg && (
              <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                {toastMsg}
              </span>
            )}
            <div className="flex-1"></div>
            <button
              type="submit"
              className="w-full md:w-auto rounded-xl bg-gradient-to-r from-primary-600 to-blue-500 px-8 py-3.5 text-sm font-black text-white shadow-lg shadow-primary-500/30 transition hover:-translate-y-0.5 hover:shadow-primary-500/40"
            >
              ذخیره تغییرات
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
