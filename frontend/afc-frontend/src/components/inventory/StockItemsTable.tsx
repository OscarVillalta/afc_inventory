import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import MDTable from "../table/MDtable";
import { fetchStockItems } from "../../api/stockItems";
import type { StockItemResponse, StockItemPayload } from "../../api/stockItems";
import { autocommitTxn } from "../../api/transactions";
import type { createTxnRequest } from "../../api/transactions";
import { usePersistedFilters } from "../../hooks/usePersistedFilters";

/* ============================================================
   QUICK FILTER PRESETS
============================================================ */

type QuickView = "all" | "low_stock" | "backordered" | "has_orders";

/* ============================================================
   COLUMN VISIBILITY DEFAULTS
============================================================ */

const ALL_COLUMNS = ["Name", "Description", "Category", "Supplier", "Stock"] as const;
type ColumnKey = typeof ALL_COLUMNS[number];
const DEFAULT_VISIBLE: Record<ColumnKey, boolean> = {
  Name: true,
  Description: true,
  Category: true,
  Supplier: true,
  Stock: true,
};

/* ============================================================
   TYPES
============================================================ */

interface EditFormState {
  id: number;
  name: string;
  product_id: number;
  supplier_name: string;
  description: string | null;
  on_hand: number;
  ordered: number;
  reserved: number;
}

/* ============================================================
   COMPONENT
============================================================ */

