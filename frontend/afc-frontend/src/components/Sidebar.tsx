import { Link, useLocation } from "react-router-dom";

export default function Sidebar() {
  const { pathname } = useLocation();

  const links = [
    { name: "Dashboard", to: "/dashboard", icon: "📊" },
    { name: "Inventory", to: "/inventory", icon: "📦" },
    { name: "order", to: "/order", icon: "🧾" },
    { name: "Transactions", to: "/transactions", icon: "💱" },
  ];

  return (
    <aside
      className="w-64 flex flex-col"
      style={{
        background: "linear-gradient(180deg, #3A3F51 0%, #1A1D29 100%)",
        borderRadius: "1rem",
        margin: "1.5rem 1.5rem",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 text-white text-lg font-bold px-2 py-4 mb-2">
        <span className="text-2xl">Ⓐ</span>
        <span>AFC Inventory System</span>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10 mb-4"></div>

      {/* Navigation */}
      <nav className="flex flex-col gap-2 mt-2">
        {links.map((link) => {
          const isActive = pathname === link.to;

          return (
            <Link
              key={link.to}
              to={link.to}
              className={`
                flex items-center gap-4 px-4 py-3 rounded-lg text-sm font-medium 
                transition-all duration-200 select-none
                ${
                  isActive
                    ? "bg-[#3A7BD5] text-white shadow-lg"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              <span className="text-[1.1rem] opacity-90">{link.icon}</span>
              <span className="tracking-wide">{link.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
