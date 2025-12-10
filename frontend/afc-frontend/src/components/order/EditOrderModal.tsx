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

  // 🔹 MINIMAL CHANGE: convert items to state
  const [items, setItems] = useState<LineItem[]>([
    {
      id: 1,
      name: "Filter Item 1",
      orderedQty: 10,
      fulfilledQty: 0,
      unitPrice: 12.5,
    },
  ]);

  const [page, setPage] = useState(1);
  const pageSize = 5;

  const pagedItems = items.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(items.length / pageSize);

  // 🔹 MINIMAL CHANGE: function to add a new blank item
  const addItem = () => {
    const newId = items.length + 1;
    const newItem: LineItem = {
      id: newId,
      name: "",
      orderedQty: 0,
      fulfilledQty: 0,
      unitPrice: 0,
    };
    setItems([...items, newItem]);
  };

  // 🔹 MINIMAL CHANGE: update item fields
  const updateItem = (id: number, field: keyof LineItem, value: any) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // 🔹 MINIMAL CHANGE: delete item
  const deleteItem = (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div
          className="px-8 py-5 text-white text-xl font-semibold"
          style={{ background: "linear-gradient(90deg,#3A7BD5,#2B60C8)" }}
        >
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

            {/* 🔹 Add Item Button */}
            <button
              className="btn btn-sm btn-success ml-2 mb-3"
              onClick={addItem}
            >
              + Add Item
            </button>

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
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        className="input input-bordered input-sm w-full"
                        value={item.name}
                        onChange={(e) =>
                          updateItem(item.id, "name", e.target.value)
                        }
                      />
                    </td>

                    <td className="py-3 px-3">
                      <input
                        type="number"
                        className="input input-bordered input-sm w-20"
                        value={item.orderedQty}
                        onChange={(e) =>
                          updateItem(item.id, "orderedQty", Number(e.target.value))
                        }
                      />
                    </td>

                    <td className="py-3 px-3">
                      <input
                        type="number"
                        className="input input-bordered input-sm w-20"
                        value={item.fulfilledQty}
                        onChange={(e) =>
                          updateItem(item.id, "fulfilledQty", Number(e.target.value))
                        }
                      />
                    </td>

                    <td className="py-3 px-3">
                      <input
                        type="number"
                        className="input input-bordered input-sm w-24"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateItem(item.id, "unitPrice", Number(e.target.value))
                        }
                      />
                    </td>

                    <td className="py-3 px-3">
                      <button
                        className="btn btn-xs btn-error text-white"
                        onClick={() => deleteItem(item.id)}
                      >
                        Delete 🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
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
