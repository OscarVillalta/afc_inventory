import { useEffect, useState, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import MDTable from "../table/MDtable";
import { fetchAirFilters, deleteAirFilter, patchAirFilter } from "../../api/airfilters";
import type { AirFilterResponse, AirFilterPayload, AirFilterCategory } from "../../api/airfilters";
import { autocommitTxn } from "../../api/transactions";
import type { createTxnRequest } from "../../api/transactions";
import type { Supplier } from "../../api/suppliers";

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
}

interface InlineEdit {
  rowId: number;
  field: "merv_rating" | "supplier" | "category";
}

interface Props {
  refreshToken?: number;
  globalSearch?: string;
  filterSupplier?: string;
  filterCategory?: string;
  filterMerv?: number;
  filterDescription?: string;
  quickView?: "all" | "low_stock" | "backordered" | "has_orders" | "recently_updated";
  compact?: boolean;
  suppliers?: Supplier[];
  airFilterCategories?: AirFilterCategory[];
}

/* ============================================================
   HELPER: group products by parent-child
============================================================ */

function groupProducts(products: AirFilterPayload[]): GroupedProduct[] {
  const parentMap = new Map<number, GroupedProduct>();
  const childProducts: AirFilterPayload[] = [];

  products.forEach((product) => {
    if (product.parent_product_id) {
      childProducts.push(product);
    } else {
      parentMap.set(product.product_id, { parent: product, children: [] });
    }
  });

  childProducts.forEach((child) => {
    const parentGroup = parentMap.get(child.parent_product_id!);
    if (parentGroup) {
      parentGroup.children.push(child);
    } else {
      parentMap.set(child.product_id, { parent: child, children: [] });
    }
  });

  return Array.from(parentMap.values());
}

/* ============================================================
   ICON COMPONENTS
============================================================ */

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path
        fillRule="evenodd"
        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ============================================================
   AVAILABLE PROGRESS BAR
============================================================ */

