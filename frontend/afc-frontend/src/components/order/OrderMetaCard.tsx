import { useState } from "react";

export default function OrderMetaCard() {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-6 py-3 text-sm font-semibold"
      >
        <span>Order details</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-6 pb-4 text-sm text-gray-600 grid grid-cols-2 gap-4">
          <div>
            <p className="font-medium">Customer</p>
            <p>MediHealth</p>
          </div>

          <div>
            <p className="font-medium">Created</p>
            <p>2025-02-03</p>
          </div>

          <div>
            <p className="font-medium">Due Date</p>
            <p>2025-02-10</p>
          </div>

          <div>
            <p className="font-medium">Reference</p>
            <p>Quarterly replenishment</p>
          </div>
        </div>
      )}
    </div>
  );
}
