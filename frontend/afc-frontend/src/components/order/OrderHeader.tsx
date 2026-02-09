type OrderType = "incoming" | "outgoing";
type OrderStatus = "Pending" | "Partially Fulfilled" | "Completed";

interface Props {
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
}

export default function OrderHeader({
  orderNumber,
  type,
  status,
}: Props) {

  return (
    <div className="bg-[#3A3F51] text-white px-6 py-4 flex justify-between items-center rounded-xl shadow-sm">
      {/* LEFT: Order Number */}
      <div>
        <h1 className="text-lg font-semibold tracking-widest">
          Order #{orderNumber}
        </h1>
      </div>

      {/* RIGHT: Type + Status */}
      <div className="flex items-center gap-x-3">
        {/* Type */}
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium border ${
            type === "outgoing"
              ? "bg-red-600/20 text-red-200 border-red-400/40"
              : "bg-green-600/20 text-green-200 border-green-400/40"
          }`}
        >
          {type}
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
