import React, { useEffect, useState } from "react";
import MDTable from "../../table/MDtable";
import type {
  OrderRowItemPayload,
} from "../../../api/ordersTable";
import { fetchOrders } from "../../../api/ordersTable"
import { useNavigate } from 'react-router-dom'

function formatUTCDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { timeZone: "UTC" });
}

interface Props {
  reloadKey: number;
}

export default function OrdersTable({ reloadKey }: Props) {
  const navigate = useNavigate()
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // === FILTER STATES (UI only — NOT used for filtering yet) ===
  const [searchOrder, setSearchOrder] = useState("");
  const [searchDescription, setSearchDescription] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCustomer, setFilterCustomer] = useState("All");

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
  const uniqueTypes = ["All", ...new Set(rows.map((r) => r.type))];
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
          FILTER CONTROLS (UI only — not applied yet)
       ================================================= */}
      <tr className="border-b">
        <th className="pr-4 pb-2 w-32">
          <input
            type="text"
            placeholder="Search..."
            className="input input-bordered input-xs w-full"
            value={searchOrder}
            onChange={(e) => setSearchOrder(e.target.value)}
          />
        </th>

        <th className="px-2 pb-2">
          <select
            className="select select-bordered select-xs w-full"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            {uniqueTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </th>

        <th className="px-2 pb-2">
          <select
            className="select select-bordered select-xs w-full"
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
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
            value={searchDescription}
            onChange={(e) => setSearchDescription(e.target.value)}
          />
        </th>

        <th className="px-2 pb-2 w-40">
          <select
            className="select select-bordered select-xs w-full"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
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
      {(rows ?? []).map((row) => (
        <tr
          key={row.id}
          className="bg-white shadow-sm rounded-xl cursor-pointer hover:bg-slate-50"
          onClick={() => navigate(`/orders/${row.id}`)}
        >
          <td className="py-3 px-2 font-semibold">{row.id}</td>

          {/* TYPE WITH ICON */}
          <td className="py-3 px-1 flex items-center gap-x-3">
            {row.type === "outgoing" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                className="mt-0.5"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M1.5 12C1.5 6.20101 6.20101 1.5 12 1.5C17.799 1.5 22.5 6.20101 22.5 12C22.5 17.799 17.799 22.5 12 22.5C6.20101 22.5 1.5 17.799 1.5 12ZM8.25 11.25C7.83579 11.25 7.5 11.5858 7.5 12C7.5 12.4142 7.83579 12.75 8.25 12.75H15.75C16.1642 12.75 16.5 12.4142 16.5 12C16.5 11.5858 16.1642 11.25 15.75 11.25H8.25Z"
                  fill="#BF1A1A"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 1024 1024"
                className="mt-0.5"
              >
                <path
                  d="M512 512m-448 0a448 448 0 1 0 896 0 448 448 0 1 0-896 0Z"
                  fill="#4CAF50"
                />
                <path d="M448 298.7h128V725.3H448z" fill="#FFFFFF" />
                <path d="M298.7 448h426.6v128H298.7z" fill="#FFFFFF" />
              </svg>
            )}
            {row.type}
          </td>

          <td className="py-3 px-2 max-w-8">{row.cs_name}</td>
          <td className="py-3 px-2 truncate text-ellipsis max-w-16">{row.description}</td>

          <td className="py-3 px-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                row.status === "Completed"
                  ? "bg-green-100 text-green-700"
                  : row.status?.includes("Partial")
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
      ))}

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
