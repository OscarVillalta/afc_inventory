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

import type { OrderType } from "../../../constants/orderTypes";

interface Props {
  orderId: number;
  orderStatus: string;
  orderType: OrderType;
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
    const hasItemFilters = !!(partNumberFilter || descriptionFilter || statusFilter);
    const hasSectionFilter = !!sectionFilter;
    const hasSectionSeparatorFilter = !!sectionSeparatorFilter;

    // No filters: return everything
    if (!hasItemFilters && !hasSectionFilter && !hasSectionSeparatorFilter) {
      const totalItems = localItems.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
      const startIndex = (currentPage - 1) * itemsPerPage;
      const paginatedItems = localItems.slice(startIndex, startIndex + itemsPerPage);
      return { filteredItems: localItems, items: paginatedItems, totalItems, totalPages };
    }

    // Build hierarchy maps: item id → parent separator ids
    const unitToSection = new Map<number, number>();
    const itemToUnit = new Map<number, number>();
    const itemToSection = new Map<number, number>();
    let currentSectionId: number | null = null;
    let currentUnitId: number | null = null;

    for (const item of localItems) {
      if (item.type === "Section_Separator") {
        currentSectionId = item.id;
        currentUnitId = null;
      } else if (item.type === "Unit_Separator") {
        currentUnitId = item.id;
        if (currentSectionId !== null) unitToSection.set(item.id, currentSectionId);
      } else {
        if (currentUnitId !== null) itemToUnit.set(item.id, currentUnitId);
        if (currentSectionId !== null) itemToSection.set(item.id, currentSectionId);
      }
    }

    // Determine matching Section_Separators (null = no filter = all allowed)
    const matchingSectionSepIds: Set<number> | null = hasSectionSeparatorFilter
      ? new Set(
          localItems
            .filter(
              (i) =>
                i.type === "Section_Separator" &&
                (i.note || "").toLowerCase().includes(sectionSeparatorFilter.toLowerCase())
            )
            .map((i) => i.id)
        )
      : null;

    // Determine matching Unit_Separators (null = no filter = all allowed)
    // When sectionSeparatorFilter is also active, restrict units to those inside matching sections
    const matchingUnitSepIds: Set<number> | null = hasSectionFilter
      ? new Set(
          localItems
            .filter((i) => {
              if (i.type !== "Unit_Separator") return false;
              if (!(i.note || "").toLowerCase().includes(sectionFilter.toLowerCase())) return false;
              if (matchingSectionSepIds !== null) {
                const parentSec = unitToSection.get(i.id);
                return parentSec !== undefined && matchingSectionSepIds.has(parentSec);
              }
              return true;
            })
            .map((i) => i.id)
        )
      : null;

    // Determine matching leaf items
    // When hierarchy filters are active, restrict to items inside the matching hierarchy
    const matchingLeafIds: Set<number> | null = hasItemFilters
      ? new Set(
          localItems
            .filter((i) => {
              if (i.type === "Unit_Separator" || i.type === "Section_Separator") return false;
              const matchesPartNumber =
                !partNumberFilter ||
                i.part_number.toLowerCase().includes(partNumberFilter.toLowerCase());
              const matchesDescription =
                !descriptionFilter ||
                (i.note || "").toLowerCase().includes(descriptionFilter.toLowerCase());
              const matchesStatus = !statusFilter || i.status === statusFilter;
              if (!matchesPartNumber || !matchesDescription || !matchesStatus) return false;
              // Hierarchy constraints
              if (matchingUnitSepIds !== null) {
                const unitId = itemToUnit.get(i.id);
                return unitId !== undefined && matchingUnitSepIds.has(unitId);
              }
              if (matchingSectionSepIds !== null) {
                const sectionId = itemToSection.get(i.id);
                return sectionId !== undefined && matchingSectionSepIds.has(sectionId);
              }
              return true;
            })
            .map((i) => i.id)
        )
      : null;

    // Build the sets of separator ids to include
    const includedUnitIds = new Set<number>();
    const includedSectionIds = new Set<number>();
    const includedLeafIds = new Set<number>();

    if (matchingLeafIds !== null) {
      // Item-level filters active: include matching leaves + their parent separators
      for (const id of matchingLeafIds) {
        includedLeafIds.add(id);
        const unitId = itemToUnit.get(id);
        if (unitId !== undefined) {
          includedUnitIds.add(unitId);
          const secId = unitToSection.get(unitId);
          if (secId !== undefined) includedSectionIds.add(secId);
        }
        const secId = itemToSection.get(id);
        if (secId !== undefined) includedSectionIds.add(secId);
      }
    } else if (matchingUnitSepIds !== null) {
      // Only section (Unit_Separator) filter active: include matching units, their parent sections, and all items within
      for (const unitId of matchingUnitSepIds) {
        includedUnitIds.add(unitId);
        const secId = unitToSection.get(unitId);
        if (secId !== undefined) includedSectionIds.add(secId);
      }
      for (const item of localItems) {
        if (item.type === "Unit_Separator" || item.type === "Section_Separator") continue;
        const unitId = itemToUnit.get(item.id);
        if (unitId !== undefined && includedUnitIds.has(unitId)) {
          includedLeafIds.add(item.id);
        }
      }
    } else if (matchingSectionSepIds !== null) {
      // Only section separator filter active: include matching sections and all their content
      for (const secId of matchingSectionSepIds) {
        includedSectionIds.add(secId);
      }
      for (const item of localItems) {
        if (item.type === "Unit_Separator") {
          const secId = unitToSection.get(item.id);
          if (secId !== undefined && includedSectionIds.has(secId)) {
            includedUnitIds.add(item.id);
          }
        } else if (item.type !== "Section_Separator") {
          const secId = itemToSection.get(item.id);
          if (secId !== undefined && includedSectionIds.has(secId)) {
            includedLeafIds.add(item.id);
          }
        }
      }
    }

    const filtered = localItems.filter((item) => {
      if (item.type === "Section_Separator") return includedSectionIds.has(item.id);
      if (item.type === "Unit_Separator") return includedUnitIds.has(item.id);
      return includedLeafIds.has(item.id);
    });

    // Calculate pagination
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);

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

      {activeTab === "lineItems" && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 flex-wrap py-2 px-4 border-t bg-gray-50">
          <button
            className="btn btn-sm btn-outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            aria-label="Go to previous page"
          >
            Previous
          </button>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                if (page === 1 || page === totalPages) return true;
                if (Math.abs(page - currentPage) <= 1) return true;
                return false;
              })
              .map((page, idx, arr) => {
                const prevPage = arr[idx - 1];
                const showEllipsis = prevPage && page - prevPage > 1;
                return (
                  <div key={page} className="flex items-center gap-1">
                    {showEllipsis && (
                      <span className="px-2 text-gray-400" aria-hidden="true">...</span>
                    )}
                    <button
                      className={`btn btn-sm ${currentPage === page ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setCurrentPage(page)}
                      aria-label={`Go to page ${page}`}
                      aria-current={currentPage === page ? "page" : undefined}
                    >
                      {page}
                    </button>
                  </div>
                );
              })}
          </div>
          <button
            className="btn btn-sm btn-outline"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(currentPage + 1)}
            aria-label="Go to next page"
          >
            Next
          </button>
          <span className="text-xs text-gray-500">
            {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
          </span>
        </div>
      )}

      {!isCompleted && showAddForm && (
        <dialog className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setShowAddForm(false)}
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
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
