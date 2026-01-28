import { Link, useLocation } from "react-router-dom";

export default function Topbar() {
  const { pathname } = useLocation();

  // Turn "/products" → ["Products"]
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  return (
    <div className="w-full flex items-center justify-between px-6 py-3 bg-base-200 shadow-sm">
      
      {/* LEFT SIDE - BREADCRUMBS */}
      <div className="flex items-center gap-2 text-sm font-medium text-[#7B809A]">
        {segments.length === 0 && <span>Dashboard</span>}

        {segments.map((seg, idx) => (
          <span key={idx} className="flex items-center gap-2">
            {idx > 0 && <span>/</span>}
            <span className="text-[#344767]">{seg}</span>
          </span>
        ))}
      </div>

      {/* RIGHT SIDE - SEARCH & ICONS */}
      <div className="flex items-center gap-4">
        
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search here"
            className="input input-sm bg-white rounded-lg pl-10 pr-3 shadow-sm focus:outline-none w-52"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral/50 text-sm">
            🔍
          </span>
        </div>

        {/* Icons */}
        <button className="btn btn-sm btn-circle bg-white shadow-sm">
          ⚙️
        </button>

        <button className="btn btn-sm btn-circle bg-white shadow-sm">
          🔔
        </button>

        <div className="avatar">
          <div className="w-8 h-8 rounded-full shadow bg-neutral text-neutral-content text-xs flex items-center justify-center">
            U
          </div>
        </div>
      </div>
    </div>
  );
}
