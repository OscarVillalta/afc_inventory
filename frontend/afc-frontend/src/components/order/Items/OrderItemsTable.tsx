import { useEffect, useState, useRef, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
import LineItemsMenu from "./LineItemsMenu";

interface Props {
  orderId: number;
  orderStatus: string;
  orderType: "incoming" | "outgoing";
  items: OrderItemPayload[];
  loading: boolean;
  onRefresh: () => void;
  txnRefreshKey: number;
  selectedItems: Set<number>;
  onSelectedItemsChange: (items: Set<number>) => void;
}

export default function OrderItemsTable({
  orderId,
  orderStatus,
  orderType,
  items,
  loading,
  onRefresh,
  txnRefreshKey,
  selectedItems,
  onSelectedItemsChange,
}: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [localItems, setLocalItems] = useState<OrderItemPayload[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Search and filter states
  const [partNumberFilter, setPartNumberFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [descriptionFilter, setDescriptionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

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

  // Filter and paginate items (memoized for performance)
  const { items: displayedItems, totalItems, totalPages } = useMemo(() => {
    let filtered = [...localItems];

    // Apply filters
    if (partNumberFilter || descriptionFilter || statusFilter || sectionFilter) {
      if (sectionFilter) {
        // Special logic for section search
        // Find matching sections and include them plus their items and the next section
        const matchingSections: OrderItemPayload[] = [];
        let i = 0;
        
        while (i < filtered.length) {
          const item = filtered[i];
          
          if (item.is_separator) {
            // Check if section matches
            const sectionName = item.note || "";
            if (sectionName.toLowerCase().includes(sectionFilter.toLowerCase())) {
              // Add the matching section
              matchingSections.push(item);
              i++;
              
              // Add all items under this section (until next separator)
              while (i < filtered.length && !filtered[i].is_separator) {
                matchingSections.push(filtered[i]);
                i++;
              }
              
              // Add the next section separator if it exists (for context)
              if (i < filtered.length && filtered[i].is_separator) {
                matchingSections.push(filtered[i]);
                i++;
              }
              continue;
            }
          }
          i++;
        }
        
        filtered = matchingSections;
      } else {
        // Regular filtering for non-section searches
        filtered = filtered.filter((item) => {
          // Separators are included if they pass the filters or if any filter is active
          if (item.is_separator) {
            return true; // Keep separators to maintain structure
          }

          const matchesPartNumber = !partNumberFilter || 
            item.part_number.toLowerCase().includes(partNumberFilter.toLowerCase());
          
          const matchesDescription = !descriptionFilter || 
            (item.note && item.note.toLowerCase().includes(descriptionFilter.toLowerCase()));
          
          const matchesStatus = !statusFilter || 
            item.status === statusFilter;

          return matchesPartNumber && matchesDescription && matchesStatus;
        });
      }
    }

    // Calculate pagination
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = filtered.slice(startIndex, endIndex);

    return {
      items: paginatedItems,
      totalItems,
      totalPages,
    };
  }, [localItems, partNumberFilter, sectionFilter, descriptionFilter, statusFilter, currentPage, itemsPerPage]);

  // Update local items when props change
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  // Reset to page 1 if current page is invalid after filtering
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all displayed items on the current page
      onSelectedItemsChange(new Set(displayedItems.map(item => item.id)));
    } else {
      onSelectedItemsChange(new Set());
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
      onSelectedItemsChange(newSelected);
    } else {
      // Regular item selection
      const newSelected = new Set(selectedItems);
      if (checked) {
        newSelected.add(itemId);
      } else {
        newSelected.delete(itemId);
      }
      onSelectedItemsChange(newSelected);
    }
  };

  const allSelected = displayedItems.length > 0 && displayedItems.every(item => selectedItems.has(item.id));
  const someSelected = displayedItems.some(item => selectedItems.has(item.id)) && !allSelected;

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
    onSelectedItemsChange(new Set());
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
      {/* Line Items Menu with Search and Pagination */}
      <LineItemsMenu
        partNumberFilter={partNumberFilter}
        setPartNumberFilter={setPartNumberFilter}
        sectionFilter={sectionFilter}
        setSectionFilter={setSectionFilter}
        descriptionFilter={descriptionFilter}
        setDescriptionFilter={setDescriptionFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        setItemsPerPage={setItemsPerPage}
        totalItems={totalItems}
      />

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
              items={displayedItems.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-gray-400">
                      Loading items…
                    </td>
                  </tr>
                ) : displayedItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-gray-400 italic">
                      {localItems.length === 0 ? "No line items yet" : "No items match the current filters"}
                    </td>
                  </tr>
                ) : (
                  displayedItems.map((item) => (
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
