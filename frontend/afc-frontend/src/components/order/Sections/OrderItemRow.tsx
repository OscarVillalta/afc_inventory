import { useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  OrderItemPayload,
  OrderItemTransaction,
} from "../../../api/orderDetail";
import {
  fetchOrderItemTransactions,
  createOrderItemTransaction,
  commitTransaction,
  cancelTransaction,
  rollbackTransaction,
  deleteOrderItem,
  updateOrderItem,
} from "../../../api/orderDetail";

interface Props {
  item: OrderItemPayload;
  orderType: "incoming" | "outgoing";
  onRefresh: () => void;
  txnRefreshKey: number;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
}

export default function OrderItemRow({ item, orderType, onRefresh, txnRefreshKey, isSelected, onSelectChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    setActivatorNodeRef,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Style for expanded row - don't apply transform to prevent lag
  const expandedStyle = {
    opacity: isDragging ? 0.5 : 1,
  };

  // Editable fields state
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isEditingQty, setIsEditingQty] = useState(false);
  const [editedNote, setEditedNote] = useState(item.note || "");
  const [editedQty, setEditedQty] = useState(item.quantity_ordered);
  const [saving, setSaving] = useState(false);

  /* ===== Transactions ===== */
  const [transactions, setTransactions] =
    useState<OrderItemTransaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /* ===== Create pending ===== */
  const [pendingQty, setPendingQty] = useState(0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Separator items don't need transactions
  const isSeparator = item.is_separator;

  async function loadTransactions(force = false) {
    if (loaded && !force) return;
    if (isSeparator) return; // Separators don't have transactions

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

  /* ===== Pending total (IMPORTANT FIX) ===== */
  const pendingTotal = transactions
    .filter((tx) => tx.state === "pending")
    .reduce((sum, tx) => sum + Math.abs(tx.quantity_delta), 0);

  const remaining =
    item.quantity_ordered -
    item.quantity_fulfilled -
    pendingTotal;

  const remainingSafe = Math.max(remaining, 0);

  /* ===== Sync pendingQty when remaining changes ===== */
  useEffect(() => {
    setPendingQty(remainingSafe);
  }, [remainingSafe]);

  /* ===== Sync editable fields when item changes ===== */
  useEffect(() => {
    setEditedNote(item.note || "");
    setEditedQty(item.quantity_ordered);
  }, [item.id, item.note, item.quantity_ordered]);

  /* ===== Save edited note ===== */
  async function saveNote() {
    const normalizedEditedNote = editedNote || "";
    const normalizedItemNote = item.note || "";
    
    if (normalizedEditedNote === normalizedItemNote) {
      setIsEditingNote(false);
      return;
    }

    setSaving(true);
    try {
      await updateOrderItem(item.id, { note: editedNote });
      setIsEditingNote(false);
      await onRefresh();
    } catch {
      setError("Failed to update description.");
    } finally {
      setSaving(false);
    }
  }

  /* ===== Save edited quantity ===== */
  async function saveQty() {
    if (editedQty === item.quantity_ordered) {
      setIsEditingQty(false);
      return;
    }

    if (editedQty <= 0) {
      setError("Quantity must be greater than 0.");
      setEditedQty(item.quantity_ordered);
      setIsEditingQty(false);
      return;
    }

    if (editedQty < item.quantity_fulfilled) {
      setError("Quantity must be greater than or equal to fulfilled quantity.");
      setEditedQty(item.quantity_ordered);
      setIsEditingQty(false);
      return;
    }

    setSaving(true);
    try {
      await updateOrderItem(item.id, { quantity_ordered: editedQty });
      setIsEditingQty(false);
      await onRefresh();
    } catch {
      setError("Failed to update quantity.");
      setEditedQty(item.quantity_ordered);
      setIsEditingQty(false);
    } finally {
      setSaving(false);
    }
  }


/* ===== Sync after using quick acces buttons ===== */
  useEffect(() => {
    loadTransactions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txnRefreshKey]);

  /* ===== Create pending transaction ===== */
  async function handleCreatePendingTxn(e: React.MouseEvent) {
    e.stopPropagation();

    if (pendingQty <= 0 || pendingQty > remainingSafe) {
      setError("Invalid quantity.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const isOutgoing = orderType === "outgoing";

    try {
      await createOrderItemTransaction({
        product_id: item.product_id,
        order_id: item.order_id,
        order_item_id: item.id,
        quantity_delta: isOutgoing ? -pendingQty : pendingQty,
        reason: isOutgoing ? "shipment" : "receive",
        note: note || undefined,
      });

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

    setError(null);

    try {
      await commitTransaction(txnId);
      await onRefresh();
      await loadTransactions(true);
    } catch (err: unknown) {

      const error = JSON.parse((err as Error)?.message || '{}')

      const msg =
        error["error"]||
        "Unable to commit transaction.";

      setError(msg);
    }

    
  }

  /* ===== Cancel transaction ===== */
  async function handleCancel(
    e: React.MouseEvent,
    txnId: number
  ) {
    e.stopPropagation();

    setError(null);

    try {
      await cancelTransaction(txnId);
      await onRefresh();
      await loadTransactions(true);
    } catch (err: unknown) {
      const error = JSON.parse((err as Error)?.message || '{}')
      const msg = error["error"] || "Unable to cancel transaction.";
      setError(msg);
    }
  }

  /* ===== Rollback transaction ===== */
  async function handleRollback(
    e: React.MouseEvent,
    txnId: number
  ) {
    e.stopPropagation();

    if (!confirm("Are you sure you want to rollback this transaction? This will create a reversal transaction.")) {
      return;
    }

    setError(null);

    try {
      await rollbackTransaction(txnId);
      await onRefresh();
      await loadTransactions(true);
    } catch (err: unknown) {
      const error = JSON.parse((err as Error)?.message || '{}')
      const msg = error["error"] || "Unable to rollback transaction.";
      setError(msg);
    }
  }

  /* ===== Delete item (only if no transactions) ===== */
  async function handleDeleteItem(e: React.MouseEvent) {
    e.stopPropagation();

    if (isSeparator) {
      // Separator items can always be deleted
      if (!confirm("Delete this separator? This cannot be undone.")) {
        return;
      }
    } else {
      if (!loaded || transactions.length > 0) return;

      if (!confirm("Delete this item? This cannot be undone.")) {
        return;
      }
    }

    try {
      await deleteOrderItem(item.id);
      window.location.reload();
    } catch {
      setError("Failed to delete item.");
    }
  }

  return (
    <>
      {/* ===================== ITEM ROW ===================== */}
      {isSeparator ? (
        /* ===================== SEPARATOR ROW ===================== */
        <tr 
          ref={setNodeRef} 
          style={style}
          className="bg-blue-50 border-t-2 border-b-2 border-blue-300"
        >
          <td className="w-8 px-2">
            <div 
              ref={setActivatorNodeRef}
              {...attributes} 
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
            >
              ⋮⋮
            </div>
          </td>
          <td className="w-12" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              className="checkbox checkbox-s"
              checked={isSelected}
              onChange={(e) => onSelectChange(e.target.checked)}
              aria-label={`Select section: ${item.note}`}
            />
          </td>
          <td colSpan={5} className="px-3 py-3 text-wrap break-all">
            <div className="flex items-center gap-2">
              {isEditingNote ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    className="input input-sm input-bordered flex-1"
                    value={editedNote}
                    onChange={(e) => setEditedNote(e.target.value)}
                    onBlur={saveNote}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveNote();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setEditedNote(item.note || "");
                        setIsEditingNote(false);
                      }
                    }}
                    autoFocus
                    disabled={saving}
                  />
                </div>
              ) : (
                <span 
                  className="font-bold text-blue-900 text-base cursor-pointer hover:bg-blue-100 px-2 py-1 rounded flex-1"
                  onClick={() => setIsEditingNote(true)}
                  title="Click to edit"
                >
                  {item.note || "Section Separator"}
                </span>
              )}
            </div>
          </td>
          <td className="px-3 py-3 text-right">
            <button
              className="btn btn-xs btn-ghost text-red-500"
              onClick={handleDeleteItem}
              title="Delete separator"
            >
              ✕
            </button>
          </td>
        </tr>
      ) : (
        /* ===================== REGULAR ITEM ROW ===================== */
        <tr
          ref={setNodeRef}
          style={style}
          className="bg-white hover:bg-gray-50 transition"
        >
          <td className="w-8 px-2">
            <div 
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
            >
              ⋮⋮
            </div>
          </td>
          <td className="w-12" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              className="checkbox checkbox-s"
              checked={isSelected}
              onChange={(e) => onSelectChange(e.target.checked)}
              aria-label={`Select ${item.part_number}`}
            />
          </td>
          <td 
            className="pl-7 px-3 py-3 font-semibold cursor-grab active:cursor-grabbing"
            {...listeners}
            title="Drag to reorder"
          >
            {item.part_number}
          </td>
          <td className="px-3 py-3 max-w-64 text-balance break-all" onClick={(e) => e.stopPropagation()}>
            {isEditingNote ? (
              <input
                type="text"
                className="input input-sm input-bordered w-full"
                value={editedNote}
                onChange={(e) => setEditedNote(e.target.value)}
                onBlur={saveNote}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveNote();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditedNote(item.note || "");
                    setIsEditingNote(false);
                  }
                }}
                autoFocus
                disabled={saving}
              />
            ) : (
              <span
                className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded inline-block"
                onClick={() => setIsEditingNote(true)}
                title="Click to edit"
              >
                {item.note || "—"}
              </span>
            )}
          </td>
          <td 
            className="px-3 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            {isEditingQty ? (
              <input
                type="number"
                className="input input-sm input-bordered w-24"
                value={editedQty}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (value >= 1) {
                    setEditedQty(value);
                  }
                }}
                onBlur={saveQty}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveQty();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditedQty(item.quantity_ordered);
                    setIsEditingQty(false);
                  }
                }}
                autoFocus
                disabled={saving}
                min={1}
              />
            ) : (
              <span
                className={`cursor-pointer hover:bg-blue-50 px-2 py-1 rounded inline-block `}
                onClick={() => {
                    setIsEditingQty(true);
                }}
                title={item.quantity_fulfilled > 0 ? "Cannot edit fulfilled items" : "Click to edit"}
              >
                {item.quantity_ordered}
              </span>
            )}
          </td>
          <td 
            className="px-3 py-3 cursor-pointer hover:bg-blue-50"
            onClick={async () => {
              const next = !expanded;
              setExpanded(next);
              if (next) await loadTransactions();
            }}
            title="Click to view transactions"
          >
            {item.quantity_fulfilled}
          </td>
          <td className="px-3 py-3">
            {item.status ?? "—"}
          </td>
          <td className="px-3 py-3 text-right">
            <div className="flex items-center justify-end gap-2">
              <button
                className="btn btn-xs btn-ghost"
                onClick={async () => {
                  const next = !expanded;
                  setExpanded(next);
                  if (next) await loadTransactions();
                }}
                title="View transactions"
              >
                <img width="24" height="24" src="https://img.icons8.com/material-rounded/24/expand-arrow--v1.png" alt="expand-arrow--v1"/>
              </button>
              
              {loaded && transactions.length === 0 
              ? (
                <button
                  className="btn btn-xs btn-ghost text-red-500"
                  onClick={handleDeleteItem}
                  title="Delete item"
                >
                ✕
              </button>
            )
            : (
                <div className="btn btn-xs btn-ghost text-red-500 w-7">

              </div>
            )
            }
            </div>
          </td>
        </tr>
      )}

      {/* ===================== EXPANDED ===================== */}
      {expanded && !isSeparator && (
        <tr style={expandedStyle}>
          <td colSpan={8} className="bg-gray-50 px-6 py-4 space-y-3" style={{ pointerEvents: isDragging ? 'none' : 'auto' }}>
            {/* ===== CREATE PENDING ===== */}
            {remainingSafe > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  {orderType === "outgoing"
                    ? "Reserve Qty:"
                    : "Mark Ordered:"}
                </span>

                <input
                  type="number"
                  min={1}
                  max={remainingSafe}
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

        
              </div>
            )}

            {/* ===== TRANSACTIONS TABLE ===== */}
            {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}
            <div className="rounded-lg bg-white shadow-sm">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th>ID</th>
                    <th>Qty</th>
                    <th>State</th>
                    <th>Reason</th>
                    <th>Note</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {loadingTxns ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-gray-400">
                        Loading…
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-gray-400 italic">
                        No transactions yet
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className={tx.state === "rolled_back" ? "opacity-50" : ""}>
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
                                : tx.state === "rolled_back"
                                ? "badge-error"
                                : "badge-ghost"
                            }`}
                          >
                            {tx.state}
                          </span>
                        </td>

                        <td>
                          <span className={tx.reason === "rollback" ? "text-orange-600 font-medium" : ""}>
                            {tx.reason}
                          </span>
                        </td>

                        <td>{tx.note ?? "—"}</td>
                        <td>{tx.created_at}</td>

                        <td>
                          <div className="flex gap-2">
                            {tx.state === "pending" && (
                              <>
                                <button
                                  className="btn btn-xs btn-success"
                                  disabled={!!error}
                                  onClick={(e) =>
                                    handleCommit(e, tx.id)
                                  }
                                >
                                  Commit
                                </button>
                                <button
                                  className="btn btn-xs btn-error"
                                  disabled={!!error}
                                  onClick={(e) =>
                                    handleCancel(e, tx.id)
                                  }
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            {tx.state === "committed" && tx.reason !== "rollback" && (
                              <button
                                className="btn btn-xs btn-warning"
                                disabled={!!error}
                                onClick={(e) =>
                                  handleRollback(e, tx.id)
                                }
                              >
                                Rollback
                              </button>
                            )}
                          </div>
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
