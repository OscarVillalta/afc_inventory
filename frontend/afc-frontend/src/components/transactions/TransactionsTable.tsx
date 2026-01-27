import { useState } from "react";
import MDTable from "../table/MDtable";

interface TransactionRow {
  id: string;
  product: string;
  type: "Incoming" | "Outgoing" | "Adjustment";
  qty: number;
  source: string;      // vendor or customer
  date: string;        // formatted date
}

export default function TransactionsTable() {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // === FILTER STATES (UI only for now) ===
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");

  // Fake data for now
  const rows: TransactionRow[] = [
    { id: "T1001", product: "FGP-12x24x2", type: "Incoming", qty: 120, source: "Camfil", date: "2024-04-02" },
    { id: "T1002", product: "M13 V-Bank", type: "Outgoing", qty: 20, source: "MediHealth", date: "2024-04-01" },
    { id: "T1003", product: "HEPA-24x24x12", type: "Adjustment", qty: -2, source: "Inventory Correction", date: "2024-03-29" },
  ];

  const uniqueTypes = ["All", "Incoming", "Outgoing", "Adjustment"];

  const total = rows.length;

  return (
    <MDTable
      title="Transactions Ledger"
      columns={[
        "ID",
        "Product",
        "Type",
        "Quantity",
        "Source",
        "Date",
      ]}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={setPage}
    >
      {/* FILTER BAR */}
      <tr className="border-b">
        <th className="p-2">
          <input
            className="input input-bordered input-xs w-full"
            placeholder="Search ID / Product"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </th>

        <th></th>

        <th className="p-2">
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

        <th></th>
        <th></th>
        <th></th>
      </tr>

      {/* TABLE ROWS */}
      {rows.map((row) => (
        <tr key={row.id} className="bg-white shadow-sm rounded-xl">
          <td className="py-3 px-2 font-semibold">{row.id}</td>
          <td className="py-3 px-2">{row.product}</td>

          {/* Type badge */}
          <td className="py-3 px-2">
            <span
              className={`
                px-3 py-1 rounded-full text-xs font-medium
                ${
                  row.type === "Incoming"
                    ? "bg-green-100 text-green-700"
                    : row.type === "Outgoing"
                    ? "bg-red-100 text-red-700"
                    : "bg-blue-100 text-blue-700"
                }
              `}
            >
              {row.type}
            </span>
          </td>

          <td className="py-3 px-2">{row.qty}</td>
          <td className="py-3 px-2">{row.source}</td>
          <td className="py-3 px-2 text-gray-500">{row.date}</td>
        </tr>
      ))}
    </MDTable>
  );
}
