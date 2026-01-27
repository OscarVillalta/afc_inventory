import { useEffect, useState } from "react";
import type { OrderItemPayload } from "../../../api/orderDetail";
import type { Product } from "../../../api/products";
import { fetchProducts } from "../../../api/products";
import AddOrderItemForm from "../Sections/AddOrderItem";
import OrderItemRow from "../Sections/OrderItemRow";

interface Props {
  orderId: number;
  orderStatus: string;
  orderType: "incoming" | "outgoing";
  items: OrderItemPayload[];
  loading: boolean;
  onRefresh: () => void;
  txnRefreshKey: number;
}

export default function OrderItemsTable({
  orderId,
  orderStatus,
  orderType,
  items,
  loading,
  onRefresh,
  txnRefreshKey,
}: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  const isCompleted = orderStatus === "Completed";

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => console.error("Failed to load products"));
  }, []);

  const handleFormCreated = () => {
    setShowAddForm(false);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white shadow-sm border overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-semibold text-gray-700">
          Line Items
        </div>
        <table className="table w-full">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="pl-7">Part #</th>
              <th>Qty Ordered</th>
              <th>Qty Fulfilled</th>
              <th>Note</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-4 text-gray-400">
                  Loading items…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-gray-400 italic">
                  No line items yet
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <OrderItemRow
                  key={item.id}
                  item={item}
                  orderType={orderType}
                  onRefresh={onRefresh}
                  txnRefreshKey={txnRefreshKey}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isCompleted && !showAddForm && (
        <button
          className="btn btn-sm btn-primary"
          onClick={() => setShowAddForm(true)}
        >
          + Add Line Item
        </button>
      )}

      {!isCompleted && showAddForm && (
        <AddOrderItemForm
          orderId={orderId}
          products={products}
          onCreated={handleFormCreated}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}
