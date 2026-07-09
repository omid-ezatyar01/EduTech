import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { AdminI18nProvider, getInitialAdminLanguage, readStoredAdminLanguage } from "./i18n/AdminI18nContext.jsx";
import { installAdminFetchGuards } from "../services/http.js";

try {
  const lang = readStoredAdminLanguage() || getInitialAdminLanguage() || "fa";
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  document.documentElement.setAttribute("data-admin-lang", lang);
  document.documentElement.setAttribute("translate", "no");
  document.documentElement.classList.add("notranslate");
  if (document.body) {
    document.body.lang = lang;
    document.body.dir = lang === "fa" ? "rtl" : "ltr";
    document.body.setAttribute("translate", "no");
    document.body.classList.add("notranslate");
  }
} catch {
  document.documentElement.lang = "fa";
  document.documentElement.dir = "rtl";
  document.documentElement.setAttribute("data-admin-lang", "fa");
  document.documentElement.setAttribute("translate", "no");
  document.documentElement.classList.add("notranslate");
  if (document.body) {
    document.body.lang = "fa";
    document.body.dir = "rtl";
    document.body.setAttribute("translate", "no");
    document.body.classList.add("notranslate");
  }
}

installAdminFetchGuards();

ReactDOM.createRoot(document.getElementById("root")).render(
  <AdminI18nProvider>
    <App />
  </AdminI18nProvider>,
);
