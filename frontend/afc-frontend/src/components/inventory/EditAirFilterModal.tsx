import React from "react";

interface EditAirFilterModalProps {
  open: boolean;
  onClose: () => void;
  filter: any | null;
  onSave: (updated: any) => void;
}

export default function EditAirFilterModal({
  open,
  onClose,
  filter,
  onSave,
}: EditAirFilterModalProps) {
  if (!open || !filter) return null;

  // Local state for fields
  const [onHand, setOnHand] = React.useState(filter.on_hand ?? 0);
  const [ordered, setOrdered] = React.useState(filter.ordered ?? 0);
  const [reserved, setReserved] = React.useState(filter.reserved ?? 0);

  const [reason, setReason] = React.useState("");
  const [notes, setNotes] = React.useState("");

  function handleSave() {
    onSave({
      ...filter,
      on_hand: onHand,
      ordered: ordered,
      reserved: reserved,
      reason,
      notes
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white w-[480px] rounded-xl shadow-xl p-6">
        {/* Title */}
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Edit Air Filter
        </h2>

        {/* Part Number (read-only) */}
        <div className="mb-4">
          <label className="font-medium text-sm text-gray-600">Part Number</label>
          <div className="p-2 mt-1 border rounded-lg bg-gray-100 text-gray-700">
            {filter.part_number}
          </div>
        </div>

        {/* Editable Fields */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="font-medium text-sm text-gray-600">On Hand</label>
            <input
              type="number"
              className="input input-bordered w-full mt-1"
              value={onHand}
              onChange={(e) => setOnHand(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="font-medium text-sm text-gray-600">Ordered</label>
            <input
              type="number"
              className="input input-bordered w-full mt-1"
              value={ordered}
              onChange={(e) => setOrdered(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="font-medium text-sm text-gray-600">Reserved</label>
            <input
              type="number"
              className="input input-bordered w-full mt-1"
              value={reserved}
              onChange={(e) => setReserved(Number(e.target.value))}
            />
          </div>
        </div>

        {/* 🔥 NEW SECTION — Reason + Notes */}
        <div className="mt-4">
          <label className="font-medium text-sm text-gray-600">Reason</label>
          <select
            className="select select-bordered w-full mt-1"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="">Select a reason...</option>
            <option value="correction">Inventory Correction</option>
            <option value="lost_damage">Lost / Damaged</option>
            <option value="customer_return">Customer Return</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </div>

        <div className="mt-3">
          <label className="font-medium text-sm text-gray-600">Notes</label>
          <textarea
            className="textarea textarea-bordered w-full mt-1"
            placeholder="Add additional notes..."
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          ></textarea>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
