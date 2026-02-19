import { useEffect, useState } from "react";
import type { TransactionPayload } from "../../api/transactions";
import { fetchTransactionOnHand } from "../../api/transactions";
import type { TransactionOnHand } from "../../api/transactions";

const ROLLBACK_NOTE_PREFIX = "Reversal of transaction #";

interface TransactionDetailDrawerProps {
  transaction: TransactionPayload | null;
  productLabel: string;
  onClose: () => void;
}

function formatDateTime(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function getStateDisplayLabel(state: string, qtyDelta: number) {
  switch (state) {
    case "pending":
      return qtyDelta < 0 ? "Reserved" : "Ordered";
    case "committed":
      return qtyDelta < 0 ? "Fulfilled" : "Received";
    case "rolled_back":
      return "Reversed";
    case "cancelled":
      return "Cancelled";
    default:
      return state;
  }
}

function getReasonBadge(reason: string) {
  const styles: Record<string, string> = {
    adjustment: "bg-gray-100 text-gray-700",
    shipment: "bg-red-50 text-red-700",
    receive: "bg-green-50 text-green-700",
    rollback: "bg-amber-50 text-amber-700",
    ordered: "bg-blue-50 text-blue-700",
    allocation: "bg-purple-50 text-purple-700",
  };
  return styles[reason] || "bg-gray-100 text-gray-700";
}

export default function TransactionDetailDrawer({
  transaction,
  productLabel,
  onClose,
}: TransactionDetailDrawerProps) {
  const [onHandData, setOnHandData] = useState<TransactionOnHand | null>(null);
  const [onHandLoading, setOnHandLoading] = useState(false);

  useEffect(() => {
    if (!transaction) {
      setOnHandData(null);
      return;
    }

    if (transaction.state === "committed" && transaction.ledger_sequence != null) {
      setOnHandLoading(true);
      fetchTransactionOnHand(transaction.id)
        .then((data) => setOnHandData(data))
        .catch(() => setOnHandData(null))
        .finally(() => setOnHandLoading(false));
    } else {
      setOnHandData(null);
    }
  }, [transaction]);

  // Empty state when no transaction is selected
  if (!transaction) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 sticky top-6 flex flex-col items-center justify-center py-20 px-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <p className="text-gray-400 font-medium text-base mb-1">Select a transaction to view details</p>
        <p className="text-gray-300 text-sm">Click any row in the table</p>
      </div>
    );
  }

  const isRollback =
    transaction.reason === "rollback" && transaction.note?.startsWith(ROLLBACK_NOTE_PREFIX);
  const relatedTxnId = isRollback
    ? transaction.note?.replace(ROLLBACK_NOTE_PREFIX, "")
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 sticky top-6 overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-4 text-white flex items-center justify-between"
        style={{
          background: "linear-gradient(90deg, #3A7BD5 0%, #2B60C8 100%)",
        }}
      >
        <div>
          <h2 className="text-lg font-semibold">Transaction #{transaction.id}</h2>
          <p className="text-sm text-blue-100">Detail View</p>
        </div>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white cursor-pointer text-2xl leading-none p-1"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col overflow-y-auto max-h-[calc(100vh-12rem)] space-y-6 px-6 pt-6 pb-8">
        {/* Product Details */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Product
          </h3>
          <p className="text-base font-medium text-gray-800">{productLabel}</p>
        </section>

        {/* Quantity */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Quantity Change
          </h3>
          <span
            className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
              transaction.quantity_delta > 0
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {transaction.quantity_delta > 0 ? "+" : ""}
            {transaction.quantity_delta} units
          </span>
        </section>

        {/* State & Reason */}
        <div className="grid grid-cols-2 gap-4">
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              State
            </h3>
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                transaction.state === "committed"
                  ? "bg-green-100 text-green-700"
                  : transaction.state === "pending"
                  ? "bg-[#feeab7] text-[#756334]"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {getStateDisplayLabel(transaction.state, transaction.quantity_delta)}
            </span>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Reason
            </h3>
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-medium capitalize ${getReasonBadge(
                transaction.reason ?? ""
              )}`}
            >
              {transaction.reason === "rollback" ? "reversal" : transaction.reason}
            </span>
          </section>
        </div>

        {/* On-Hand Stock Before/After (committed transactions only) */}
        {transaction.state === "committed" && transaction.ledger_sequence != null && (
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              On-Hand Stock
            </h3>
            {onHandLoading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : onHandData ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Before</p>
                  <p className="text-lg font-semibold text-gray-700">{onHandData.on_hand_before}</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">After</p>
                  <p className={`text-lg font-semibold ${
                    transaction.quantity_delta > 0 ? "text-green-700" : transaction.quantity_delta < 0 ? "text-red-700" : "text-gray-700"
                  }`}>{onHandData.on_hand_after}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Not available</p>
            )}
          </section>
        )}

        {/* Order Link */}
        {transaction.order_id && (
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Order
            </h3>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
              Order #{transaction.order_id}
            </span>
          </section>
        )}

        {/* Notes */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Notes
          </h3>
          <p className={`text-sm ${transaction.note ? "text-gray-700" : "text-gray-300"}`}>
            {transaction.note || "No notes"}
          </p>
        </section>

        {/* Related Transaction */}
        {isRollback && relatedTxnId && (
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Related Transaction
            </h3>
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              <span>↔</span>
              <span>Reversal of Transaction #{relatedTxnId}</span>
            </div>
          </section>
        )}

        {/* Audit Info */}
        <section>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Audit Info
          </h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Created</span>
              <span>{formatDateTime(transaction.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Last Updated</span>
              <span>{formatDateTime(transaction.last_updated_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Transaction ID</span>
              <span>#{transaction.id}</span>
            </div>
            {transaction.product_id && (
              <div className="flex justify-between">
                <span className="text-gray-400">Product ID</span>
                <span>#{transaction.product_id}</span>
              </div>
            )}
            {transaction.child_product_id && (
              <div className="flex justify-between">
                <span className="text-gray-400">Child Product ID</span>
                <span>#{transaction.child_product_id}</span>
              </div>
            )}
            {transaction.order_item_id && (
              <div className="flex justify-between">
                <span className="text-gray-400">Order Item ID</span>
                <span>#{transaction.order_item_id}</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
