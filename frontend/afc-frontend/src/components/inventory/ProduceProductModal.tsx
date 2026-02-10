import { useEffect, useMemo, useState } from "react";
import {
  fetchProducts,
  fetchChildProducts,
  type Product,
  type ChildProductName,
} from "../../api/products";
import {
  createConversionBatch,
  type ConversionBatchRequest,
} from "../../api/conversions";

interface ProduceProductModalProps {
  open: boolean;
  onClose: () => void;
  onProduced: () => void;
}

interface SelectOption {
  value: string;
  label: string;
}

function formatChildLabel(child: ChildProductName) {
  if (child.part_number) return child.part_number;
  if (child.air_filter?.part_number) return child.air_filter.part_number;
  if (child.misc_item?.name) return child.misc_item.name;
  return `Child ${child.id}`;
}

export default function ProduceProductModal({ open, onClose, onProduced }: ProduceProductModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [childProducts, setChildProducts] = useState<ChildProductName[]>([]);
  const [sources, setSources] = useState<{ selection: string; quantity: number }[]>([
    { selection: "", quantity: 0 },
  ]);
  const [targetSelection, setTargetSelection] = useState("");
  const [targetQty, setTargetQty] = useState<number>(0);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSources([{ selection: "", quantity: 0 }]);
    setTargetSelection("");
    setTargetQty(0);
    setNote("");

    fetchProducts().then(setProducts).catch(() => setProducts([]));
    fetchChildProducts().then(setChildProducts).catch(() => setChildProducts([]));
  }, [open]);

  const options = useMemo<SelectOption[]>(() => {
    const base = products.map((p) => ({
      value: `product-${p.id}`,
      label: p.part_number || `Product ${p.id}`,
    }));

    const childOpts = childProducts.map((c) => ({
      value: `child-${c.id}`,
      label: formatChildLabel(c),
    }));

    return [...base, ...childOpts];
  }, [products, childProducts]);

  if (!open) return null;

  const disabled = loading;

  const parseSelection = (selection: string) => {
    if (!selection) return null;
    const [kind, id] = selection.split("-");
    const parsedId = Number(id);
    if (Number.isNaN(parsedId)) return null;
    return { kind, id: parsedId as number };
  };

  const updateSource = (index: number, field: "selection" | "quantity", value: string | number) => {
    setSources((prev) =>
      prev.map((src, i) => (i === index ? { ...src, [field]: value } : src)),
    );
  };

  const handleAddSource = () => {
    setSources((prev) => [...prev, { selection: "", quantity: 0 }]);
  };

  const handleRemoveSource = (index: number) => {
    setSources((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleSubmit = async () => {
    const parsedSources = sources
      .map((source) => ({
        parsed: parseSelection(source.selection),
        quantity: Number(source.quantity),
      }))
      .filter((s) => s.parsed);

    if (!parsedSources.length || !targetSelection) {
      alert("Select at least one source and a target product.");
      return;
    }

    if (parsedSources.some((s) => !s.quantity || s.quantity <= 0) || targetQty <= 0) {
      alert("Quantities must be greater than zero.");
      return;
    }

    const target = parseSelection(targetSelection);
    if (!target) {
      alert("Invalid target selection.");
      return;
    }

    const conversionRequest: ConversionBatchRequest = {
      note: note || undefined,
      conversions: [
        {
          decreases: parsedSources.map((source) =>
            source.parsed!.kind === "child"
              ? {
                  child_product_id: source.parsed!.id,
                  quantity: source.quantity,
                }
              : {
                  product_id: source.parsed!.id,
                  quantity: source.quantity,
                }
          ),
          increase:
            target.kind === "child"
              ? { child_product_id: target.id, quantity: Number(targetQty) }
              : { product_id: target.id, quantity: Number(targetQty) },
        },
      ],
    };

    setLoading(true);
    try {
      await createConversionBatch(conversionRequest);
      onProduced();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Failed to create conversion batch.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-center items-center z-50">
      <div className="bg-white w-[720px] rounded-xl shadow-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Create Conversion Batch</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-700">Decrease From</h3>
              <button className="btn btn-ghost btn-xs" onClick={handleAddSource} disabled={disabled}>
                + Add source
              </button>
            </div>

            <div className="space-y-3">
              {sources.map((source, idx) => (
                <div key={idx} className="border rounded-lg p-3 bg-white shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-600 flex-1">Product</label>
                    {sources.length > 1 && (
                      <button
                        className="btn btn-ghost btn-xs text-red-500"
                        onClick={() => handleRemoveSource(idx)}
                        disabled={disabled}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <select
                    className="select select-bordered w-full"
                    value={source.selection}
                    onChange={(e) => updateSource(idx, "selection", e.target.value)}
                    disabled={disabled}
                  >
                    <option value="">Select source...</option>
                    {options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Quantity to decrease</label>
                    <input
                      type="number"
                      className="input input-bordered w-full mt-1"
                      value={source.quantity}
                      onChange={(e) => updateSource(idx, "quantity", Number(e.target.value))}
                      min={1}
                      disabled={disabled}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-semibold text-gray-700 mb-3">Increase To</h3>
            <label className="text-sm font-medium text-gray-600">Product</label>
            <select
              className="select select-bordered w-full mt-1"
              value={targetSelection}
              onChange={(e) => setTargetSelection(e.target.value)}
              disabled={disabled}
            >
              <option value="">Select target...</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <label className="text-sm font-medium text-gray-600 mt-3 block">
              Quantity to increase
            </label>
            <input
              type="number"
              className="input input-bordered w-full mt-1"
              value={targetQty}
              onChange={(e) => setTargetQty(Number(e.target.value))}
              min={1}
              disabled={disabled}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600">Batch Note</label>
          <input
            className="input input-bordered w-full mt-1"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button className="btn" onClick={onClose} disabled={disabled}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={disabled}
          >
            {loading ? "Creating..." : "Create batch"}
          </button>
        </div>
      </div>
    </div>
  );
}
