import Header from "./Header";
import LeftMenu from "./LeftMenu";
import RightPanel from "./RightPanel";
import BottomConsole from "./BottomConsole";
import Toaster from "./Toaster";
import Viewport from "@/features/viewport/Viewport";
import { useNotificationWS } from "@/hooks/useNotificationWS";

export default function AppShell() {
  useNotificationWS();
  return (
    <div className="grid h-full grid-rows-[48px_1fr_160px] grid-cols-[200px_1fr_280px] bg-arc-bg text-slate-800 dark:text-slate-100">
      <header className="col-span-3 row-start-1 row-end-2 border-b border-slate-200 bg-arc-panel dark:border-slate-700">
        <Header />
      </header>

      <aside className="row-start-2 row-end-3 col-start-1 col-end-2 border-r border-slate-200 bg-arc-panel/60 dark:border-slate-700">
        <LeftMenu />
      </aside>

      <main className="row-start-2 row-end-3 col-start-2 col-end-3 relative">
        <Viewport />
      </main>

      <aside className="row-start-2 row-end-3 col-start-3 col-end-4 border-l border-slate-200 bg-arc-panel/60 dark:border-slate-700">
        <RightPanel />
      </aside>

      <footer className="col-span-3 row-start-3 row-end-4 border-t border-slate-200 bg-arc-panel/80 dark:border-slate-700">
        <BottomConsole />
      </footer>

      <Toaster />
    </div>
  );
}
