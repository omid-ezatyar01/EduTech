import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import App from "./App.jsx";
import { getLocalizedBasename } from "./utils/localizedRoutes.js";

const basename = getLocalizedBasename(window.location.pathname);

createRoot(document.getElementById("root")).render(
  <BrowserRouter basename={basename}>
    <App />
  </BrowserRouter>,
);
