import { useState } from "react";
import type {
  OrderItemPayload,
  OrderItemTransaction,
} from "../../api/orderDetail";
import {
  fetchOrderItemTransactions,
  createOrderItemTransaction,
  commitTransaction,
} from "../../api/orderDetail";

interface Props {
  item: OrderItemPayload;
  order_type: "incoming" | "outgoing";
}

export default function OrderItemRow({ item, order_type }: Props) {
  const [expanded, setExpanded] = useState(false);

  const remaining = item.quantity_ordered - item.quantity_fulfilled;

  /* ===== Create pending ===== */
  const [pendingQty, setPendingQty] = useState<number>(
    Math.max(remaining, 0)
  );
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ===== Transactions ===== */
  const [transactions, setTransactions] =
    useState<OrderItemTransaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadTransactions(force = false) {
    if (loaded && !force) return;

    setLoadingTxns(true);
    setError(null);

    try {
      const data = await fetchOrderItemTransactions(item.id);
      setTransactions(data);
      setLoaded(true);
    } catch {
      setError("Failed to load transactions.");
    } finally {
      setLoadingTxns(false);
    }
  }

  /* ===== Create pending transaction ===== */
  async function handleCreatePendingTxn(e: React.MouseEvent) {
    e.stopPropagation();

    if (pendingQty <= 0 || pendingQty > remaining) {
      setError("Invalid quantity.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const isOutgoing = order_type === "outgoing";

    try {
      await createOrderItemTransaction({
        product_id: item.product_id,
        order_id: item.order_id,
        order_item_id: item.id,
        quantity_delta: isOutgoing ? -pendingQty : pendingQty,
        reason: isOutgoing ? "shipment" : "receive",
        note: note || undefined,
      });

      setPendingQty(Math.max(remaining - pendingQty, 0));
      setNote("");
      await loadTransactions(true);
    } catch {
      setError("Failed to create pending transaction.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ===== Commit transaction ===== */
  async function handleCommit(
    e: React.MouseEvent,
    txnId: number
  ) {
    e.stopPropagation();

    try {
      await commitTransaction(txnId);
      await loadTransactions(true);
    } catch {
      setError("Failed to commit transaction.");
    }
  }

  return (
    <>
      {/* ===================== ITEM ROW ===================== */}
      <tr
        className="bg-white hover:bg-gray-50 cursor-pointer transition"
        onClick={async () => {
          const next = !expanded;
          setExpanded(next);
          if (next) await loadTransactions();
        }}
      >
        <td className="px-3 py-3 font-semibold">
          {item.part_number}
        </td>
        <td className="px-3 py-3">{item.quantity_ordered}</td>
        <td className="px-3 py-3">{item.quantity_fulfilled}</td>
        <td className="px-3 py-3">{item.note ?? "—"}</td>
        <td className="px-3 py-3">{item.status ?? "—"}</td>
        <td className="px-3 py-3">{"—"}</td>
      </tr>

      {/* ===================== EXPANDED ===================== */}
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-gray-50 px-6 py-4 space-y-3">
            {/* ===== CREATE PENDING ===== */}
            {remaining > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  {order_type === "outgoing"
                    ? "Reserve Qty:"
                    : "Mark Ordered:"}
                </span>

                <input
                  type="number"
                  min={1}
                  max={remaining}
                  className="input input-xs input-bordered w-24"
                  value={pendingQty}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    setPendingQty(Number(e.target.value))
                  }
                  disabled={submitting}
                />

                <input
                  type="text"
                  placeholder="Note (optional)"
                  className="input input-xs input-bordered w-64"
                  value={note}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={submitting}
                />

                <button
                  className="btn btn-xs btn-primary"
                  onClick={handleCreatePendingTxn}
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : "Create Pending"}
                </button>

                {error && (
                  <span className="text-xs text-red-500">
                    {error}
                  </span>
                )}
              </div>
            )}

            {/* ===== TRANSACTIONS TABLE ===== */}
            <div className="rounded-lg bg-white shadow-sm">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th>ID</th>
                    <th>Qty</th>
                    <th>State</th>
                    <th>Note</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {loadingTxns ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-gray-400">
                        Loading…
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-gray-400 italic">
                        No transactions yet
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>{tx.id}</td>

                        <td
                          className={
                            tx.quantity_delta < 0
                              ? "text-red-600 font-medium"
                              : "text-green-600 font-medium"
                          }
                        >
                          {tx.quantity_delta}
                        </td>

                        <td>
                          <span
                            className={`badge badge-sm ${
                              tx.state === "pending"
                                ? "badge-warning"
                                : tx.state === "committed"
                                ? "badge-success"
                                : "badge-ghost"
                            }`}
                          >
                            {tx.state}
                          </span>
                        </td>

                        <td>{tx.note ?? "—"}</td>
                        <td>{tx.created_at}</td>

                        <td>
                          {tx.state === "pending" && (
                            <button
                              className="btn btn-xs btn-success"
                              onClick={(e) =>
                                handleCommit(e, tx.id)
                              }
                            >
                              Commit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
