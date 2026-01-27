import { useState } from "react";
import type { Product } from "../../../api/products";
import { createOrderItem } from "../../../api/orderDetail";

interface Props {
  orderId: number;
  products: Product[];
  onCreated: () => void;
  onCancel?: () => void;
}

export default function AddOrderItemForm({
  orderId,
  products,
  onCreated,
  onCancel,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] =
    useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
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
      });

      // Reset state
      setSearch("");
      setSelectedProductId(null);
      setQuantity(1);
      setNote("");
      setShowDropdown(false);

      onCreated();
    } catch {
      setError("Failed to add item.");
    } finally {
      setSaving(false);
    }
  }

  /* ===================== Render ===================== */

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3 border">
      <h4 className="text-sm font-medium">Add Item</h4>

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

      {/* ===================== ACTIONS ===================== */}
      <div className="flex justify-end gap-2 items-center">
        {error && (
          <span className="text-sm text-red-500 mr-auto">
            {error}
          </span>
        )}

        <button
          className="btn btn-sm btn-outline"
          onClick={onCancel || onCreated}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          className="btn btn-sm btn-primary"
          onClick={handleAdd}
          disabled={saving || !selectedProductId}
        >
          {saving ? "Adding…" : "Add Item"}
        </button>
      </div>
    </div>
  );
}
