import { useEffect, useState, useRef } from "react";
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
  const selectAllRef = useRef<HTMLInputElement>(null);

  const isCompleted = orderStatus === "Completed";

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(items.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (itemId: number, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  const allSelected = items.length > 0 && selectedItems.size === items.length;
  const someSelected = selectedItems.size > 0 && selectedItems.size < items.length;

  // Reset selected items when items list changes
  useEffect(() => {
    setSelectedItems(new Set());
  }, [items.length]);

  // Update indeterminate state for select all checkbox
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

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
        <div className="px-4 py-3 border-b text-sm font-semibold text-white bg-[#313545]">
          Line Items
        </div>
        <table className="table w-full">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="w-12">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="checkbox checkbox-s"
                  checked={allSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  aria-label="Select all items"
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
                  onSelectChange={(checked) => handleSelectItem(item.id, checked)}
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
