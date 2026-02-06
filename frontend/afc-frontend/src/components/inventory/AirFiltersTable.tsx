import { useEffect, useState, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import MDTable from "../table/MDtable";
import { fetchAirFilters } from "../../api/airfilters";
import type { AirFilterResponse, AirFilterPayload } from "../../api/airfilters";
import { autocommitTxn } from "../../api/transactions";
import type { createTxnRequest } from "../../api/transactions";
import { usePersistedFilters } from "../../hooks/usePersistedFilters";

/* ============================================================
   TYPES
============================================================ */

interface EditFormState {
  id: number;
  part_number: string;
  product_id: number;
  supplier_name: string;
  filter_category: string;
  height: number;
  width: number;
  depth: number;
  merv_rating: number;
  on_hand: number;
  ordered: number;
  reserved: number;
}

interface GroupedProduct {
  parent: AirFilterPayload;
  children: AirFilterPayload[];
  isExpanded: boolean;
}

/* ============================================================
   HELPER FUNCTIONS
============================================================ */

/**
 * Group products by parent-child relationship
 */
function groupProducts(products: AirFilterPayload[]): GroupedProduct[] {
  const parentMap = new Map<number, GroupedProduct>();
  const childProducts: AirFilterPayload[] = [];

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

export default function AirFiltersTable() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [data, setData] = useState<AirFilterResponse>();
  const [loading, setLoading] = useState(false);

  /* ===================== EXPANDED ROWS STATE ===================== */
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  /* ===================== FILTER STATE (PERSISTED) ===================== */
  const [filters, setFilter] = usePersistedFilters("filters_airfilters", {
    searchPart: "",
    filterSupplier: "",
    filterCategory: "",
    filterMerv: "" as number | "",
    filterHeight: "" as number | "",
    filterWidth: "" as number | "",
    filterDepth: "" as number | "",
  });


  /* ===================== DIMENSION FILTER TOGGLE ===================== */
  const [showDimensionFilters, setShowDimensionFilters] = useState(false);

  /* ===================== EDIT MODAL ===================== */
  const [openEdit, setOpenEdit] = useState(false);
  const [editRow, setEditRow] = useState<EditFormState | null>(null);
  const [originalOnHand, setOriginalOnHand] = useState(0);

  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const REASONS = ["shipment", "receive", "adjustment", "rollback"];

  /* ===================== LOAD DATA (SERVER-SIDE FILTERING) ===================== */

  const loadData = () => {
    setLoading(true);

    fetchAirFilters(page, pageSize, {
        part_number: filters.searchPart || undefined,
        supplier: filters.filterSupplier || undefined,
        category: filters.filterCategory || undefined,
        merv: filters.filterMerv || undefined,
        height: filters.filterHeight || undefined,
        width: filters.filterWidth || undefined,
        depth: filters.filterDepth || undefined,
      })
      .then((res) => {
        setData(res);

        // Auto-expand parents when search matches child products
        if (filters.searchPart && res.results) {
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
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [page, filters.searchPart, filters.filterSupplier, filters.filterCategory, filters.filterMerv, filters.filterHeight, filters.filterWidth, filters.filterDepth]);

  const rows: AirFilterPayload[] = data?.results ?? [];
  const groupedProducts = useMemo(() => groupProducts(rows), [rows]);

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

  const handleEdit = (row: AirFilterPayload) => {
    setEditRow({
      id: row.id,
      product_id: row.product_id,
      part_number: row.part_number,
      supplier_name: row.supplier_name ?? "—",
      filter_category: row.filter_category,
      height: row.height,
      width: row.width,
      depth: row.depth,
      merv_rating: row.merv_rating,
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

  /* ===================== RENDER ===================== */

  return (
    <div>

      <MDTable
        title="Air Filters"
        columns={[
          "Part Number",
          "Supplier",
          "Category",
          "Dimensions",
          "MERV",
          "",
          "STOCK",

        ]}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
      >
        {/* ================= FILTER ROW (SERVER-DRIVEN) ================= */}
        <tr className="border-b">
          <th className="pr-3 pb-2">
            <input
              className="input input-bordered input-xs w-full"
              placeholder="Search..."
              value={filters.searchPart}
              onChange={(e) => {
                setPage(1);
                setFilter("searchPart", e.target.value);
              }}
            />
          </th>

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

          <th className="pb-2 pr-3 w-1/12">
            <input
              className="input input-bordered input-xs w-full"
              placeholder="Category..."
              value={filters.filterCategory}
              onChange={(e) => {
                setPage(1);
                setFilter("filterCategory", e.target.value);
              }}
            />
          </th>

          <th className="pr-2 pb-2 w-1/10">
            <div className="flex flex-col items-center gap-1 justify-center">
              {!showDimensionFilters ? (
                <button
                  className="btn btn-xs btn-outline btn-ghost"
                  onClick={() => setShowDimensionFilters(true)}
                >
                  Filter Dimensions
                </button>
              ) : (
                <>
                  <div>
                    <input
                      type="number"
                      placeholder="H"
                      className="input input-bordered input-xs w-14 text-center"
                      value={filters.filterHeight}
                      onChange={(e) => {
                        setPage(1);
                        setFilter("filterHeight", e.target.value ? Number(e.target.value) : "");
                      }}
                    />
                    <span className="text-gray-400 text-xs mx-1">x</span>
                    
                    <input
                      type="number"
                      placeholder="W"
                      className="input input-bordered input-xs w-14 text-center"
                      value={filters.filterWidth}
                      onChange={(e) => {
                        setPage(1);
                        setFilter("filterWidth", e.target.value ? Number(e.target.value) : "");
                      }}
                    />
                  </div>

                  <input
                    type="number"
                    placeholder="D"
                    className="input input-bordered input-xs w-14 text-center self-center"
                    value={filters.filterDepth}
                    onChange={(e) => {
                      setPage(1);
                      setFilter("filterDepth", e.target.value ? Number(e.target.value) : "");
                    }}
                  />
                  <button
                    className="btn btn-xs btn-ghost"
                    onClick={() => {
                      setShowDimensionFilters(false);
                      setFilter("filterHeight", "");
                      setFilter("filterWidth", "");
                      setFilter("filterDepth", "");
                    }}
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          </th>

          <th className=" pr-3 pb-2 w-1/18">
            <input
              className="input input-bordered input-xs self-start text-center w-full"
              placeholder="MERV..."
              value={filters.filterMerv}
              onChange={(e) => {
                setPage(1);
                setFilter("filterMerv", e.target.value ? Number(e.target.value) : "");
              }}
            />
          </th>

          <th></th>

          <th className="flex justify-between items-center bg-blue-50 py-6 px-2 border-2 border-blue-400 rounded-lg shadow-sm">
              <span className="font-semibold text-blue-600">On Hand</span>
              <span className="font-semibold text-blue-600">Ordered</span>
              <span className="font-semibold text-blue-600">Reserved</span>
              <span className="font-semibold text-blue-600">Available</span>
              <span className="font-semibold text-blue-600">Backordered</span>
          </th>

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
                <td 
                  className="py-3 px-2 font-semibold w-1/6"
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
                    <span>{group.parent.part_number}</span>
                  </div>
                </td>
                <td 
                  className="py-3 px-2 w-1/5"
                  onClick={() => navigate(`/products/${group.parent.product_id}`)}
                >
                  {group.parent.supplier_name ?? "—"}
                </td>
                <td 
                  className="py-3 px-2"
                  onClick={() => navigate(`/products/${group.parent.product_id}`)}
                >
                  {group.parent.filter_category}
                </td>
                <td 
                  className="py-3 px-2 text-center"
                  onClick={() => navigate(`/products/${group.parent.product_id}`)}
                >
                  {group.parent.height} x {group.parent.width} x {group.parent.depth}
                </td>
                <td 
                  className="py-3 text-center"
                  onClick={() => navigate(`/products/${group.parent.product_id}`)}
                >
                  {group.parent.merv_rating}
                </td>
                <td 
                  className="w-1/32 text-center"
                  onClick={() => navigate(`/products/${group.parent.product_id}`)}
                ></td>
                <td 
                  className="py-3 font-medium text-center bg-blue-50 border-2 border-blue-400 rounded-lg shadow-sm"
                  onClick={() => navigate(`/products/${group.parent.product_id}`)}
                >
                  <div className="flex justify-around items-center gap-5">
                    <span className="font-medium text-center">{group.parent.on_hand}</span>
                    <span className="font-medium text-center">{group.parent.ordered}</span>
                    <span className="font-medium text-center">{group.parent.reserved}</span>
                    <span className="text-center">{
                      group.parent.available > 0 ? (
                        <span className="py-2 px-2 text-xs rounded-full bg-green-100 text-green-600 text-center">{group.parent.available}</span>
                      ) : ( 
                        <span className="py-2 px-2 text-gray-400 text-center">{group.parent.available}</span>
                      )
                    }
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

                <td
                  className="py-3 pl-5 cursor-pointer hover:scale-110 transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(group.parent)
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
                  <td 
                    className="py-3 px-2 font-semibold w-1/6 pl-10"
                    onClick={() => navigate(`/products/${child.product_id}`)}
                  >
                    <span className="text-gray-600">↳ {child.part_number}</span>
                  </td>
                  <td 
                    className="py-3 px-2 w-1/5"
                    onClick={() => navigate(`/products/${child.product_id}`)}
                  >
                    {child.supplier_name ?? "—"}
                  </td>
                  <td 
                    className="py-3 px-2"
                    onClick={() => navigate(`/products/${child.product_id}`)}
                  >
                    {child.filter_category}
                  </td>
                  <td 
                    className="py-3 px-2 text-center"
                    onClick={() => navigate(`/products/${child.product_id}`)}
                  >
                    {child.height} x {child.width} x {child.depth}
                  </td>
                  <td 
                    className="py-3 text-center"
                    onClick={() => navigate(`/products/${child.product_id}`)}
                  >
                    {child.merv_rating}
                  </td>
                  <td 
                    className="w-1/32 text-center"
                    onClick={() => navigate(`/products/${child.product_id}`)}
                  ></td>
                  <td 
                    className="py-3 font-medium text-center bg-white border-2 border-blue-300 rounded-lg shadow-sm"
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

                  <td
                    className="py-3 pl-5 cursor-pointer hover:scale-110 transition"
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
            <td colSpan={11} className="text-center py-6 text-gray-400">
              Loading air filters…
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
                {editRow.part_number}
              </h2>
              <button className="cursor-pointer hover:scale-110 transition" onClick={closeModal}>✕</button>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <label className="font-medium">Supplier</label>
                <div className="p-2 bg-gray-100 rounded">
                  {editRow.supplier_name}
                </div>
              </div>

              <div>
                <label className="font-medium">Category</label>
                <div className="p-2 bg-gray-100 rounded">
                  {editRow.filter_category}
                </div>
              </div>

              <div>
                <label className="font-medium">Dimensions</label>
                <div className="p-2 bg-gray-100 rounded">
                  {editRow.height} x {editRow.width} x {editRow.depth}
                </div>
              </div>

              <div>
                <label className="font-medium">MERV</label>
                <div className="p-2 bg-gray-100 rounded">
                  {editRow.merv_rating}
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
