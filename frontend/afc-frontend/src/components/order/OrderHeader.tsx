import type { OrderType } from "../../constants/orderTypes";
import { ORDER_TYPE_LABELS, ORDER_TYPE_COLORS } from "../../constants/orderTypes";

type OrderStatus = "Pending" | "Partially Fulfilled" | "Completed";

interface Props {
  orderNumber: string;
  externalOrderNumber?: string | null;
  type: OrderType;
  status: OrderStatus;
  currentDepartment?: string | null;
  onCopyOrder?: () => void;
  copyStatus?: "idle" | "copied" | "error";
  selectedCount?: number;
}

export default function OrderHeader({
  orderNumber,
  externalOrderNumber,
  type,
  status,
  onCopyOrder,
  copyStatus = "idle",
  selectedCount = 0,
}: Props) {

  const copyLabel =
    copyStatus === "copied"
      ? "✅ Copied!"
      : copyStatus === "error"
      ? "❌ Failed"
      : selectedCount > 0
      ? `📋 Copy Selected (${selectedCount})`
      : "📋 Copy Order";

  const colors = ORDER_TYPE_COLORS[type] ?? ORDER_TYPE_COLORS["installation"];
  const typeLabel = ORDER_TYPE_LABELS[type] ?? type;

  return (
    <div className="bg-[#3A3F51] text-white px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 rounded-xl shadow-sm">
      {/* LEFT: Order Number */}
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-widest">
          Order #{orderNumber}
        </h1>
        {externalOrderNumber && (
          <div className="flex items-center gap-2">
            <span className="text-md font-medium text-slate-400 uppercase tracking-wide">Ext #</span>
            <span className="text-md font-bold text-slate-400 tracking-tight ">
              {externalOrderNumber}
            </span>
          </div>
        )}
      </div>

      {/* RIGHT: Type + Status + Copy */}
      <div className="flex items-top gap-x-3">
        {onCopyOrder && (
          <button
            className="btn btn-xs btn-outline text-white border-white hover:bg-white hover:text-[#3A3F51] mt-1"
            onClick={onCopyOrder}
            disabled={copyStatus !== "idle"}
          >
            {copyLabel}
          </button>
        )}

        {/* Type */}
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
        >
          {typeLabel}
        </span>

        {/* Status */}
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            status === "Completed"
              ? "bg-green-500 text-white"
              : status === "Partially Fulfilled"
              ? "bg-blue-500 text-white"
              : "bg-gray-500 text-white"
          }`}
        >
          {status}
        </span>

      </div>
    </div>
  );
}
