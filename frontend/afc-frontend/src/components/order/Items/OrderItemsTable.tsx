import { useEffect, useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { OrderItemPayload } from "../../../api/orderDetail";
import type { Product } from "../../../api/products";
import { fetchProducts } from "../../../api/products";
import { reorderOrderItems } from "../../../api/orderDetail";
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
  const [localItems, setLocalItems] = useState<OrderItemPayload[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const isCompleted = orderStatus === "Completed";

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update local items when props change
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(items.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (itemId: number, checked: boolean) => {
    const item = items.find(i => i.id === itemId);
    
    if (item && item.is_separator) {
      // When selecting a separator, select all items in its section
      const itemIndex = items.findIndex(i => i.id === itemId);
      const sectionItems: number[] = [];
      
      // Add the separator itself
      sectionItems.push(itemId);
      
      // Find all items until the next separator or end of list
      for (let i = itemIndex + 1; i < items.length; i++) {
        if (items[i].is_separator) {
          break; // Stop at next separator
        }
        sectionItems.push(items[i].id);
      }
      
      const newSelected = new Set(selectedItems);
      if (checked) {
        sectionItems.forEach(id => newSelected.add(id));
      } else {
        sectionItems.forEach(id => newSelected.delete(id));
      }
      setSelectedItems(newSelected);
    } else {
      // Regular item selection
      const newSelected = new Set(selectedItems);
      if (checked) {
        newSelected.add(itemId);
      } else {
        newSelected.delete(itemId);
      }
      setSelectedItems(newSelected);
    }
  };

  const allSelected = items.length > 0 && selectedItems.size === items.length;
  const someSelected = selectedItems.size > 0 && selectedItems.size < items.length;

  // Handle drag end
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = localItems.findIndex((item) => item.id === active.id);
    const newIndex = localItems.findIndex((item) => item.id === over.id);

    // Optimistically update local state
    const newItems = arrayMove(localItems, oldIndex, newIndex);
    setLocalItems(newItems);

    try {
      // Call backend to persist the change
      await reorderOrderItems(orderId, active.id as number, newIndex);
      // Refresh to get the latest from server
      onRefresh();
    } catch (error) {
      console.error("Failed to reorder items:", error);
      // Revert on error
      setLocalItems(items);
    }
  }

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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="table w-full">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="w-8"></th>
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
            <SortableContext
              items={localItems.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-gray-400">
                      Loading items…
                    </td>
                  </tr>
                ) : localItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-gray-400 italic">
                      No line items yet
                    </td>
                  </tr>
                ) : (
                  localItems.map((item) => (
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
            </SortableContext>
          </table>
        </DndContext>
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
          items={localItems}
          onCreated={handleFormCreated}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}
