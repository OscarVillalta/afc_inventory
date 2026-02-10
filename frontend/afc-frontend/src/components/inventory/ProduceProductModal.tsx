import { useEffect, useMemo, useState } from "react";
import { fetchProducts, fetchChildProducts, type Product, type ChildProductName } from "../../api/products";
import { produceInventory, type ProduceRequest } from "../../api/transactions";

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
  const [sourceSelection, setSourceSelection] = useState("");
  const [targetSelection, setTargetSelection] = useState("");
  const [sourceQty, setSourceQty] = useState<number>(0);
  const [targetQty, setTargetQty] = useState<number>(0);
  const [reason, setReason] = useState("adjustment");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSourceSelection("");
    setTargetSelection("");
    setSourceQty(0);
    setTargetQty(0);
    setReason("adjustment");
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

  const handleSubmit = async () => {
    if (!sourceSelection || !targetSelection) {
      alert("Select both source and target products.");
      return;
    }
    if (sourceQty <= 0 || targetQty <= 0) {
      alert("Quantities must be greater than zero.");
      return;
    }

    const source = parseSelection(sourceSelection);
    const target = parseSelection(targetSelection);
    if (!source || !target) {
      alert("Invalid selection.");
      return;
    }

    const payload: ProduceRequest = {
      source_quantity: Number(sourceQty),
      target_quantity: Number(targetQty),
      reason,
      note: note || undefined,
    };

    if (source.kind === "child") {
      payload.source_child_product_id = source.id;
    } else {
      payload.source_product_id = source.id;
    }

    if (target.kind === "child") {
      payload.target_child_product_id = target.id;
    } else {
      payload.target_product_id = target.id;
    }

    setLoading(true);
    try {
      await produceInventory(payload);
      onProduced();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Failed to produce product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white w-[720px] rounded-xl shadow-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Produce Product</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-semibold text-gray-700 mb-3">Decrease From</h3>
            <label className="text-sm font-medium text-gray-600">Product</label>
            <select
              className="select select-bordered w-full mt-1"
              value={sourceSelection}
              onChange={(e) => setSourceSelection(e.target.value)}
              disabled={disabled}
            >
              <option value="">Select source...</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <label className="text-sm font-medium text-gray-600 mt-3 block">
              Quantity to decrease
            </label>
            <input
              type="number"
              className="input input-bordered w-full mt-1"
              value={sourceQty}
              onChange={(e) => setSourceQty(Number(e.target.value))}
              min={1}
              disabled={disabled}
            />
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600">Reason</label>
            <select
              className="select select-bordered w-full mt-1"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={disabled}
            >
              <option value="adjustment">Adjustment</option>
              <option value="receive">Receive</option>
              <option value="shipment">Shipment</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Note</label>
            <input
              className="input input-bordered w-full mt-1"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button className="btn" onClick={onClose} disabled={disabled}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={disabled}
          >
            {loading ? "Producing..." : "Produce"}
          </button>
        </div>
      </div>
    </div>
  );
}
