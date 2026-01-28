import { useState } from "react";
import type { Product } from "../../../api/products";
import type { OrderItemPayload } from "../../../api/orderDetail";
import { createOrderItem } from "../../../api/orderDetail";

interface Props {
  orderId: number;
  products: Product[];
  items?: OrderItemPayload[];
  onCreated: () => void;
  onCancel?: () => void;
}

export default function AddOrderItemForm({
  orderId,
  products,
  items = [],
  onCreated,
  onCancel,
}: Props) {
  const [itemType, setItemType] = useState<"regular" | "separator">("regular");
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] =
    useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [position, setPosition] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  /* ===================== Helpers ===================== */

  function getProductLabel(p: Product) {
    return (
      p.part_number ??
      `Product #${p.id}`
    );
  }

  const filteredProducts = products.filter((p) =>
    getProductLabel(p)
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  /* ===================== Actions ===================== */

  async function handleAdd() {
    if (itemType === "separator") {
      // Separator items only need a description
      if (!note || note.trim() === "") {
        setError("Description is required for separator items.");
        return;
      }

      setSaving(true);
      setError(null);

      try {
        await createOrderItem({
          order_id: orderId,
          is_separator: true,
          note: note,
          position: position ?? undefined,
        });

        // Reset state
        setNote("");
        setItemType("regular");
        setPosition(null);
        onCreated();
      } catch {
        setError("Failed to add separator item.");
      } finally {
        setSaving(false);
      }
    } else {
      // Regular item validation
      if (!selectedProductId) {
        setError("Product is required.");
        return;
      }

      if (quantity <= 0) {
        setError("Quantity must be greater than zero.");
        return;
      }

      setSaving(true);
      setError(null);

      try {
        await createOrderItem({
          order_id: orderId,
          product_id: selectedProductId,
          quantity_ordered: quantity,
          note: note || undefined,
          position: position ?? undefined,
        });

        // Reset state
        setSearch("");
        setSelectedProductId(null);
        setQuantity(1);
        setNote("");
        setPosition(null);
        setShowDropdown(false);

        onCreated();
      } catch {
        setError("Failed to add item.");
      } finally {
        setSaving(false);
      }
    }
  }

  /* ===================== Render ===================== */

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3 border">
      <h4 className="text-sm font-medium">Add Item</h4>

      {/* ===================== ITEM TYPE SELECTOR ===================== */}
      <div className="flex gap-2">
        <button
          className={`btn btn-sm ${itemType === "regular" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setItemType("regular")}
        >
          Regular Item
        </button>
        <button
          className={`btn btn-sm ${itemType === "separator" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setItemType("separator")}
        >
          Separator / Section Header
        </button>
      </div>

      {itemType === "regular" ? (
        <>
          {/* ===================== PRODUCT DROPDOWN ===================== */}
          <div className="relative">
            <input
              type="text"
              placeholder="Select product…"
              className="input input-sm input-bordered w-full"
              value={
                selectedProductId
                  ? getProductLabel(
                      products.find((p) => p.id === selectedProductId)!
                    )
                  : search
              }
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedProductId(null);
                setShowDropdown(true);
              }}
            />

            {showDropdown && (
              <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-white shadow-lg">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      className="px-3 py-2 cursor-pointer hover:bg-blue-50"
                      onClick={() => {
                        setSelectedProductId(p.id);
                        setSearch("");
                        setShowDropdown(false);
                      }}
                    >
                      {getProductLabel(p)}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-400">
                    No matching products
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ===================== QUANTITY ===================== */}
          <input
            type="number"
            min={1}
            className="input input-sm input-bordered w-32"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />

          {/* ===================== NOTE ===================== */}
          <input
            type="text"
            placeholder="Note (optional)"
            className="input input-sm input-bordered w-full"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </>
      ) : (
        <>
          {/* ===================== SEPARATOR DESCRIPTION ===================== */}
          <input
            type="text"
            placeholder="Section description / label (required)"
            className="input input-sm input-bordered w-full"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="text-xs text-gray-500">
            This will create a visual separator that acts as a section header.
          </p>
        </>
      )}

      {/* ===================== POSITION SELECTOR ===================== */}
      <div>
        <label className="text-xs text-gray-600 mb-1 block">
          Insert Position (optional)
        </label>
        <select
          className="select select-sm select-bordered w-full"
          value={position ?? ""}
          onChange={(e) => setPosition(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Add at end</option>
          {items.map((item, index) => (
            <option key={item.id} value={index}>
              {index + 1}. {item.is_separator ? `[${item.note}]` : item.part_number}
            </option>
          ))}
          {items.length > 0 && (
            <option value={items.length}>
              {items.length + 1}. (End of list)
            </option>
          )}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Select a position to insert the new item before an existing item.
        </p>
      </div>

      {/* ===================== ACTIONS ===================== */}
      )}

      {/* ===================== ACTIONS ===================== */}
      <div className="flex justify-end gap-2 items-center">
        {error && (
          <span className="text-sm text-red-500 mr-auto">
            {error}
          </span>
        )}

        <button
          className="btn btn-sm btn-outline"
          onClick={onCancel ?? onCreated}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          className="btn btn-sm btn-primary"
          onClick={handleAdd}
          disabled={
            saving || 
            (itemType === "regular" && !selectedProductId) ||
            (itemType === "separator" && !note)
          }
        >
          {saving ? "Adding…" : "Add Item"}
        </button>
      </div>
    </div>
  );
}
