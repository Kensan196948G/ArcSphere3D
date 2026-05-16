import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import "@/styles/index.css";
import { useThemeStore } from "@/state/themeStore";

// html 要素に dark クラスを付与してテーマを適用
function applyTheme(theme: string) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
applyTheme(useThemeStore.getState().theme);
useThemeStore.subscribe((s) => applyTheme(s.theme));

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root not found in index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
