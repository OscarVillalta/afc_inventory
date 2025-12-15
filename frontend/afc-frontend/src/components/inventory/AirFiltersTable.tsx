import MDTable from "../table/MDtable";
import { useEffect, useState } from "react";
import { fetchAirFilters } from "../../api/airfilters";
import type { AirFilterPayload, AirFilterResponse } from "../../api/airfilters";
import { autocommitTxn } from "../../api/transactions";
import type { createTxnRequest } from "../../api/transactions";

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

export default function AirFiltersTable() {
  const [filters, setFilters] = useState<AirFilterResponse>();
  const [page, setPage] = useState(1);

  // ✨ Modal State
  const [openEdit, setOpenEdit] = useState(false);
  const [editRow, setEditRow] = useState<EditFormState | null>(null);

  // Reason + Notes
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const REASONS = [
    "shipment",
    "receive",
    "adjustment",
    "rollback",
  ];

  useEffect(() => {
    fetchAirFilters(page, 25).then((data) => {
      setFilters(data);
    });
  }, [page]);

  // Open modal + load row
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

    setReason("");
    setNotes("");
    setOpenEdit(true);
  };

  const closeModal = () => {
    setOpenEdit(false);
  };

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
        total={filters?.total ?? 100}
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
                <path
                  d="M13 18H21"
                  stroke="#000"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  d="M13 28H25"
                  stroke="#000"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
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

      {/* ✨ EDIT MODAL */}
      {openEdit && editRow && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-white w-[600px] rounded-xl shadow-xl p-6 animate-fadeIn">

            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                PRODUCT: {editRow.part_number}
              </h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={closeModal}
              >
                ✕
              </button>
            </div>

            {/* Core Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-sm font-medium">Supplier</label>
                <div className="p-2 bg-gray-100 rounded">{editRow.supplier_name}</div>
              </div>

              <div>
                <label className="text-sm font-medium">Category</label>
                <div className="p-2 bg-gray-100 rounded">{editRow.filter_category}</div>
              </div>

              <div>
                <label className="text-sm font-medium">Dimensions</label>
                <div className="p-2 bg-gray-100 rounded">
                  {editRow.height} x {editRow.width} x {editRow.depth}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">MERV</label>
                <div className="p-2 bg-gray-100 rounded">{editRow.merv_rating}</div>
              </div>
            </div>

            {/* Editable Inventory Fields */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-sm font-medium">On Hand</label>
                <input
                  type="number"
                  min="0"
                  className="input input-bordered w-full"
                  value={editRow.on_hand}
                  onChange={(e) =>
                    setEditRow({ ...editRow, on_hand: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            {/* Reason + Notes */}
            <div className="mb-6">
              <label className="text-sm font-medium">Reason</label>
              <select
                className="select select-bordered w-full mt-1"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="">Select a reason...</option>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <label className="text-sm font-medium mt-4 block">Notes</label>
              <textarea
                className="textarea textarea-bordered w-full mt-1"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 mt-4">
              <button className="btn" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
