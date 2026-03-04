import { Link, useLocation } from "react-router-dom";

export default function Sidebar() {
  const { pathname } = useLocation();

  const links = [
    { name: "Dashboard", to: "/", icon: "📊" },
    { name: "Inventory", to: "/inventory", icon: "📦" },
    { name: "Orders", to: "/orders/search", icon: "🧾" },
    { name: "Transactions", to: "/transactions", icon: "💱" },
    { name: "Conversions", to: "/conversions", icon: "🔄" },
    { name: "Packing Slips", to: "/packing-slip-tracker", icon: "📋" },
  ];

  return (
    <aside
      className="
        w-64 h-screen       /* full-height */
        flex flex-col
        bg-gradient-to-b from-[#3A3F51] to-[#1A1D29]
        text-white
        shadow-xl
      "
    >
      {/* Logo */}
      <div className="flex gap-3 text-xl font-bold px-4 py-6 items-center">
        <span>AFC Inventory System</span>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10 mb-4"></div>

      {/* Links */}
      <nav className="flex flex-col gap-1 px-2">
        {links.map((link) => {
          const isActive = pathname === link.to;

          return (
            <Link
              key={link.to}
              to={link.to}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg
                transition-all duration-200
                ${
                  isActive
                    ? "bg-[#3A7BD5] text-white shadow-md"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              <span className="text-xl">{link.icon}</span>
              <span>{link.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Spacer to push footer down */}
      <div className="flex-1"></div>

      {/* Bottom section (optional) */}
      <div className="px-4 py-4 text-gray-400 text-sm border-t border-white/10">
        © 2025 AFC
      </div>
    </aside>
  );
}