export default function StockItemsTable({ refreshToken }: { refreshToken?: number }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [data, setData] = useState<StockItemResponse>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ===================== FILTER STATE (PERSISTED) ===================== */
  const [filters, setFilter] = usePersistedFilters("filters_stockitems", {
    searchName: "",
    filterDescription: "",
    filterSupplier: "",
    filterCategory: "",
  });

  /* ===================== QUICK VIEW ===================== */
  const [activeView, setActiveView] = useState<QuickView>("all");

  /* ===================== COLUMN VISIBILITY & DENSITY ===================== */
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({ ...DEFAULT_VISIBLE });
  const [compact, setCompact] = useState(false);
  const [showColMenu, setShowColMenu] = useState(false);

  const toggleCol = (col: ColumnKey) =>
    setVisibleCols((prev) => ({ ...prev, [col]: !prev[col] }));

  const resetView = () => {
    setVisibleCols({ ...DEFAULT_VISIBLE });
    setCompact(false);
  };

  const isColVisible = useCallback((col: ColumnKey) => visibleCols[col], [visibleCols]);

  const rowPadding = compact ? "py-1" : "py-3";

  /* ===================== EDIT MODAL ===================== */
  const [openEdit, setOpenEdit] = useState(false);
  const [editRow, setEditRow] = useState<EditFormState | null>(null);
  const [originalOnHand, setOriginalOnHand] = useState(0);

  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const REASONS = ["shipment", "receive", "adjustment", "rollback"];

  /* ===================== LOAD DATA (SERVER-SIDE FILTERING) ===================== */

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    fetchStockItems(page, pageSize, {
        name: filters.searchName || undefined,
        description: filters.filterDescription || undefined,
        supplier: filters.filterSupplier || undefined,
        category: filters.filterCategory || undefined,
      })
      .then((res) => {
        setData(res);
      })
      .catch(() => setError("Failed to load stock items"))
      .finally(() => setLoading(false));
  }, [page, pageSize, filters.searchName, filters.filterDescription, filters.filterSupplier, filters.filterCategory]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshToken]);

  const rows: StockItemPayload[] = data?.results ?? [];

  /* ---------- client-side quick-view filter ---------- */
  const filteredRows = useMemo(() => {
    if (activeView === "all") return rows;
    return rows.filter((r) => {
      switch (activeView) {
        case "low_stock":
          return r.available <= 0;
        case "backordered":
          return r.backordered > 0;
        case "has_orders":
          return r.ordered > 0;
        default:
          return true;
      }
    });
  }, [rows, activeView]);

  /* ===================== EDIT HANDLERS ===================== */

  const handleEdit = (row: StockItemPayload) => {
    setEditRow({
      id: row.id,
      product_id: row.product_id,
      name: row.name,
      supplier_name: row.supplier_name ?? "—",
      description: row.description,
      on_hand: row.on_hand,
      ordered: row.ordered,
      reserved: row.reserved,
    });

    setOriginalOnHand(row.on_hand);
    setReason("");
    setNotes("");
    setOpenEdit(true);
  };

  const closeModal = () => {
    setOpenEdit(false);
    setEditRow(null);
  };

  const handleSave = async () => {
    if (!editRow) return;

    const delta = editRow.on_hand - originalOnHand;
    if (delta === 0) return alert("No quantity change detected.");
    if (!reason) return alert("Please select a reason.");

    const payload: createTxnRequest = {
      product_id: editRow.product_id,
      quantity_delta: delta,
      reason,
      note: notes,
    };

    try {
      setSaving(true);
      await autocommitTxn(payload);
      closeModal();
      loadData();
    } catch {
      alert("Failed to save transaction.");
    } finally {
      setSaving(false);
    }
  };

  /* ===================== VISIBLE COLUMNS FOR TABLE HEADER ===================== */

  const visibleColumnHeaders = useMemo(() => {
    const cols: string[] = [];
    if (isColVisible("Name")) cols.push("Name");
    if (isColVisible("Description")) cols.push("Description");
    if (isColVisible("Category")) cols.push("Category");
    if (isColVisible("Supplier")) cols.push("Supplier");
    cols.push(""); // spacer
    if (isColVisible("Stock")) cols.push("STOCK");
    return cols;
  }, [isColVisible]);

  /* ===================== RENDER ===================== */

  const QUICK_VIEWS: { key: QuickView; label: string }[] = [
    { key: "all", label: "All" },
    { key: "low_stock", label: "Low Stock" },
    { key: "backordered", label: "Backordered" },
    { key: "has_orders", label: "Has Open Orders" },
  ];

  return (
    <div>
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* ================= TOOLBAR: QUICK VIEWS + COLUMN CONTROLS ================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {/* Quick view buttons */}
        <div className="flex gap-2 flex-wrap">
          {QUICK_VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setActiveView(v.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                activeView === v.key
                  ? "bg-blue-100 text-blue-700 border-blue-300 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Column controls + density */}
        <div className="flex items-center gap-2 relative">
          {/* Density toggle */}
          <button
            onClick={() => setCompact((c) => !c)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 transition"
            title={compact ? "Switch to comfortable" : "Switch to compact"}
          >
            {compact ? "Comfortable" : "Compact"}
          </button>

          {/* Column visibility */}
          <div className="relative">
            <button
              onClick={() => setShowColMenu((s) => !s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 transition"
            >
              Columns ▾
            </button>
            {showColMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-30 min-w-[160px]">
                {ALL_COLUMNS.map((col) => (
                  <label key={col} className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={visibleCols[col]}
                      onChange={() => toggleCol(col)}
                    />
                    {col}
                  </label>
                ))}
                <hr className="my-1" />
                <button
                  onClick={resetView}
                  className="w-full text-left px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                >
                  Reset view
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <MDTable
        title="Stock Items"
        columns={visibleColumnHeaders}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
      >
        {/* ================= FILTER ROW (SERVER-DRIVEN) ================= */}
        <tr className="border-b">
          {isColVisible("Name") && (
            <th className="text-left pb-2">
              <input
                className="input input-bordered input-xs w-full max-w-[110px]"
                placeholder="Search name..."
                value={filters.searchName}
                onChange={(e) => {
                  setPage(1);
                  setFilter("searchName", e.target.value);
                }}
              />
            </th>
          )}

          {isColVisible("Description") && (
            <th className="text-left pb-2 pr-3">
              <input
                className="input input-bordered input-xs w-full max-w-[130px]"
                placeholder="Description..."
                value={filters.filterDescription}
                onChange={(e) => {
                  setPage(1);
                  setFilter("filterDescription", e.target.value);
                }}
              />
            </th>
          )}

          {isColVisible("Category") && (
            <th className="text-left pb-2 pr-3">
              <input
                className="input input-bordered input-xs w-full max-w-[100px]"
                placeholder="Category..."
                value={filters.filterCategory}
                onChange={(e) => {
                  setPage(1);
                  setFilter("filterCategory", e.target.value);
                }}
              />
            </th>
          )}

          {isColVisible("Supplier") && (
            <th className="text-left pb-2 pr-3">
              <input
                className="input input-bordered input-xs w-full max-w-[110px]"
                placeholder="Supplier..."
                value={filters.filterSupplier}
                onChange={(e) => {
                  setPage(1);
                  setFilter("filterSupplier", e.target.value);
                }}
              />
            </th>
          )}

          <th></th>

          {isColVisible("Stock") && (
            <th className="flex justify-between items-center bg-blue-50 py-6 px-2 border-2 border-blue-400 rounded-lg shadow-sm min-w-[350px]">
              <span className="font-semibold text-blue-600">On Hand</span>
              <span className="font-semibold text-blue-600">Ordered</span>
              <span className="font-semibold text-blue-600">Reserved</span>
              <span className="font-semibold text-blue-600">Available</span>
              <span className="font-semibold text-blue-600">Backordered</span>
            </th>
          )}
        </tr>

        {/* ================= DATA ROWS ================= */}
        {filteredRows.map((row) => (
          <tr
            key={row.id}
            className="bg-white shadow-sm rounded-xl cursor-pointer hover:bg-gray-50 transition"
          >
            {isColVisible("Name") && (
              <td
                className={`${rowPadding} px-2 font-semibold w-1/6`}
                onClick={() => navigate(`/products/${row.product_id}`)}
              >
                {row.name}
              </td>
            )}
            {isColVisible("Description") && (
              <td
                className={`${rowPadding} px-2 w-1/4 max-w-[200px]`}
                onClick={() => navigate(`/products/${row.product_id}`)}
              >
                <span className="block truncate" title={row.description ?? ""}>
                  {row.description ?? "—"}
                </span>
              </td>
            )}
            {isColVisible("Category") && (
              <td
                className={`${rowPadding} px-2 w-1/6`}
                onClick={() => navigate(`/products/${row.product_id}`)}
              >
                {row.category_name ?? "—"}
              </td>
            )}
            {isColVisible("Supplier") && (
              <td
                className={`${rowPadding} px-2 w-1/5`}
                onClick={() => navigate(`/products/${row.product_id}`)}
              >
                {row.supplier_name ?? "—"}
              </td>
            )}
            <td
              className="w-1/32 text-center"
              onClick={() => navigate(`/products/${row.product_id}`)}
            ></td>
            {isColVisible("Stock") && (
              <td
                className={`${rowPadding} font-medium text-center bg-blue-50 border-2 border-blue-400 rounded-lg shadow-sm min-w-[550px]`}
                onClick={() => navigate(`/products/${row.product_id}`)}
              >
                <div className="flex justify-around items-center gap-2">
                  <span className="font-medium text-center">{row.on_hand}</span>
                  <span className="font-medium text-center">{row.ordered}</span>
                  <span className="font-medium text-center">{row.reserved}</span>
                  <span className="text-center">
                    {row.available > 0 ? (
                      <span className="py-2 px-2 text-xs rounded-full bg-green-100 text-green-600 text-center">{row.available}</span>
                    ) : (
                      <span className="py-2 px-2 text-gray-400 text-center">{row.available}</span>
                    )}
                  </span>
                  <span className="font-medium text-center">
                    {row.backordered > 0 ? (
                      <span className="py-2 px-2 text-xs rounded-full bg-red-100 text-red-700 font-semibold text-center">
                        {row.backordered}
                      </span>
                    ) : (
                      <span className="py-2 px-2 text-gray-400 text-center">—</span>
                    )}
                  </span>
                </div>
              </td>
            )}

            <td
              className={`${rowPadding} pl-5 cursor-pointer hover:scale-110 transition`}
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row);
              }}
            >
              {/* edit icon */}
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
            <td colSpan={visibleColumnHeaders.length + 1} className="text-center py-6 text-gray-400">
              Loading stock items…
            </td>
          </tr>
        )}
      </MDTable>

      {openEdit && editRow && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
          <div className="bg-white w-[600px] rounded-xl shadow-xl p-6">

            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editRow.name}
              </h2>
              <button className="cursor-pointer hover:scale-110 transition" onClick={closeModal}>✕</button>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <label className="font-medium">Description</label>
                <div className="p-2 bg-gray-100 rounded">
                  {editRow.description ?? "—"}
                </div>
              </div>

              <div>
                <label className="font-medium">Supplier</label>
                <div className="p-2 bg-gray-100 rounded">
                  {editRow.supplier_name}
                </div>
              </div>
            </div>

            {/* Editable On Hand */}
            <div className="mb-6">
              <label className="font-medium text-sm">On Hand</label>
              <input
                type="number"
                className="input input-bordered w-full mt-1"
                value={editRow.on_hand}
                min={0}
                onChange={(e) =>
                  setEditRow({
                    ...editRow,
                    on_hand: Number(e.target.value),
                  })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Change will create an inventory transaction.
              </p>
            </div>

            {/* Reason + Notes */}
            <div className="mb-6">
              <label className="font-medium text-sm">Reason</label>
              <select
                className="select select-bordered w-full mt-1"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="">Select a reason…</option>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <label className="font-medium text-sm mt-4 block">
                Notes
              </label>
              <textarea
                className="textarea textarea-bordered w-full mt-1"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button className="btn" onClick={closeModal}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
