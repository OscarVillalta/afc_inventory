import React, { useState } from "react";
import MDTable from "../table/MDtable";

export default function OrdersTable() {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // === FILTER STATES (UI only — NOT used for filtering) ===
  const [searchOrder, setSearchOrder] = useState("");
  const [searchDescription, setSearchDescription] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCustomer, setFilterCustomer] = useState("All");

  // TEMP FAKE DATA
  const rows = [
    {
      order: "100028",
      type: "Outgoing",
      cs: "MediHealth",
      description: "Filter replenishment order",
      status: "Pending",
    },
    {
      order: "100027",
      type: "Outgoing",
      cs: "ClearSky Industries",
      description: "Quarterly filter shipment",
      status: "Completed",
    },
    {
      order: "100026",
      type: "Incoming",
      cs: "UrbanCare",
      description: "Routine order",
      status: "Partially Fulfilled",
    },
  ];

  // Options (static for now — API will replace them later)
  const uniqueTypes = ["All", ...new Set(rows.map((r) => r.type))];
  const uniqueStatuses = ["All", ...new Set(rows.map((r) => r.status))];
  const uniqueCustomers = ["All", ...new Set(rows.map((r) => r.cs))];

  // Total rows — no filtering applied
  const total = rows.length;

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

        {/* ORDER SEARCH */}
        <th className="pr-4 pb-2 w-32">
          <input
            type="text"
            placeholder="Search..."
            className="input input-bordered input-xs w-full"
            value={searchOrder}
            onChange={(e) => setSearchOrder(e.target.value)}
          />
        </th>

        {/* TYPE DROPDOWN */}
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

        {/* CUSTOMER DROPDOWN */}
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

        {/* DESCRIPTION SEARCH */}
        <th className="px-2 pb-2">
          <input
            type="text"
            placeholder="Search..."
            className="input input-bordered input-xs w-full"
            value={searchDescription}
            onChange={(e) => setSearchDescription(e.target.value)}
          />
        </th>

        {/* STATUS DROPDOWN */}
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

        {/* DATES (EMPTY FOR NOW) */}
        <th></th>
        <th></th>

        {/* EDIT COLUMN */}
        <th></th>
      </tr>

      {/* ================================================
          TABLE ROWS (unfiltered — API will replace)
       ================================================= */}
      {rows.map((row, index) => (
        <tr key={index} className="bg-white shadow-sm rounded-xl">
          <td className="py-3 px-2 font-semibold">{row.order}</td>

          {/* TYPE WITH ICON */}
          <td className="py-3 px-1 flex items-center gap-x-3">
            {row.type === "Outgoing" ? (
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

          <td className="py-3 px-2">{row.cs}</td>
          <td className="py-3 px-2">{row.description}</td>

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

          <td className="py-3 px-2 text-gray-400 italic">—</td>
          <td className="py-3 px-2 text-gray-400 italic">—</td>

          <td className="py-3 px-2 cursor-pointer hover:scale-110 transition">
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
    </MDTable>
  );
}
