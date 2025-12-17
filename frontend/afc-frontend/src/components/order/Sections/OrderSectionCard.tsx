import { useState } from "react";
import type { OrderSectionPayload } from "../../../api/orderDetail";
import type { Product } from "../../../api/products";
import OrderItemRow from "./OrderItemRow";
import AddOrderItemForm from "./AddOrderItem";

interface Props {
  section: OrderSectionPayload;
  orderId: number;
  orderType: "incoming" | "outgoing";
  products: Product[];
  onRefresh: () => void;
}

export default function OrderSectionCard({
  section,
  orderId,
  orderType,
  products,
  onRefresh,
}: Props) {
  const [open, setOpen] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);

  return (
    <div className="rounded-xl bg-white shadow-sm border">
      {/* HEADER */}
      <div
        className={`flex justify-between items-center px-4 py-3 cursor-pointer bg-[#2b7fff] ${
          open ? "rounded-t-xl" : "rounded-xl"
        }`}
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <h3 className="font-bold text-white">
            {section.title}
          </h3>
          {section.description && (
            <p className="text-sm text-blue-100">
              {section.description}
            </p>
          )}
        </div>

        <button
          className="btn btn-xs btn-outline text-white border-white"
          onClick={(e) => {
            e.stopPropagation();
            setShowAddItem((s) => !s);
          }}
        >
          + Add Item
        </button>
      </div>

      {open && (
        <div className=" pb-4 space-y-3">
          {section.items.length > 0 && (
            <table className="table table-sm w-full">
              <thead>
                <tr className="text-xs uppercase text-gray-500">
                  <th>Part Number</th>
                  <th>Qty Requested</th>
                  <th>Qty Fulfilled</th>
                  <th>Comment</th>
                  <th>Status</th>
                  <th className="text-center">Completion</th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item) => (
                  <OrderItemRow
                    key={item.id}
                    item={item}
                    orderType={orderType}
                  />
                ))}
              </tbody>
            </table>
          )}

          {section.items.length === 0 && (
            <p className="text-sm text-gray-400 italic pl-7 pt-2">
              No items in this section
            </p>
          )}

          {showAddItem && (
            <AddOrderItemForm
              orderId={orderId}
              sectionId={section.id}
              products={products}
              onCreated={() => {
                setShowAddItem(false);
                onRefresh();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
