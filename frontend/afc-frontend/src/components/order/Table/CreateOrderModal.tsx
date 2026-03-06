import { useEffect, useState } from "react";
import type { Customer } from "../../../api/customers";
import type { Supplier } from "../../../api/suppliers";
import { fetchCustomers } from "../../../api/customers";
import { fetchSuppliers } from "../../../api/suppliers";
import { createOrder } from "../../../api/ordersTable";
import type { OrderType } from "../../../constants/orderTypes";
import { ALL_ORDER_TYPES, ORDER_TYPE_LABELS, isOutgoingType } from "../../../constants/orderTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (orderId?: number) => void;
}

function isoToDate(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function Today(){
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const date = today.getDate();

    return `${year}-${month}-${date}`;
}

export default function CreateOrderModal({
  open,
  onClose,
  onCreated,
}: Props) {
  const [type, setType] = useState<OrderType>("installation");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [entityId, setEntityId] = useState<number | null>(null);

  const [eta, setEta] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ===================== LOAD DATA ===================== */

  useEffect(() => {
    if (!open) return;

    fetchCustomers().then(setCustomers);
    fetchSuppliers().then(setSuppliers);
  }, [open]);

  /* ===================== RESET ON TYPE CHANGE ===================== */

  useEffect(() => {
    setEntityId(null);
  }, [type]);

  if (!open) return null;

  /* ===================== SAVE ===================== */

  async function handleCreate() {
    if (!entityId) {
      setError("Customer / Supplier is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await createOrder({
        type,
        customer_id: isOutgoingType(type) ? entityId : undefined,
        supplier_id: type === "incoming" ? entityId : undefined,
        eta: isoToDate(eta) || null,
        description: description || null,
      });

      const order_id = response.id;

      onCreated(order_id);
      onClose();
    } catch {
      setError("Failed to create order.");
    } finally {
      setSaving(false);
    }
  }

  /* ===================== RENDER ===================== */

  const entities = isOutgoingType(type) ? customers : suppliers;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          Create New Order
        </h2>

        {/* Order Type */}
        <div>
          <label className="label text-sm font-medium">
            Order Type
          </label>
          <select
            className="select select-bordered w-full"
            value={type}
            onChange={(e) =>
              setType(e.target.value as OrderType)
            }
          >
            {ALL_ORDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {ORDER_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {/* Customer / Supplier */}
        <div>
          <label className="label text-sm font-medium">
            {isOutgoingType(type)
              ? "Customer"
              : "Supplier"}
          </label>
          <select
            className="select select-bordered w-full"
            value={entityId ?? ""}
            onChange={(e) =>
              setEntityId(Number(e.target.value))
            }
          >
            <option value="">Select…</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {"name" in e ? e.name : ""}
              </option>
            ))}
          </select>
        </div>

        {/* ETA */}
        <div>
          <label className="label text-sm font-medium">
            ETA
          </label>
          <input
            type="date"
            className="input input-bordered w-full"
            min={Today()}
            value={eta ?? ""}
            onChange={(e) => setEta(e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <label className="label text-sm font-medium">
            Description (optional)
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={description}
            onChange={(e) =>
              setDescription(e.target.value)
            }
          />
        </div>

        {/* Errors */}
        {error && (
          <p className="text-sm text-red-500">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            className="btn btn-sm btn-outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            className="btn btn-sm btn-primary"
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? "Creating…" : "Create Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
