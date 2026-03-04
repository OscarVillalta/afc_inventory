import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

interface Props {
  children: React.ReactNode;
}

export default function MainLayout({ children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div data-theme="corporate" className="flex h-screen w-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (full height) — hidden on mobile, toggled via overlay */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 bg-base-200 overflow-hidden min-w-0">
        <Topbar onMenuToggle={() => setSidebarOpen((o) => !o)} />

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
