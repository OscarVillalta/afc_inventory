import { useEffect, useMemo, useState } from "react";
import { fetchSuppliers, type Supplier } from "../../api/suppliers";
import {
  fetchAirFilterCategories,
  type AirFilterCategory,
} from "../../api/airfilters";
import {
  createChildAirFilter,
  createChildStockItem,
} from "../../api/productDetail";
import {
  fetchStockItemCategories,
  type StockItemCategory,
} from "../../api/stockItems";

type ProductType = "air_filter" | "stock_item";

interface AddChildProductModalProps {
  open: boolean;
  parentProductId: number;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddChildProductModal({
  open,
  parentProductId,
  onClose,
  onCreated,
}: AddChildProductModalProps) {
  const [productType, setProductType] = useState<ProductType>("air_filter");
  const [partNumber, setPartNumber] = useState("");
  const [description, setDescription] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [mervRating, setMervRating] = useState<number>(8);
  const [height, setHeight] = useState<number>(0);
  const [width, setWidth] = useState<number>(0);
  const [depth, setDepth] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<AirFilterCategory[]>([]);
  const [stockItemCategories, setStockItemCategories] = useState<StockItemCategory[]>([]);

  useEffect(() => {
    if (!open) return;

    fetchSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
    fetchAirFilterCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
    fetchStockItemCategories()
      .then(setStockItemCategories)
      .catch(() => setStockItemCategories([]));
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
  }, [open, productType]);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ label: c.name, value: String(c.id) })),
    [categories]
  );

  const stockItemCategoryOptions = useMemo(
    () => stockItemCategories.map((c) => ({ label: c.name, value: String(c.id) })),
    [stockItemCategories]
  );

  if (!open) return null;

  const disabled = loading;

  const handleSubmit = async () => {
    if (!supplierId) {
      alert("Supplier is required.");
      return;
    }
    if (!partNumber.trim()) {
      alert(productType === "air_filter" ? "Part number is required." : "Name is required.");
      return;
    }
    if ((productType === "air_filter" || productType === "stock_item") && !categoryId) {
      alert("Category is required.");
      return;
    }

    setLoading(true);
    try {
      if (productType === "air_filter") {
        await createChildAirFilter({
          part_number: partNumber.trim(),
          supplier_id: Number(supplierId),
          category_id: Number(categoryId),
          parent_product_id: parentProductId,
          merv_rating: Number(mervRating) || 0,
          height: Number(height) || 0,
          width: Number(width) || 0,
          depth: Number(depth) || 0,
        });
      } else {
        await createChildStockItem({
          name: partNumber.trim(),
          description: description || undefined,
          supplier_id: Number(supplierId),
          category_id: Number(categoryId),
          parent_product_id: parentProductId,
        });
      }

      onCreated();
    } catch (error) {
      console.error(error);
      alert("Failed to create child product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-center items-center z-50">
      <div className="bg-white w-[640px] max-h-[90vh] overflow-y-auto rounded-xl shadow-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Add Child Product</h2>
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
              <option value="stock_item">Stock Item</option>
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
              {productType === "air_filter" ? "Part Number" : "Name"}
            </label>
            <input
              className="input input-bordered w-full mt-1"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              placeholder={productType === "air_filter" ? "AF-12345" : "Item name"}
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
          ) : productType === "stock_item" ? (
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
                {stockItemCategoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
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
