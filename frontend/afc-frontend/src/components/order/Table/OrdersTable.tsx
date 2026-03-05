import { useEffect, useState } from "react";
import MDTable from "../../table/MDtable";
import type {
  OrderRowItemPayload,
} from "../../../api/ordersTable";
import { fetchOrders } from "../../../api/ordersTable"
import { useNavigate } from 'react-router-dom'
import { usePersistedFilters } from "../../../hooks/usePersistedFilters";
import { ALL_ORDER_TYPES, ORDER_TYPE_LABELS } from "../../../constants/orderTypes";

function formatUTCDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { timeZone: "UTC" });
}

/** Color classes for type badges in the table rows */
const TYPE_ROW_COLORS: Record<string, { dot: string; text: string }> = {
  incoming:     { dot: "bg-green-500",  text: "text-green-700" },
  installation: { dot: "bg-blue-500",   text: "text-blue-700"  },
  will_call:    { dot: "bg-purple-500", text: "text-purple-700"},
  delivery:     { dot: "bg-teal-500",   text: "text-teal-700"  },
  shipment:     { dot: "bg-cyan-500",   text: "text-cyan-700"  },
  // legacy
  outgoing:     { dot: "bg-red-500",    text: "text-red-700"   },
};

interface Props {
  reloadKey: number;
}

export default function OrdersTable({ reloadKey }: Props) {
  const navigate = useNavigate()
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // === FILTER STATES (PERSISTED) ===
  const [filters, setFilter] = usePersistedFilters("filters_orders", {
    searchOrder: "",
    searchDescription: "",
    filterType: "All",
    filterStatus: "All",
    filterCustomer: "All",
  });

  // === API STATE ===
  const [rows, setRows] = useState<OrderRowItemPayload[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  

  // === FETCH ORDERS ===
  useEffect(() => {
    setLoading(true);

    fetchOrders(page, pageSize)
      .then((res) => {
        setRows(res.results ?? []);
        setTotal(res.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, reloadKey]);

  // Options (derived from API data — still UI-only)
  const uniqueStatuses = ["All", ...new Set(rows.map((r) => r.status))];
  const uniqueCustomers = ["All", ...new Set(rows.map((r) => r.cs_name))];

  return (
    <MDTable
      title="All Orders"
      columns={[
        "Order",
        "Type",
        "Customer / Supplier",
        "Description",
        "Status",
        "Creation Date",
        "Completion Date",
        "Edit",
      ]}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={setPage}
    >
      {/* ================================================
          FILTER CONTROLS
       ================================================= */}
      <tr className="border-b">
        <th className="pr-4 pb-2 w-32">
          <input
            type="text"
            placeholder="Search..."
            className="input input-bordered input-xs w-full"
            value={filters.searchOrder}
            onChange={(e) => setFilter("searchOrder", e.target.value)}
          />
        </th>

        <th className="px-2 pb-2">
          <select
            className="select select-bordered select-xs w-full"
            value={filters.filterType}
            onChange={(e) => setFilter("filterType", e.target.value)}
          >
            <option value="All">All</option>
            {ALL_ORDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {ORDER_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </th>

        <th className="px-2 pb-2">
          <select
            className="select select-bordered select-xs w-full"
            value={filters.filterCustomer}
            onChange={(e) => setFilter("filterCustomer", e.target.value)}
          >
            {uniqueCustomers.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </th>

        <th className="px-2 pb-2">
          <input
            type="text"
            placeholder="Search..."
            className="input input-bordered input-xs w-full"
            value={filters.searchDescription}
            onChange={(e) => setFilter("searchDescription", e.target.value)}
          />
        </th>

        <th className="px-2 pb-2 w-40">
          <select
            className="select select-bordered select-xs w-full"
            value={filters.filterStatus}
            onChange={(e) => setFilter("filterStatus", e.target.value)}
          >
            {uniqueStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </th>

        <th></th>
        <th></th>
        <th></th>
      </tr>

      {/* ================================================
          TABLE ROWS (API-backed)
       ================================================= */}
      {(rows ?? []).map((row) => {
        const typeColors = TYPE_ROW_COLORS[row.type] ?? TYPE_ROW_COLORS["outgoing"];
        const typeLabel = ORDER_TYPE_LABELS[row.type as keyof typeof ORDER_TYPE_LABELS] ?? row.type;

        return (
          <tr
            key={row.id}
            className="bg-white shadow-sm rounded-xl cursor-pointer hover:bg-slate-50"
            onClick={() => navigate(`/orders/${row.id}`)}
          >
            <td className="py-3 px-2 font-semibold">{row.id}</td>

            {/* TYPE WITH COLOR DOT */}
            <td className="py-3 px-1">
              <span className="flex items-center gap-x-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${typeColors.dot}`} />
                <span className={`text-sm font-medium ${typeColors.text}`}>{typeLabel}</span>
              </span>
            </td>

            <td className="py-3 px-2 max-w-8">{row.cs_name}</td>
            <td className="py-3 px-2 truncate text-ellipsis max-w-16">{row.description}</td>

            <td className="py-3 px-2">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  row.status === "Completed"
                    ? "bg-green-100 text-green-700"
                    : row.status.includes("Partial")
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {row.status}
              </span>
            </td>

            <td className="py-3 px-2 text-gray-500">
              {row.created_at
                ? formatUTCDate(row.created_at)
                : "—"}
            </td>

            <td className="py-3 px-2 text-gray-500">
              {row.completed_at
                ? new Date(row.completed_at).toLocaleDateString()
                : "—"}
            </td>

            <td
              className="py-3 px-2 cursor-pointer hover:scale-110 transition"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/orders/${row.id}`);
              }}
            >
              {/* edit icon unchanged */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="25"
                viewBox="0 0 48 48"
                fill="none"
              >
                <rect width="48" height="48" fill="white" fillOpacity="0.01" />
                <path
                  d="M29 4H9C7.9 4 7 4.9 7 6V42C7 43.1 7.9 44 9 44H37C38.1 44 39 43.1 39 42V20"
                  stroke="#000"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M13 18H21" stroke="#000" strokeWidth="4" strokeLinecap="round" />
                <path d="M13 28H25" stroke="#000" strokeWidth="4" strokeLinecap="round" />
                <path
                  d="M41 6L29 18"
                  stroke="#000"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </td>
          </tr>
        );
      })}

      {loading && (
        <tr>
          <td colSpan={8} className="text-center py-6 text-gray-400">
            Loading orders…
          </td>
        </tr>
      )}
    </MDTable>
  );
}
