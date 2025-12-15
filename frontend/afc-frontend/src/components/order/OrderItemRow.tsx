import { useState } from "react";

/* ===================== TYPES ===================== */

export interface OrderTransaction {
  id: number;
  quantity_change: number;
  note: string;
  date: string;
}

export interface OrderLineItem {
  id: number;
  part_number: string;
  qty_requested: number;
  qty_fulfilled: number;
  comment: string;
  status: "Pending" | "Partial" | "Completed";
  completion_date?: string;
  transactions: OrderTransaction[];
}

/* ===================== COMPONENT ===================== */

interface Props {
  item: OrderLineItem;
}

export default function OrderItemRow({ item }: Props) {
  const [expanded, setExpanded] = useState(false);

  /* ===== Local editable state (NO saving yet) ===== */
  const [qtyRequested, setQtyRequested] = useState(item.qty_requested);
  const [qtyFulfilled, setQtyFulfilled] = useState(item.qty_fulfilled);
  const [comment, setComment] = useState(item.comment);
  const [status, setStatus] = useState<OrderLineItem["status"]>(item.status);
  const [completionDate, setCompletionDate] = useState(
    item.completion_date ?? ""
  );

  return (
    <>
      {/* ===================== LINE ITEM ROW ===================== */}
      <tr
        className="bg-white hover:bg-gray-50 cursor-pointer transition"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {/* Part Number */}
        <td className="px-3 py-3 font-semibold">
          {item.part_number}
        </td>

        {/* Qty Requested */}
        <td className="px-3 py-3">
          <input
            type="number"
            className="input input-xs input-bordered w-20"
            value={qtyRequested}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setQtyRequested(Number(e.target.value))}
          />
        </td>

        {/* Qty Fulfilled */}
        <td className="px-3 py-3">
            {item.qty_fulfilled}
        </td>

        {/* Comment */}
        <td className="px-3 py-3">
          <input
            type="text"
            className="input input-xs input-bordered w-full"
            value={comment}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setComment(e.target.value)}
          />
        </td>

        {/* Status */}
        <td className="px-3 py-3">
            {item.status}
        </td>

        {/* Completion Date */}
        <td className="px-3 py-3 text-center">
            {item.completion_date}
        </td>
      </tr>

      {/* ===================== TRANSACTIONS (EXPANDABLE) ===================== */}
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-gray-50 px-6 py-4">
            <div className="rounded-lg bg-white shadow-sm">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th>ID</th>
                    <th>Qty Change</th>
                    <th>Note</th>
                    <th>Date</th>
                  </tr>
                </thead>

                <tbody>
                  {item.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>{tx.id}</td>
                      <td
                        className={
                          tx.quantity_change > 0
                            ? "text-green-600 font-medium"
                            : "text-red-600 font-medium"
                        }
                      >
                        {tx.quantity_change}
                      </td>
                      <td>{tx.note}</td>
                      <td>{tx.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