function AvailableBar({ available, onHand }: { available: number; onHand: number }) {
  const max = Math.max(onHand, 1);
  const pct = Math.min(100, Math.max(0, Math.round((available / max) * 100)));
  const color =
    pct === 0 ? "bg-red-400" : pct < 30 ? "bg-amber-400" : "bg-green-500";

  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[64px]">
      <span className={`text-xs font-medium ${available > 0 ? "text-green-700" : "text-gray-400"}`}>
        {available}
      </span>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ============================================================
   COMPONENT
============================================================ */

export default function AirFiltersTable({
  refreshToken,
  globalSearch = "",
  filterSupplier = "",
  filterCategory = "",
  filterMerv,
  filterDescription = "",
  quickView = "all",
  compact = false,
  suppliers = [],
  airFilterCategories = [],
}: Props) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const [data, setData] = useState<AirFilterResponse>();
  const [loading, setLoading] = useState(false);

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  /* ===================== EDIT MODAL ===================== */
  const [openEdit, setOpenEdit] = useState(false);
  const [editRow, setEditRow] = useState<EditFormState | null>(null);
  const [originalOnHand, setOriginalOnHand] = useState(0);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  /* ===================== DELETE CONFIRM ===================== */
  const [deleteTarget, setDeleteTarget] = useState<AirFilterPayload | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ===================== INLINE EDIT ===================== */
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null);

  const REASONS = ["shipment", "receive", "adjustment", "rollback"];

  const rowPadding = compact ? "py-1 px-3" : "py-3 px-4";

  /* ===================== LOAD DATA ===================== */

  const loadData = () => {
    setLoading(true);
    fetchAirFilters(page, pageSize, {
      part_number: globalSearch || undefined,
      description: filterDescription || undefined,
      supplier: filterSupplier || undefined,
      category: filterCategory || undefined,
      merv: filterMerv || undefined,
    })
      .then((res) => {
        setData(res);
        if (globalSearch && res.results) {
          setExpandedRows((prev) => {
            const next = new Set(prev);
            res.results.forEach((p) => {
              if (p.parent_product_id) next.add(p.parent_product_id);
            });
            return next;
          });
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setPage(1);
  }, [globalSearch, filterDescription, filterSupplier, filterCategory, filterMerv, quickView, pageSize]);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, globalSearch, filterDescription, filterSupplier, filterCategory, filterMerv, refreshToken]);

  const rows: AirFilterPayload[] = data?.results ?? [];

  /* ── client-side quick-view filter ── */
  const filteredRows = useMemo(() => {
    if (quickView === "all") return rows;
    return rows.filter((r) => {
      switch (quickView) {
        case "low_stock":      return r.available <= 0;
        case "backordered":    return r.backordered > 0;
        case "has_orders":     return r.ordered > 0;
        default:               return true;
      }
    });
  }, [rows, quickView]);

  const groupedProducts = useMemo(() => groupProducts(filteredRows), [filteredRows]);

  /* ===================== EXPAND/COLLAPSE ===================== */

  const toggleExpand = (productId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
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

  const closeModal = () => { setOpenEdit(false); setEditRow(null); };

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

  /* ===================== INLINE EDIT HANDLERS ===================== */

  const handleInlineSave = async (
    row: AirFilterPayload,
    field: InlineEdit["field"],
    value: string
  ) => {
    setInlineEdit(null);
    if (!value) return;
    try {
      if (field === "merv_rating") {
        await patchAirFilter(row.id, { merv_rating: Number(value) });
      } else if (field === "supplier") {
        const sup = suppliers.find((s) => s.name === value);
        if (!sup) return;
        await patchAirFilter(row.id, { supplier_id: sup.id });
      } else if (field === "category") {
        const cat = airFilterCategories.find((c) => c.name === value);
        if (!cat) return;
        await patchAirFilter(row.id, { category_id: cat.id });
      }
      loadData();
    } catch {
      alert("Failed to update field.");
    }
  };

  /* MERV label helper */
  const mervLabel = (rating: number) => {
    if (rating === 17) return "99.99%";
    if (rating === 18) return "99.999%";
    return `MERV ${rating}`;
  };

  /* ===================== DELETE HANDLERS ===================== */

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteAirFilter(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch {
      alert("Failed to delete item.");
    } finally {
      setDeleting(false);
    }
  };

  /* ===================== TABLE COLUMNS ===================== */

  const columns = ["Part Number", "Description", "Supplier", "Category", "Dimensions", "MERV", "", "On Hand", "Ordered", "Reserved", "Available", "Backord.", "Actions"];

  /* ===================== ROW RENDER HELPER ===================== */

  const renderStockCells = (row: AirFilterPayload, isChild = false) => (
    <>
      <td className={`${rowPadding} text-center text-sm ${isChild ? "text-gray-400" : ""}`}>{isChild ? "—" : row.on_hand}</td>
      <td className={`${rowPadding} text-center text-sm ${isChild ? "text-gray-400" : ""}`}>{isChild ? "—" : row.ordered}</td>
      <td className={`${rowPadding} text-center text-sm ${isChild ? "text-gray-400" : ""}`}>{isChild ? "—" : row.reserved}</td>
      <td className={`${rowPadding} text-center`}>
        {isChild ? (
          <span className="text-gray-400 text-sm">—</span>
        ) : (
          <AvailableBar available={row.available} onHand={row.on_hand} />
        )}
      </td>
      <td className={`${rowPadding} text-center text-sm`}>
        {!isChild && row.backordered > 0 ? (
          <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 font-semibold">
            {row.backordered}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
    </>
  );

  /* ===================== RENDER ===================== */

  return (
    <div>
      <MDTable
        title="Air Filters"
        columns={columns}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      >
        {/* ── DATA ROWS ── */}
        {groupedProducts.map((group) => {
          const isExpanded = expandedRows.has(group.parent.product_id);
          const hasChildren = group.children.length > 0;

          return (
            <Fragment key={group.parent.id}>
              {/* PARENT ROW */}
              <tr className="hover:bg-blue-50/40 transition cursor-pointer group">
                {/* Part Number */}
                <td
                  className={`${rowPadding} font-semibold text-blue-600 hover:underline text-sm whitespace-nowrap`}
                  onClick={() => navigate(`/products/${group.parent.product_id}`)}
                >
                  <div className="flex items-center gap-1.5">
                    {hasChildren && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleExpand(group.parent.product_id); }}
                        className="text-gray-400 hover:text-gray-600 transition w-4 text-center"
                      >
                        {isExpanded ? "▼" : "▶"}
                      </button>
                    )}
                    <span>{group.parent.part_number}</span>
                  </div>
                </td>
                {/* Description */}
                <td
                  className={`${rowPadding} max-w-[160px]`}
                  onClick={() => navigate(`/products/${group.parent.product_id}`)}
                >
                  <span className="block truncate text-sm text-gray-600" title={group.parent.description ?? ""}>
                    {group.parent.description || <span className="text-gray-300">—</span>}
                  </span>
                </td>
                {/* Supplier */}
                <td
                  className={`${rowPadding} text-sm text-gray-700 whitespace-nowrap`}
                  onClick={(e) => { e.stopPropagation(); setInlineEdit({ rowId: group.parent.id, field: "supplier" }); }}
                >
                  {inlineEdit?.rowId === group.parent.id && inlineEdit.field === "supplier" ? (
                    <select
                      autoFocus
                      className="border border-blue-400 rounded px-1 py-0.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                      defaultValue={group.parent.supplier_name ?? ""}
                      onBlur={(e) => handleInlineSave(group.parent, "supplier", e.target.value)}
                      onChange={(e) => handleInlineSave(group.parent, "supplier", e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">— Select —</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="cursor-pointer hover:text-blue-600 hover:underline" title="Click to edit">
                      {group.parent.supplier_name ?? "—"}
                    </span>
                  )}
                </td>
                {/* Category */}
                <td
                  className={`${rowPadding} text-sm text-gray-700`}
                  onClick={(e) => { e.stopPropagation(); setInlineEdit({ rowId: group.parent.id, field: "category" }); }}
                >
                  {inlineEdit?.rowId === group.parent.id && inlineEdit.field === "category" ? (
                    <select
                      autoFocus
                      className="border border-blue-400 rounded px-1 py-0.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                      defaultValue={group.parent.filter_category ?? ""}
                      onBlur={(e) => handleInlineSave(group.parent, "category", e.target.value)}
                      onChange={(e) => handleInlineSave(group.parent, "category", e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">— Select —</option>
                      {airFilterCategories.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="cursor-pointer hover:text-blue-600 hover:underline" title="Click to edit">
                      {group.parent.filter_category}
                    </span>
                  )}
                </td>
                {/* Dimensions */}
                <td
                  className={`${rowPadding} text-sm text-gray-700 whitespace-nowrap`}
                  onClick={() => navigate(`/products/${group.parent.product_id}`)}
                >
                  {group.parent.height} × {group.parent.width} × {group.parent.depth}
                </td>
                {/* MERV */}
                <td
                  className={`${rowPadding} text-sm text-center`}
                  onClick={(e) => { e.stopPropagation(); setInlineEdit({ rowId: group.parent.id, field: "merv_rating" }); }}
                >
                  {inlineEdit?.rowId === group.parent.id && inlineEdit.field === "merv_rating" ? (
                    <select
                      autoFocus
                      className="border border-blue-400 rounded px-1 py-0.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                      defaultValue={group.parent.merv_rating}
                      onBlur={(e) => handleInlineSave(group.parent, "merv_rating", e.target.value)}
                      onChange={(e) => handleInlineSave(group.parent, "merv_rating", e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {Array.from({ length: 16 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>MERV {m}</option>
                      ))}
                      <option value={17}>99.99%</option>
                      <option value={18}>99.999%</option>
                    </select>
                  ) : (
                    <span
                      className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600 font-medium cursor-pointer hover:bg-blue-100 hover:text-blue-700"
                      title="Click to edit"
                    >
                      {mervLabel(group.parent.merv_rating)}
                    </span>
                  )}
                </td>
                {/* spacer */}
                <td className="w-4" />
                {/* Stock cells */}
                {renderStockCells(group.parent)}
                {/* Actions */}
                <td className={`${rowPadding} text-right pr-3`}>
                  <div className="flex items-center justify-end gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(group.parent); }}
                      className="text-gray-500 hover:text-blue-600 transition"
                      title="Edit"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(group.parent); }}
                      className="text-gray-500 hover:text-red-600 transition"
                      title="Delete"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>

              {/* CHILD ROWS */}
              {isExpanded &&
                group.children.map((child) => (
                  <tr key={child.id} className="bg-blue-50/30 hover:bg-blue-50/60 transition cursor-pointer group">
                    {/* Part Number */}
                    <td
                      className={`${rowPadding} text-sm pl-8 text-gray-500`}
                      onClick={() => navigate(`/products/${child.product_id}`)}
                    >
                      <span className="text-gray-400 mr-1">↳</span>
                      {child.part_number}
                    </td>
                    {/* Description */}
                    <td
                      className={`${rowPadding} max-w-[160px]`}
                      onClick={() => navigate(`/products/${child.product_id}`)}
                    >
                      <span className="block truncate text-sm text-gray-500" title={child.description ?? ""}>
                        {child.description || <span className="text-gray-300">—</span>}
                      </span>
                    </td>
                    <td className={`${rowPadding} text-sm text-gray-500`} onClick={() => navigate(`/products/${child.product_id}`)}>{child.supplier_name ?? "—"}</td>
                    <td className={`${rowPadding} text-sm text-gray-500`} onClick={() => navigate(`/products/${child.product_id}`)}>{child.filter_category}</td>
                    <td className={`${rowPadding} text-sm text-gray-500 whitespace-nowrap`} onClick={() => navigate(`/products/${child.product_id}`)}>{child.height} × {child.width} × {child.depth}</td>
                    <td className={`${rowPadding} text-center`} onClick={() => navigate(`/products/${child.product_id}`)}>
                      <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-500">{child.merv_rating}</span>
                    </td>
                    <td className="w-4" />
                    {renderStockCells(child, true)}
                    <td className={`${rowPadding} text-right pr-3`} />
                  </tr>
                ))}
            </Fragment>
          );
        })}

        {loading && (
          <tr>
            <td colSpan={columns.length} className="text-center py-8 text-gray-400 text-sm">
              Loading air filters…
            </td>
          </tr>
        )}

        {!loading && groupedProducts.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="text-center py-8 text-gray-400 text-sm">
              No items found.
            </td>
          </tr>
        )}
      </MDTable>

      {/* ── EDIT MODAL ── */}
      {openEdit && editRow && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
          <div className="bg-white w-[600px] rounded-xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{editRow.part_number}</h2>
              <button className="cursor-pointer hover:scale-110 transition" onClick={closeModal}>✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <label className="font-medium">Supplier</label>
                <div className="p-2 bg-gray-100 rounded">{editRow.supplier_name}</div>
              </div>
              <div>
                <label className="font-medium">Category</label>
                <div className="p-2 bg-gray-100 rounded">{editRow.filter_category}</div>
              </div>
              <div>
                <label className="font-medium">Dimensions</label>
                <div className="p-2 bg-gray-100 rounded">{editRow.height} × {editRow.width} × {editRow.depth}</div>
              </div>
              <div>
                <label className="font-medium">MERV</label>
                <div className="p-2 bg-gray-100 rounded">{editRow.merv_rating}</div>
              </div>
            </div>

            <div className="mb-6">
              <label className="font-medium text-sm">On Hand</label>
              <input
                type="number"
                className="input input-bordered w-full mt-1"
                value={editRow.on_hand}
                min={0}
                onChange={(e) => setEditRow({ ...editRow, on_hand: Number(e.target.value) })}
              />
              <p className="text-xs text-gray-500 mt-1">Change will create an inventory transaction.</p>
            </div>

            <div className="mb-6">
              <label className="font-medium text-sm">Reason</label>
              <select
                className="select select-bordered w-full mt-1"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="">Select a reason…</option>
                {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>

              <label className="font-medium text-sm mt-4 block">Notes</label>
              <textarea
                className="textarea textarea-bordered w-full mt-1"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button className="btn" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
          <div className="bg-white w-[420px] rounded-xl shadow-xl p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Delete Air Filter</h2>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete{" "}
              <strong>{deleteTarget.part_number}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button className="btn" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
