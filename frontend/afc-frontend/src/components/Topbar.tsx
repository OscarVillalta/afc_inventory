import { Link, useLocation } from "react-router-dom";

export default function Topbar() {
  const { pathname } = useLocation();

  type Breadcrumb = { label: string; to?: string };

  const breadcrumbs = (() => {
    const segments = pathname.split("/").filter(Boolean);

    if (segments.length === 0) return [{ label: "Dashboard" }] as Breadcrumb[];

    // Orders
    if (segments[0] === "orders") {
      // "/orders/search" is the listing page; any other second segment is a detail id
      if (segments[1] && segments[1] !== "search") {
        return [
          { label: "Orders", to: "/orders/search" },
          { label: segments[1] },
        ] as Breadcrumb[];
      }
      return [{ label: "Orders", to: "/orders/search" }] as Breadcrumb[];
    }

    // Inventory + product detail paths
    if (["inventory", "products", "child-products"].includes(segments[0])) {
      const crumbs: Breadcrumb[] = [{ label: "Inventory", to: "/inventory" }];
      if (segments[1]) crumbs.push({ label: segments[1] });
      if (segments[2]) crumbs.push({ label: segments[2] });
      return crumbs;
    }

    // Fallback: generic breadcrumbs with cumulative links
    return segments.map((seg, idx) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1),
      to: idx < segments.length - 1
        ? "/" + segments.slice(0, idx + 1).join("/")
        : undefined,
    }));
  })();

  return (
    <div className="w-full flex items-center justify-between px-6 py-3 bg-base-200 shadow-sm">
      
      {/* LEFT SIDE - BREADCRUMBS */}
      <div className="flex items-center gap-2 text-sm font-medium text-[#7B809A]">
        {breadcrumbs.map((crumb, idx) => (
          <span key={idx} className="flex items-center gap-2">
            {idx > 0 && <span>/</span>}
            {crumb.to ? (
              <Link to={crumb.to} className="text-[#344767] hover:text-blue-600">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-[#344767]">{crumb.label}</span>
            )}
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
