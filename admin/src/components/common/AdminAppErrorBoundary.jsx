import { Component } from "react";

const removeBootLoader = () => {
  if (typeof document === "undefined") return;
  document.body?.classList.add("app-ready");
  document.getElementById("app-boot-loader")?.remove();
};

const reloadLatestAdminBuild = () => {
  const url = new URL(window.location.href);
  url.searchParams.set("_refresh", String(Date.now()));
  window.location.replace(url.toString());
};

export default class AdminAppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    removeBootLoader();
    console.error("Admin application render failed", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const isFa =
      typeof document !== "undefined" && document.documentElement.lang === "fa";

    return (
      <main
        className="grid min-h-[100dvh] place-items-center bg-slate-50 p-4 font-sans"
        dir={isFa ? "rtl" : "ltr"}
      >
        <section className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-7 text-center shadow-xl shadow-slate-200/60">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-2xl font-black text-rose-600">
            !
          </div>
          <h1 className="mt-5 text-xl font-black text-slate-950">
            {isFa
              ? "پنل مدیریت به‌درستی بارگذاری نشد"
              : "The admin panel could not load"}
          </h1>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
            {isFa
              ? "ممکن است فایل‌های نسخه قبلی در مرورگر ذخیره شده باشند. صفحه را دوباره بارگذاری کنید."
              : "Your browser may still have files from an older deployment. Reload the page to get the latest version."}
          </p>
          <button
            type="button"
            onClick={reloadLatestAdminBuild}
            className="mt-6 min-h-11 rounded-xl bg-slate-950 px-6 text-sm font-black text-white transition hover:bg-slate-800"
          >
            {isFa ? "بارگذاری دوباره" : "Reload page"}
          </button>
        </section>
      </main>
    );
  }
}
