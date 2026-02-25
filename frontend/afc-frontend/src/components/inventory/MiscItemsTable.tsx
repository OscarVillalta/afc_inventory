import { useEffect, useState, useCallback, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import MDTable from "../table/MDtable";
import { fetchMiscItems } from "../../api/miscItems";
import type { MiscItemResponse, MiscItemPayload } from "../../api/miscItems";
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

const ALL_COLUMNS = ["Name", "Description", "Supplier", "Stock"] as const;
type ColumnKey = typeof ALL_COLUMNS[number];
const DEFAULT_VISIBLE: Record<ColumnKey, boolean> = {
  Name: true,
  Description: true,
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

interface GroupedProduct {
  parent: MiscItemPayload;
  children: MiscItemPayload[];
  isExpanded: boolean;
}

/* ============================================================
   HELPER FUNCTIONS
============================================================ */

/**
 * Group products by parent-child relationship
 */
function groupProducts(products: MiscItemPayload[]): GroupedProduct[] {
  const parentMap = new Map<number, GroupedProduct>();
  const childProducts: MiscItemPayload[] = [];

  // First pass: identify parents and children
  products.forEach((product) => {
    if (product.parent_product_id) {
      // This is a child product
      childProducts.push(product);
    } else {
      // This is a parent product (or standalone)
      parentMap.set(product.product_id, {
        parent: product,
        children: [],
        isExpanded: false,
      });
    }
  });

  // Second pass: attach children to parents
  childProducts.forEach((child) => {
    const parentGroup = parentMap.get(child.parent_product_id!);
    if (parentGroup) {
      parentGroup.children.push(child);
    } else {
      // Orphaned child - treat as standalone
      parentMap.set(child.product_id, {
        parent: child,
        children: [],
        isExpanded: false,
      });
    }
  });

  return Array.from(parentMap.values());
}

/* ============================================================
   COMPONENT
============================================================ */

export default function MiscItemsTable({ refreshToken }: { refreshToken?: number }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [data, setData] = useState<MiscItemResponse>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ===================== EXPANDED ROWS STATE ===================== */
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  /* ===================== FILTER STATE (PERSISTED) ===================== */
  const [filters, setFilter] = usePersistedFilters("filters_miscitems", {
    searchName: "",
    filterDescription: "",
    filterSupplier: "",
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

    fetchMiscItems(page, pageSize, {
        name: filters.searchName || undefined,
        description: filters.filterDescription || undefined,
        supplier: filters.filterSupplier || undefined,
      })
      .then((res) => {
        setData(res);

        // Auto-expand parents when search matches child products
        if (filters.searchName && res.results) {
          setExpandedRows((prev) => {
            const newExpandedRows = new Set(prev);
            res.results.forEach((product) => {
              if (product.parent_product_id) {
                // This is a child product that matched the search
                newExpandedRows.add(product.parent_product_id);
              }
            });
            return newExpandedRows;
          });
        }
      })
      .catch(() => setError("Failed to load misc items"))
      .finally(() => setLoading(false));
  }, [page, pageSize, filters.searchName, filters.filterDescription, filters.filterSupplier]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshToken]);

  const rows: MiscItemPayload[] = data?.results ?? [];

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

  const groupedProducts = useMemo(() => groupProducts(filteredRows), [filteredRows]);

  /* ===================== EXPAND/COLLAPSE HANDLERS ===================== */

  const toggleExpand = (productId: number) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  /* ===================== EDIT HANDLERS ===================== */

  const handleEdit = (row: MiscItemPayload) => {
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
        title="Miscellaneous Items"
        columns={visibleColumnHeaders}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
      >
        {/* ================= FILTER ROW (SERVER-DRIVEN) ================= */}
        <tr className="border-b">
          {isColVisible("Name") && (
            <th className="pr-3 pb-2">
              <input
                className="input input-bordered input-xs w-full"
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
            <th className="pb-2 pr-3">
              <input
                className="input input-bordered input-xs w-full"
                placeholder="Description..."
                value={filters.filterDescription}
                onChange={(e) => {
                  setPage(1);
                  setFilter("filterDescription", e.target.value);
                }}
              />
            </th>
          )}

          {isColVisible("Supplier") && (
            <th className="pb-2 pr-3">
              <input
                className="input input-bordered input-xs w-full"
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
            <th className="flex justify-between items-center bg-blue-50 py-6 px-2 border-2 border-blue-400 rounded-lg shadow-sm">
              <span className="font-semibold text-blue-600">On Hand</span>
              <span className="font-semibold text-blue-600">Ordered</span>
              <span className="font-semibold text-blue-600">Reserved</span>
              <span className="font-semibold text-blue-600">Available</span>
              <span className="font-semibold text-blue-600">Backordered</span>
            </th>
          )}
        </tr>

        {/* ================= DATA ROWS ================= */}
        {groupedProducts.map((group) => {
          const isExpanded = expandedRows.has(group.parent.product_id);
          const hasChildren = group.children.length > 0;
          
          return (
            <Fragment key={group.parent.id}>
              {/* PARENT ROW */}
              <tr 
                className="bg-white shadow-sm rounded-xl cursor-pointer hover:bg-gray-50 transition"
              >
                {isColVisible("Name") && (
                  <td 
                    className={`${rowPadding} px-2 font-semibold w-1/6`}
                    onClick={() => navigate(`/products/${group.parent.product_id}`)}
                  >
                    <div className="flex items-center gap-2">
                      {hasChildren && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(group.parent.product_id);
                          }}
                          className="text-gray-400 hover:text-gray-600 transition"
                        >
                          {isExpanded ? "▼" : "▶"}
                        </button>
                      )}
                      <span>{group.parent.name}</span>
                    </div>
                  </td>
                )}
                {isColVisible("Description") && (
                  <td 
                    className={`${rowPadding} px-2 w-1/4`}
                    onClick={() => navigate(`/products/${group.parent.product_id}`)}
                  >
                    {group.parent.description ?? "—"}
                  </td>
                )}
                {isColVisible("Supplier") && (
                  <td 
                    className={`${rowPadding} px-2 w-1/5`}
                    onClick={() => navigate(`/products/${group.parent.product_id}`)}
                  >
                    {group.parent.supplier_name ?? "—"}
                  </td>
                )}
                <td 
                  className="w-1/32 text-center"
                  onClick={() => navigate(`/products/${group.parent.product_id}`)}
                ></td>
                {isColVisible("Stock") && (
                  <td 
                    className={`${rowPadding} font-medium text-center bg-blue-50 border-2 border-blue-400 rounded-lg shadow-sm`}
                    onClick={() => navigate(`/products/${group.parent.product_id}`)}
                  >
                    <div className="flex justify-around items-center gap-5">
                      <span className="font-medium text-center">{group.parent.on_hand}</span>
                      <span className="font-medium text-center">{group.parent.ordered}</span>
                      <span className="font-medium text-center">{group.parent.reserved}</span>
                      <span className="text-center">
                        {group.parent.available > 0 ? (
                          <span className="py-2 px-2 text-xs rounded-full bg-green-100 text-green-600 text-center">{group.parent.available}</span>
                        ) : (
                          <span className="py-2 px-2 text-gray-400 text-center">{group.parent.available}</span>
                        )}
                      </span>
                      <span className="font-medium text-center">
                        {group.parent.backordered > 0 ? (
                          <span className="py-2 px-2 text-xs rounded-full bg-red-100 text-red-700 font-semibold text-center">
                            {group.parent.backordered}
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
                    handleEdit(group.parent);
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

              {/* CHILD ROWS */}
              {isExpanded && group.children.map((child) => (
                <tr 
                  key={child.id} 
                  className="bg-blue-50 hover:bg-blue-100 transition cursor-pointer"
                >
                  {isColVisible("Name") && (
                    <td 
                      className={`${rowPadding} px-2 font-semibold w-1/6 pl-10`}
                      onClick={() => navigate(`/products/${child.product_id}`)}
                    >
                      <span className="text-gray-600">↳ {child.name}</span>
                    </td>
                  )}
                  {isColVisible("Description") && (
                    <td 
                      className={`${rowPadding} px-2 w-1/4`}
                      onClick={() => navigate(`/products/${child.product_id}`)}
                    >
                      {child.description ?? "—"}
                    </td>
                  )}
                  {isColVisible("Supplier") && (
                    <td 
                      className={`${rowPadding} px-2 w-1/5`}
                      onClick={() => navigate(`/products/${child.product_id}`)}
                    >
                      {child.supplier_name ?? "—"}
                    </td>
                  )}
                  <td 
                    className="w-1/32 text-center"
                    onClick={() => navigate(`/products/${child.product_id}`)}
                  ></td>
                  {isColVisible("Stock") && (
                    <td 
                      className={`${rowPadding} font-medium text-center bg-white border-2 border-blue-300 rounded-lg shadow-sm`}
                      onClick={() => navigate(`/products/${child.product_id}`)}
                    >
                      <div className="flex justify-around items-center gap-5">
                        <span className="font-medium text-center text-gray-500">—</span>
                        <span className="font-medium text-center text-gray-500">—</span>
                        <span className="font-medium text-center text-gray-500">—</span>
                        <span className="font-medium text-center text-gray-500">—</span>
                        <span className="font-medium text-center text-gray-500">—</span>
                      </div>
                    </td>
                  )}

                  <td
                    className={`${rowPadding} pl-5 cursor-pointer hover:scale-110 transition`}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Child products share parent's quantity, so we don't allow editing
                    }}
                  >
                    {/* No edit icon for children */}
                  </td>
                </tr>
              ))}
            </Fragment>
          );
        })}

        {loading && (
          <tr>
            <td colSpan={visibleColumnHeaders.length + 1} className="text-center py-6 text-gray-400">
              Loading misc items…
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
