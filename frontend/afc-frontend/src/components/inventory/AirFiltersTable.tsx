import { useEffect, useState } from "react";
import MDTable from "../table/MDtable";
import { fetchAirFilters } from "../../api/airfilters";
import type { AirFilterResponse } from "../../api/airfilters";
import { autocommitTxn } from "../../api/transactions";
import type { createTxnRequest } from "../../api/transactions";

/* ===================== TYPES ===================== */

interface EditFormState {
  id: number;
  part_number: string;
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

/* ===================== COMPONENT ===================== */

export default function AirFiltersTable() {
  const [filters, setFilters] = useState<AirFilterResponse>();
  const [page, setPage] = useState(1);

  /* Modal state */
  const [openEdit, setOpenEdit] = useState(false);
  const [editRow, setEditRow] = useState<EditFormState | null>(null);
  const [originalOnHand, setOriginalOnHand] = useState<number>(0);

  /* Transaction fields */
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const REASONS = ["shipment", "receive", "adjustment", "rollback"];

  /* ===================== DATA LOAD ===================== */

  const loadData = () => {
    fetchAirFilters(page, 25).then((data) => {
      setFilters(data);
    });
  };

  useEffect(() => {
    loadData();
  }, [page]);

  /* ===================== MODAL HANDLERS ===================== */

  const handleEdit = (row: any) => {
    setEditRow({
      id: row.id,
      part_number: row.part_number,
      supplier_name: row.supplier_name,
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

  /* ===================== SAVE TRANSACTION ===================== */

  const handleSave = async () => {
    if (!editRow) return;

    const delta = editRow.on_hand - originalOnHand;

    if (delta === 0) {
      alert("No quantity change detected.");
      return;
    }

    if (!reason) {
      alert("Please select a reason.");
      return;
    }

    const payload: createTxnRequest = {
      product_id: editRow.id,
      quantity_delta: delta,
      reason,
      note: notes,
    };

    try {
      setSaving(true);
      await autocommitTxn(payload);
      closeModal();
      loadData(); // refresh table
    } catch (err) {
      console.error(err);
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
          "On Hand",
          "Ordered",
          "Reserved",
          "Edit",
        ]}
        page={page}
        pageSize={filters?.limit ?? 25}
        total={filters?.total ?? 0}
        onPageChange={setPage}
      >
        {filters?.results.map((row) => (
          <tr key={row.id} className="bg-white shadow-sm rounded-xl">
            <td className="py-3 px-2 font-semibold">{row.part_number}</td>
            <td className="py-3 px-2">{row.supplier_name ?? "—"}</td>
            <td className="py-3 px-2">{row.filter_category ?? "—"}</td>
            <td className="py-3 px-2">
              {row.height} x {row.width} x {row.depth}
            </td>
            <td className="py-3 px-2">{row.merv_rating}</td>
            <td className="py-3 px-2">{row.on_hand}</td>
            <td className="py-3 px-2">{row.ordered}</td>
            <td className="py-3 px-2">{row.reserved}</td>
            <td
              className="py-3 px-2 cursor-pointer hover:scale-110 transition"
              onClick={() => handleEdit(row)}
            >
              ✏️
            </td>
          </tr>
        ))}
      </MDTable>

      {/* ===================== EDIT MODAL ===================== */}
      {openEdit && editRow && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-white w-[600px] rounded-xl shadow-xl p-6">

            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editRow.part_number}
              </h2>
              <button onClick={closeModal}>✕</button>
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

              <label className="font-medium text-sm mt-4 block">Notes</label>
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
