interface TransactionSummaryBarProps {
  total: number;
  netQuantityChange: number;
  committedCount: number;
  pendingCount: number;
  loading: boolean;
}

export default function TransactionSummaryBar({
  total,
  netQuantityChange,
  committedCount,
  pendingCount,
  loading,
}: TransactionSummaryBarProps) {
  const committedPct = total > 0 ? Math.round((committedCount / total) * 100) : 0;
  const pendingPct = total > 0 ? Math.round((pendingCount / total) * 100) : 0;

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-6 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {/* Total Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Entries</p>
        <p className="text-xl font-bold text-gray-800 mt-1">{total.toLocaleString()}</p>
      </div>

      {/* Net Quantity Change */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Net Change</p>
        <p
          className={`text-xl font-bold mt-1 ${
            netQuantityChange > 0
              ? "text-green-600"
              : netQuantityChange < 0
              ? "text-red-600"
              : "text-gray-800"
          }`}
        >
          {netQuantityChange > 0 ? "+" : ""}
          {netQuantityChange.toLocaleString()} units
        </p>
      </div>

      {/* Committed % */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Committed</p>
        <p className="text-xl font-bold text-green-600 mt-1">{committedPct}%</p>
        <p className="text-xs text-gray-400">{committedCount.toLocaleString()} transactions</p>
      </div>

      {/* Pending % */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Pending</p>
        <p className="text-xl font-bold text-amber-600 mt-1">{pendingPct}%</p>
        <p className="text-xs text-gray-400">{pendingCount.toLocaleString()} transactions</p>
      </div>
    </div>
  );
}
