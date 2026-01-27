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
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

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

  const handleToggleItem = (itemId: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleToggleAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item.id)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white shadow-sm border overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-semibold text-white bg-[#313545]">
          Line Items
        </div>
        <table className="table w-full">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="w-12">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={items.length > 0 && selectedItems.size === items.length}
                  onChange={handleToggleAll}
                />
              </th>
              <th className="pl-7">Part Number</th>
              <th>Description</th>
              <th>Qty Ordered</th>
              <th>Qty Fulfilled</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-4 text-gray-400">
                  Loading items…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-gray-400 italic">
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
                  isSelected={selectedItems.has(item.id)}
                  onToggleSelect={() => handleToggleItem(item.id)}
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
