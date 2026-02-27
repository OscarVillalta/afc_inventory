import { useEffect, useMemo, useState } from "react";
import { fetchSuppliers, type Supplier } from "../../api/suppliers";
import {
  createAirFilter,
  fetchAirFilterCategories,
  type AirFilterCategory,
} from "../../api/airfilters";
import { createMiscItem } from "../../api/miscItems";
import { autocommitTxn } from "../../api/transactions";

type ProductType = "air_filter" | "misc_item";

interface AddProductModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddProductModal({
  open,
  onClose,
  onCreated,
}: AddProductModalProps) {
  const [productType, setProductType] = useState<ProductType>("air_filter");
  const [partNumber, setPartNumber] = useState("");
  const [description, setDescription] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [mervRating, setMervRating] = useState<number>(8);
  const [height, setHeight] = useState<number>(0);
  const [width, setWidth] = useState<number>(0);
  const [depth, setDepth] = useState<number>(0);
  const [initialStock, setInitialStock] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<AirFilterCategory[]>([]);

  useEffect(() => {
    if (!open) return;

    fetchSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
    fetchAirFilterCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setPartNumber("");
    setDescription("");
    setSupplierId("");
    setCategoryId("");
    setMervRating(8);
    setHeight(0);
    setWidth(0);
    setDepth(0);
    setInitialStock(0);
  }, [open, productType]);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ label: c.name, value: String(c.id) })),
    [categories]
  );

  if (!open) return null;

  const disabled = loading;

  const handleSubmit = async () => {
    if (!partNumber.trim()) {
      alert("Part number is required.");
      return;
    }
    if (!supplierId) {
      alert("Supplier is required.");
      return;
    }

    setLoading(true);
    try {
      let productId: number | null = null;

      if (productType === "air_filter") {
        if (!categoryId) {
          alert("Category is required.");
          setLoading(false);
          return;
        }

        const created = await createAirFilter({
          part_number: partNumber.trim(),
          description: description || undefined,
          supplier_id: Number(supplierId),
          category_id: Number(categoryId),
          merv_rating: Number(mervRating) || 0,
          height: Number(height) || 0,
          width: Number(width) || 0,
          depth: Number(depth) || 0,
        });
        productId = created?.product_id ?? null;
      } else {
        const created = await createMiscItem({
          name: partNumber.trim(),
          description: description || null,
          supplier_id: Number(supplierId),
        });
        productId = created?.product_id ?? null;
      }

      if (productId && initialStock > 0) {
        await autocommitTxn({
          product_id: productId,
          quantity_delta: Number(initialStock),
          reason: "adjustment",
          note: "Initial stock",
        });
      }

      onCreated();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Failed to create product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-center items-center z-50">
      <div className="bg-white w-[640px] max-h-[90vh] overflow-y-auto rounded-xl shadow-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Add Product</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600">
              Product Type
            </label>
            <select
              className="select select-bordered w-full mt-1"
              value={productType}
              onChange={(e) => setProductType(e.target.value as ProductType)}
              disabled={disabled}
            >
              <option value="air_filter">Air Filter</option>
              <option value="misc_item">Misc Item</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600">
              Supplier
            </label>
            <select
              className="select select-bordered w-full mt-1"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              disabled={disabled}
            >
              <option value="">Select supplier...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600">
              Part Number / Name
            </label>
            <input
              className="input input-bordered w-full mt-1"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              placeholder={productType === "air_filter" ? "AF-12345" : "Misc item name"}
              disabled={disabled}
            />
          </div>

          {productType === "air_filter" ? (
            <div>
              <label className="text-sm font-medium text-gray-600">
                Category
              </label>
              <select
                className="select select-bordered w-full mt-1"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={disabled}
              >
                <option value="">Select category...</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-gray-600">
                Description (optional)
              </label>
              <input
                className="input input-bordered w-full mt-1"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={disabled}
              />
            </div>
          )}
        </div>

        {productType === "air_filter" && (
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-600">MERV</label>
              <input
                type="number"
                className="input input-bordered w-full mt-1"
                value={mervRating}
                onChange={(e) => setMervRating(Number(e.target.value))}
                disabled={disabled}
                min={1}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Height</label>
              <input
                type="number"
                className="input input-bordered w-full mt-1"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                disabled={disabled}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Width</label>
              <input
                type="number"
                className="input input-bordered w-full mt-1"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                disabled={disabled}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Depth</label>
              <input
                type="number"
                className="input input-bordered w-full mt-1"
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                disabled={disabled}
              />
            </div>
          </div>
        )}

        {productType === "air_filter" && (
          <div>
            <label className="text-sm font-medium text-gray-600">
              Description (optional)
            </label>
            <input
              className="input input-bordered w-full mt-1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={disabled}
              placeholder="e.g. High-efficiency pleated filter"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600">
              Initial Stock
            </label>
            <input
              type="number"
              className="input input-bordered w-full mt-1"
              value={initialStock}
              onChange={(e) => setInitialStock(Number(e.target.value))}
              min={0}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button className="btn" onClick={onClose} disabled={disabled}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={disabled}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
