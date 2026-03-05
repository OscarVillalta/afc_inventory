import { useState } from "react";
import { createOrderFromQB } from "../../../api/ordersTable";
import { OUTGOING_ORDER_TYPES, ORDER_TYPE_LABELS } from "../../../constants/orderTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (orderId?: number) => void;
}

const QB_DOC_TYPES = [
  { value: "sales_order", label: "Sales Order" },
  { value: "invoice", label: "Invoice" },
  { value: "estimate", label: "Estimate" },
  { value: "purchase_order", label: "Purchase Order" },
];

export default function PullFromQBModal({ open, onClose, onCreated }: Props) {
  const [referenceNumber, setReferenceNumber] = useState("");
  const [docType, setDocType] = useState("sales_order");
  const [orderType, setOrderType] = useState("installation");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPurchaseOrder = docType === "purchase_order";

  function handleDocTypeChange(newDocType: string) {
    setDocType(newDocType);
    if (newDocType === "purchase_order") {
      setOrderType("incoming");
    } else if (orderType === "incoming") {
      setOrderType("installation");
    }
  }

  function handleClose() {
    setReferenceNumber("");
    setDocType("sales_order");
    setOrderType("installation");
    setError(null);
    onClose();
  }

  if (!open) return null;

  async function handlePull() {
    if (!referenceNumber.trim()) {
      setError("Reference number is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await createOrderFromQB({
        reference_number: referenceNumber.trim(),
        qb_doc_type: docType,
        order_type: isPurchaseOrder ? undefined : orderType,
      });

      const orderId = response.order_id;
      onCreated(orderId);
      handleClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to pull from QuickBooks.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Pull From QuickBooks</h2>

        {/* Reference Number */}
        <div>
          <label className="label text-sm font-medium">Reference Number</label>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="e.g. 8800"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePull()}
          />
        </div>

        {/* Document Type */}
        <div>
          <label className="label text-sm font-medium">Document Type</label>
          <select
            className="select select-bordered w-full"
            value={docType}
            onChange={(e) => handleDocTypeChange(e.target.value)}
          >
            {QB_DOC_TYPES.map((dt) => (
              <option key={dt.value} value={dt.value}>
                {dt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Order Type (hidden for Purchase Orders — always Incoming) */}
        <div>
          <label className="label text-sm font-medium">Order Type</label>
          {isPurchaseOrder ? (
            <div className="input input-bordered w-full flex items-center text-gray-500 bg-gray-50 cursor-not-allowed">
              Incoming
            </div>
          ) : (
            <select
              className="select select-bordered w-full"
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
            >
              {OUTGOING_ORDER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ORDER_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Error */}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            className="btn btn-sm btn-outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handlePull}
            disabled={loading}
          >
            {loading ? "Pulling…" : "Pull From QB"}
          </button>
        </div>
      </div>
    </div>
  );
}
