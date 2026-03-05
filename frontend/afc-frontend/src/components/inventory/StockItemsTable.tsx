import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import MDTable from "../table/MDtable";
import { fetchStockItems } from "../../api/stockItems";
import type { StockItemResponse, StockItemPayload } from "../../api/stockItems";
import { autocommitTxn } from "../../api/transactions";
import type { createTxnRequest } from "../../api/transactions";

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

interface Props {
  refreshToken?: number;
  globalSearch?: string;
  filterSupplier?: string;
  filterCategory?: string;
  quickView?: "all" | "low_stock" | "backordered" | "has_orders";
  compact?: boolean;
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

export default function StockItemsTable({
  refreshToken,
  globalSearch = "",
  filterSupplier = "",
  filterCategory = "",
  quickView = "all",
  compact = false,
}: Props) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [data, setData] = useState<StockItemResponse>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ===================== EDIT MODAL ===================== */
  const [openEdit, setOpenEdit] = useState(false);
  const [editRow, setEditRow] = useState<EditFormState | null>(null);
  const [originalOnHand, setOriginalOnHand] = useState(0);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const REASONS = ["shipment", "receive", "adjustment", "rollback"];

  const rowPadding = compact ? "py-1 px-3" : "py-3 px-4";

  /* ===================== LOAD DATA ===================== */

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchStockItems(page, pageSize, {
      name: globalSearch || undefined,
      supplier: filterSupplier || undefined,
      category: filterCategory || undefined,
    })
      .then((res) => setData(res))
      .catch(() => setError("Failed to load stock items"))
      .finally(() => setLoading(false));
  }, [page, pageSize, globalSearch, filterSupplier, filterCategory]);

  useEffect(() => {
    setPage(1);
  }, [globalSearch, filterSupplier, filterCategory, quickView]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshToken]);

  const rows: StockItemPayload[] = data?.results ?? [];

  /* ── client-side quick-view filter ── */
  const filteredRows = useMemo(() => {
    if (quickView === "all") return rows;
    return rows.filter((r) => {
      switch (quickView) {
        case "low_stock":   return r.available <= 0;
        case "backordered": return r.backordered > 0;
        case "has_orders":  return r.ordered > 0;
        default:            return true;
      }
    });
  }, [rows, quickView]);

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

  /* ===================== TABLE COLUMNS ===================== */

  const columns = ["Name", "Description", "Category", "Supplier", "", "On Hand", "Ordered", "Reserved", "Available", "Backord.", "Actions"];

  /* ===================== RENDER ===================== */

  return (
    <div>
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      <MDTable
        title="Stock Items"
        columns={columns}
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        onPageChange={setPage}
      >
        {filteredRows.map((row) => (
          <tr
            key={row.id}
            className="hover:bg-blue-50/40 transition cursor-pointer group"
          >
            {/* Name */}
            <td
              className={`${rowPadding} font-semibold text-blue-600 hover:underline text-sm whitespace-nowrap`}
              onClick={() => navigate(`/products/${row.product_id}`)}
            >
              {row.name}
            </td>
            {/* Description */}
            <td
              className={`${rowPadding} max-w-[200px]`}
              onClick={() => navigate(`/products/${row.product_id}`)}
            >
              <span className="block truncate text-sm text-gray-600" title={row.description ?? ""}>
                {row.description ?? "—"}
              </span>
            </td>
            {/* Category */}
            <td
              className={`${rowPadding} text-sm text-gray-700`}
              onClick={() => navigate(`/products/${row.product_id}`)}
            >
              {row.category_name ?? "—"}
            </td>
            {/* Supplier */}
            <td
              className={`${rowPadding} text-sm text-gray-700 whitespace-nowrap`}
              onClick={() => navigate(`/products/${row.product_id}`)}
            >
              {row.supplier_name ?? "—"}
            </td>
            {/* spacer */}
            <td className="w-4" />
            {/* On Hand */}
            <td
              className={`${rowPadding} text-center text-sm`}
              onClick={() => navigate(`/products/${row.product_id}`)}
            >
              {row.on_hand}
            </td>
            {/* Ordered */}
            <td
              className={`${rowPadding} text-center text-sm`}
              onClick={() => navigate(`/products/${row.product_id}`)}
            >
              {row.ordered}
            </td>
            {/* Reserved */}
            <td
              className={`${rowPadding} text-center text-sm`}
              onClick={() => navigate(`/products/${row.product_id}`)}
            >
              {row.reserved}
            </td>
            {/* Available with progress bar */}
            <td
              className={`${rowPadding} text-center`}
              onClick={() => navigate(`/products/${row.product_id}`)}
            >
              <AvailableBar available={row.available} onHand={row.on_hand} />
            </td>
            {/* Backordered */}
            <td
              className={`${rowPadding} text-center text-sm`}
              onClick={() => navigate(`/products/${row.product_id}`)}
            >
              {row.backordered > 0 ? (
                <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 font-semibold">
                  {row.backordered}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </td>
            {/* Actions */}
            <td className={`${rowPadding} text-right pr-3`}>
              <div className="flex items-center justify-end gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
                  className="text-gray-500 hover:text-blue-600 transition"
                  title="Edit"
                >
                  <PencilIcon />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    alert("Delete functionality not yet available for stock items.");
                  }}
                  className="text-gray-500 hover:text-red-600 transition"
                  title="Delete"
                >
                  <TrashIcon />
                </button>
              </div>
            </td>
          </tr>
        ))}

        {loading && (
          <tr>
            <td colSpan={columns.length} className="text-center py-8 text-gray-400 text-sm">
              Loading stock items…
            </td>
          </tr>
        )}

        {!loading && filteredRows.length === 0 && (
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
              <h2 className="text-xl font-semibold">{editRow.name}</h2>
              <button className="cursor-pointer hover:scale-110 transition" onClick={closeModal}>✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <label className="font-medium">Description</label>
                <div className="p-2 bg-gray-100 rounded">{editRow.description ?? "—"}</div>
              </div>
              <div>
                <label className="font-medium">Supplier</label>
                <div className="p-2 bg-gray-100 rounded">{editRow.supplier_name}</div>
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
    </div>
  );
}
