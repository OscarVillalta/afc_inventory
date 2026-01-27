import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

interface Props {
  children: React.ReactNode;
}

export default function MainLayout({ children }: Props) {
  return (
    <div data-theme="corporate" className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar (full height) */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 bg-base-200 overflow-hidden">
        <Topbar />

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
