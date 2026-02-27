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
import OrderTotalsTab from "./OrderTotalsTab";

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
  const lastSelectedIndexRef = useRef<number | null>(null);
  const [activeTab, setActiveTab] = useState<"lineItems" | "totals">("lineItems");

  // Search and filter states
  const [partNumberFilter, setPartNumberFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [sectionSeparatorFilter, setSectionSeparatorFilter] = useState("");
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
  const { filteredItems, items: displayedItems, totalItems, totalPages } = useMemo(() => {
    let filtered = [...localItems];

    // Apply Section_Separator filter first (shows all items between matching Section_Separator and next one)
    if (sectionSeparatorFilter) {
      const matchingSections: OrderItemPayload[] = [];
      let i = 0;
      
      while (i < filtered.length) {
        const item = filtered[i];
        
        if (item.type === "Section_Separator") {
          const sectionName = item.note || "";
          if (sectionName.toLowerCase().includes(sectionSeparatorFilter.toLowerCase())) {
            // Add the matching Section_Separator
            matchingSections.push(item);
            i++;
            
            // Add all items until next Section_Separator (including Unit_Separators)
            while (i < filtered.length && filtered[i].type !== "Section_Separator") {
              matchingSections.push(filtered[i]);
              i++;
            }
            continue;
          }
        }
        i++;
      }
      
      filtered = matchingSections;
    }

    // Apply filters
    if (partNumberFilter || descriptionFilter || statusFilter || sectionFilter) {
      if (sectionFilter) {
        // Special logic for section search
        // Find matching Unit_Separator sections and include them plus their items
        // Always include Section_Separators for structural context
        const matchingSections: OrderItemPayload[] = [];
        const addedIds = new Set<number>();
        let i = 0;
        
        while (i < filtered.length) {
          const item = filtered[i];
          
          // Always include Section_Separators for structural context
          if (item.type === "Section_Separator" && !addedIds.has(item.id)) {
            matchingSections.push(item);
            addedIds.add(item.id);
            i++;
            continue;
          }

          if (item.type === "Unit_Separator") {
            // Check if section matches
            const sectionName = item.note || "";
            if (sectionName.toLowerCase().includes(sectionFilter.toLowerCase())) {
              // Add the matching section
              if (!addedIds.has(item.id)) {
                matchingSections.push(item);
                addedIds.add(item.id);
              }
              i++;
              
              // Add all items under this section (until next separator)
              while (i < filtered.length && filtered[i].type !== "Unit_Separator" && filtered[i].type !== "Section_Separator") {
                if (!addedIds.has(filtered[i].id)) {
                  matchingSections.push(filtered[i]);
                  addedIds.add(filtered[i].id);
                }
                i++;
              }
              
              // Don't increment i here - let the loop check the next separator
              continue;
            }
          }
          i++;
        }

        filtered = matchingSections.filter((item) => {
          // Separators are included if they pass the filters or if any filter is active
          if (item.type === "Unit_Separator" || item.type === "Section_Separator") {
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

      } else {
        // Regular filtering for non-section searches
        filtered = filtered.filter((item) => {
          // Separators are included if they pass the filters or if any filter is active
          if (item.type === "Unit_Separator" || item.type === "Section_Separator") {
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
      filteredItems: filtered,
      items: paginatedItems,
      totalItems,
      totalPages,
    };
  }, [localItems, partNumberFilter, sectionFilter, sectionSeparatorFilter, descriptionFilter, statusFilter, currentPage, itemsPerPage]);

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
      // Select all filtered items across all pages
      onSelectedItemsChange(new Set(filteredItems.map(item => item.id)));
    } else {
      onSelectedItemsChange(new Set());
    }
  };

  const handleSelectItem = (itemId: number, checked: boolean, shiftKey: boolean = false) => {
    const item = filteredItems.find(i => i.id === itemId);
    const currentIndex = displayedItems.findIndex(i => i.id === itemId);
    
    if (item && item.type === "Section_Separator") {
      // Section_Separator: select all items (regardless of type) until next Section_Separator
      const itemIndex = filteredItems.findIndex(i => i.id === itemId);
      const sectionItems: number[] = [itemId];
      
      for (let i = itemIndex + 1; i < filteredItems.length; i++) {
        if (filteredItems[i].type === "Section_Separator") {
          break;
        }
        sectionItems.push(filteredItems[i].id);
      }
      
      const newSelected = new Set(selectedItems);
      if (checked) {
        sectionItems.forEach(id => newSelected.add(id));
      } else {
        sectionItems.forEach(id => newSelected.delete(id));
      }
      onSelectedItemsChange(newSelected);
      lastSelectedIndexRef.current = currentIndex;
    } else if (item && item.type === "Unit_Separator") {
      // Unit_Separator: select items until next separator of any type
      const itemIndex = filteredItems.findIndex(i => i.id === itemId);
      const sectionItems: number[] = [itemId];
      
      for (let i = itemIndex + 1; i < filteredItems.length; i++) {
        if (filteredItems[i].type === "Unit_Separator" || filteredItems[i].type === "Section_Separator") {
          break;
        }
        sectionItems.push(filteredItems[i].id);
      }
      
      const newSelected = new Set(selectedItems);
      if (checked) {
        sectionItems.forEach(id => newSelected.add(id));
      } else {
        sectionItems.forEach(id => newSelected.delete(id));
      }
      onSelectedItemsChange(newSelected);
      lastSelectedIndexRef.current = currentIndex;
    } else if (shiftKey && lastSelectedIndexRef.current !== null && checked) {
      // Shift-click: select range between last selected and current
      const startIndex = Math.min(lastSelectedIndexRef.current, currentIndex);
      const endIndex = Math.max(lastSelectedIndexRef.current, currentIndex);
      
      const newSelected = new Set(selectedItems);
      for (let i = startIndex; i <= endIndex; i++) {
        newSelected.add(displayedItems[i].id);
      }
      onSelectedItemsChange(newSelected);
      lastSelectedIndexRef.current = currentIndex;
    } else {
      // Regular item selection
      const newSelected = new Set(selectedItems);
      if (checked) {
        newSelected.add(itemId);
      } else {
        newSelected.delete(itemId);
      }
      onSelectedItemsChange(newSelected);
      lastSelectedIndexRef.current = currentIndex;
    }
  };

  const allSelected = filteredItems.length > 0 && filteredItems.every(item => selectedItems.has(item.id));
  const someSelected = filteredItems.some(item => selectedItems.has(item.id)) && !allSelected;

  // Handle drag end
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const activeId = Number(active.id);
    const overId = Number(over.id);

    const oldIndex = localItems.findIndex((item) => item.id === activeId);
    const newIndex = localItems.findIndex((item) => item.id === overId);

    if (oldIndex === -1 || newIndex === -1) return;

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
        sectionSeparatorFilter={sectionSeparatorFilter}
        setSectionSeparatorFilter={setSectionSeparatorFilter}
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

      <div className="rounded-xl bg-white shadow-sm border overflow-x-auto">
        <div className="flex bg-[#313545] items-center">
          <button
            className={`px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === "lineItems"
                ? "text-white border-b-2 border-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
            onClick={() => setActiveTab("lineItems")}
          >
            Line Items
          </button>
          <button
            className={`px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === "totals"
                ? "text-white border-b-2 border-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
            onClick={() => setActiveTab("totals")}
          >
            Totals
          </button>
          {!isCompleted && activeTab === "lineItems" && (
            <div className="ml-auto pr-3">
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setShowAddForm(true)}
              >
                + Add Line Item
              </button>
            </div>
          )}
        </div>

        {activeTab === "lineItems" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table className="table w-full min-w-[700px]">
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
                      onSelectChange={(checked, shiftKey) => handleSelectItem(item.id, checked, shiftKey)}
                    />
                  ))
                )}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
        ) : (
          <OrderTotalsTab items={localItems} orderType={orderType} />
        )}
      </div>

      {!isCompleted && showAddForm && (
        <dialog className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setShowAddForm(false)}
            >
              ✕
            </button>
            <AddOrderItemForm
              orderId={orderId}
              products={products}
              items={localItems}
              onCreated={handleFormCreated}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowAddForm(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
