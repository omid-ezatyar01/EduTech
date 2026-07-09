import { X, Lock, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { changeCurrentUserPassword } from "../../services/authService";

export default function AccountSecurityModal({
  isOpen,
  onClose,
  onSave,
  onSuccess,
  language = "fa",
}) {
  const isFa = language === "fa";
  const t = {
    required: isFa
      ? "تمام فیلدهای رمز عبور الزامی است."
      : "All password fields are required.",
    minLength: isFa
      ? "رمز عبور باید حداقل 6 کاراکتر باشد."
      : "Password must be at least 6 characters.",
    mismatch: isFa
      ? "رمز عبور جدید و تایید آن مطابقت ندارند."
      : "New password and confirmation do not match.",
    success: isFa
      ? "رمز عبور شما با موفقیت تغییر کرد. از این پس برای ورود از رمز عبور جدید استفاده کنید."
      : "Your password was changed successfully. Use the new password for future logins.",
    currentWrong: isFa
      ? "رمز عبور فعلی نادرست است."
      : "Current password is incorrect.",
    genericError: isFa
      ? "تغییر رمز عبور انجام نشد. لطفاً دوباره تلاش کنید."
      : "Password change failed. Please try again.",
    title: isFa ? "مدیریت امنیت حساب" : "Manage Account Security",
    changePassword: isFa ? "تغییر رمز عبور" : "Change Password",
    currentPassword: isFa ? "رمز عبور فعلی" : "Current Password",
    newPassword: isFa ? "رمز عبور جدید" : "New Password",
    confirmPassword: isFa ? "تایید رمز عبور جدید" : "Confirm New Password",
    saving: isFa ? "در حال ذخیره" : "Saving",
    save: isFa ? "ذخیره امنیت حساب" : "Save Security Settings",
  };

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleShow = (field) => {
    setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback({ type: "", text: "" });

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setFeedback({ type: "error", text: t.required });
      return;
    }
    if (form.newPassword.length < 6) {
      setFeedback({ type: "error", text: t.minLength });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setFeedback({ type: "error", text: t.mismatch });
      return;
    }

    try {
      setIsSubmitting(true);
      await changeCurrentUserPassword(form);
      onSave?.({ lastUpdatedAt: new Date().toISOString() });
      setForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      onClose?.();
      onSuccess?.(
        t.success,
      );
    } catch (error) {
      const rawMessage = String(
        error?.response?.data?.message || error?.message || "",
      ).toLowerCase();
      if (rawMessage.includes("current password is incorrect")) {
        setFeedback({
          type: "error",
          text: t.currentWrong,
        });
      } else if (rawMessage.includes("new password and confirmation do not match")) {
        setFeedback({
          type: "error",
          text: t.mismatch,
        });
      } else if (rawMessage.includes("at least 6")) {
        setFeedback({
          type: "error",
          text: t.minLength,
        });
      } else {
        setFeedback({
          type: "error",
          text: t.genericError,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      dir={isFa ? "rtl" : "ltr"}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <h2 className="text-xl font-black text-slate-900">
            {t.title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          className="overflow-y-auto p-6 space-y-5 flex-1"
          onSubmit={handleSubmit}
        >
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-slate-900">
              <Lock className="h-4 w-4 text-primary-500" />
              {t.changePassword}
            </h3>
            <div className="space-y-4">
              {[
                { key: "currentPassword", label: t.currentPassword },
                { key: "newPassword", label: t.newPassword },
                { key: "confirmPassword", label: t.confirmPassword },
              ].map((field) => (
                <div key={field.key}>
                  <label className="mb-2 block text-right text-xs font-bold text-slate-700">
                    {field.label}
                  </label>
                  <div className="relative flex items-center">
                    <Lock size={18} className="absolute start-4 text-slate-400" />
                    <input
                      type={showPassword[field.key] ? "text" : "password"}
                      value={form[field.key]}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          [field.key]: event.target.value,
                        }))
                      }
                      placeholder="••••••••••"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pe-12 ps-11 text-sm font-semibold outline-none transition focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShow(field.key)}
                      className="absolute end-4 text-slate-400 transition hover:text-slate-600"
                    >
                      {showPassword[field.key] ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {feedback.text ? (
            <div
              className={`rounded-xl px-4 py-3 text-sm font-bold ${
                feedback.type === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {feedback.text}
            </div>
          ) : null}

          <div className="border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-primary-600 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? t.saving : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
