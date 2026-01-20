import { useState } from "react";
import type { OrderSectionPayload } from "../../../api/orderDetail";
import { deleteOrderSection } from "../../../api/orderDetail";
import type { Product } from "../../../api/products";
import OrderItemRow from "./OrderItemRow";
import AddOrderItemForm from "./AddOrderItem";

interface Props {
  section: OrderSectionPayload;
  orderId: number;
  orderType: "incoming" | "outgoing";
  products: Product[];
  orderStatus: string;
  onRefresh: () => void;
  txnRefreshKey: number;
}

export default function OrderSectionCard({
  section,
  orderId,
  orderType,
  products,
  onRefresh,
  orderStatus,
  txnRefreshKey,
}: Props) {
  const [open, setOpen] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);

  const isCompleted = orderStatus === "Completed";

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
          
          <div className="flex gap-x-2">
            <div
              className={`text-xs px-2 py-1 rounded-full ${
                section.status === "Completed"
                  ? "bg-green-100 text-green-700"
                  : section.status === "Partially Fulfilled"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {section.status}
            </div>

            {!isCompleted && (
              <button
              className="btn btn-xs btn-outline text-white border-white"
              onClick={(e) => {
                e.stopPropagation();
                setShowAddItem((s) => !s);
              }}
            >
              + Add Item
            </button>
          )}

            {section.items.length === 0 && (
              <button
                className="btn btn-xs btn-error"
                onClick={async (e) => {
                  e.stopPropagation();

                  if (!confirm("Delete this empty section?")) return;

                  await deleteOrderSection(section.id);
                  onRefresh();
                }}
              >
                Delete Section
              </button>
            )}
          </div>
      </div>

      {open && (
        <div className="space-y-3">
          {section.items.length > 0 && (
            <table className="table table-sm w-full">
              <thead>
                <tr className="text-xs uppercase text-gray-500">
                  <th className="pl-7">Part Number</th>
                  <th>Qty Requested</th>
                  <th>Qty Fulfilled</th>
                  <th>Comment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item) => (
                  <OrderItemRow
                    key={item.id}
                    item={item}
                    orderType={orderType}
                    onRefresh={onRefresh}
                    txnRefreshKey={txnRefreshKey}
                  />
                ))}
              </tbody>
            </table>
          )}

          {section.items.length === 0 && (
            <p className="pb-4 text-sm text-gray-400 italic pl-7 pt-2">
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
              onRefresh={onRefresh}
            />
          )}
        </div>
      )}
    </div>
  );
}
