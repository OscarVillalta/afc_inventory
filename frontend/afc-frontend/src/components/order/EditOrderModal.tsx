import React, { useState } from "react";

interface LineItem {
  id: number;
  name: string;
  orderedQty: number;
  fulfilledQty: number;
  unitPrice: number;
}

interface EditOrderModalProps {
  orderId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditOrderModal({
  orderId,
  isOpen,
  onClose,
}: EditOrderModalProps) {
  if (!isOpen) return null;

  // TEMP DATA
  const [customer, setCustomer] = useState("MediHealth");
  const [description, setDescription] = useState("Filter replenishment order");
  const [creationDate, setCreationDate] = useState("2024-04-02");
  const [expectedDate, setExpectedDate] = useState("");

  // MANY LINE ITEMS (pagination)
  const allItems: LineItem[] = Array.from({ length: 27 }).map((_, i) => ({
    id: i + 1,
    name: `Filter Item ${i + 1}`,
    orderedQty: 10,
    fulfilledQty: 0,
    unitPrice: 12.5,
  }));

  const [page, setPage] = useState(1);
  const pageSize = 5;

  const pagedItems = allItems.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(allItems.length / pageSize);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-1 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className="px-8 py-5 text-white text-xl font-semibold"
          style={{ background: "linear-gradient(90deg,#3A7BD5,#2B60C8)" }}>
          Edit Order #{orderId}
        </div>

        {/* CONTENT */}
        <div className="px-8 py-6 overflow-y-auto space-y-6">

          {/* CUSTOMER */}
          <div>
            <label className="text-sm font-semibold">Customer / Supplier</label>
            <select
              className="select select-bordered w-full mt-1"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            >
              <option>MediHealth</option>
              <option>ClearSky Industries</option>
              <option>UrbanCare</option>
            </select>
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className="text-sm font-semibold">Description</label>
            <input
              type="text"
              className="input input-bordered w-full mt-1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* DATES */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-semibold">Creation Date</label>
              <input
                type="date"
                className="input input-bordered w-full mt-1"
                value={creationDate}
                onChange={(e) => setCreationDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-semibold">Expected Date</label>
              <input
                type="date"
                className="input input-bordered w-full mt-1"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
          </div>

          {/* ITEMS TABLE */}
          <div>
            <label className="text-sm font-semibold">Items</label>

            <table className="w-full mt-3 border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-gray-600 text-xs uppercase tracking-wide">
                  <th>Item Name</th>
                  <th>Ordered Qty</th>
                  <th>Fulfilled</th>
                  <th>Unit Price</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {pagedItems.map((item) => (
                  <tr key={item.id} className="bg-gray-50 rounded-xl shadow-sm">
                    <td className="py-3 px-3">{item.name}</td>

                    <td className="py-3 px-3">
                      <input
                        type="number"
                        className="input input-bordered input-sm w-20"
                        value={item.orderedQty}
                        readOnly
                      />
                    </td>

                    <td className="py-3 px-3">
                      <input
                        type="number"
                        className="input input-bordered input-sm w-20"
                        value={item.fulfilledQty}
                        readOnly
                      />
                    </td>

                    <td className="py-3 px-3">${item.unitPrice.toFixed(2)}</td>

                    <td className="py-3 px-3">
                      <button className="btn btn-xs btn-error text-white">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* PAGINATION */}
            <div className="flex justify-center gap-2 mt-4">
              <button
                className="btn btn-sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Prev
              </button>

              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  className={`btn btn-sm ${page === i + 1 ? "btn-primary" : ""}`}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}

              <button
                className="btn btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-4 px-8 py-4 bg-gray-50 border-t">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary text-white">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
