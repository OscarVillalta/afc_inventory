interface TransactionSummaryBarProps {
  total: number;
  netQuantityChange: number;
  committedCount: number;
  pendingCount: number;
  loading: boolean;
  hasActiveFilters?: boolean;
  dateRangeLabel?: string;
}

export default function TransactionSummaryBar({
  total,
  netQuantityChange,
  committedCount,
  pendingCount,
  loading,
  hasActiveFilters = false,
  dateRangeLabel,
}: TransactionSummaryBarProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-6 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {/* Total Results */}
      <div className="stat bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="stat-figure text-blue-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div className="stat-title text-xs font-medium text-gray-400 uppercase tracking-wide">Total Results</div>
        <div className="stat-value text-xl font-bold text-gray-800">{total.toLocaleString()}</div>
        <div className="stat-desc text-xs text-gray-400 mt-1">{hasActiveFilters ? "Filtered view" : "All transactions"}</div>
      </div>

      {/* Pending Count */}
      <div className="stat bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="stat-figure text-amber-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="stat-title text-xs font-medium text-gray-400 uppercase tracking-wide">Pending</div>
        <div className="stat-value text-xl font-bold text-amber-600">{pendingCount.toLocaleString()}</div>
        <div className="stat-desc text-xs text-gray-400 mt-1">{pendingCount === 1 ? "transaction" : "transactions"}</div>
      </div>

      {/* Committed Count */}
      <div className="stat bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="stat-figure text-green-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="stat-title text-xs font-medium text-gray-400 uppercase tracking-wide">Committed</div>
        <div className="stat-value text-xl font-bold text-green-600">{committedCount.toLocaleString()}</div>
        <div className="stat-desc text-xs text-gray-400 mt-1">{committedCount === 1 ? "transaction" : "transactions"}</div>
      </div>

      {/* Net Delta */}
      <div className="stat bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className={`stat-figure ${netQuantityChange > 0 ? "text-green-500" : netQuantityChange < 0 ? "text-red-500" : "text-gray-400"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </div>
        <div className="stat-title text-xs font-medium text-gray-400 uppercase tracking-wide">Net Delta</div>
        <div className={`stat-value text-xl font-bold ${netQuantityChange > 0 ? "text-green-600" : netQuantityChange < 0 ? "text-red-600" : "text-gray-800"}`}>
          {netQuantityChange > 0 ? "+" : ""}{netQuantityChange.toLocaleString()}
        </div>
        <div className="stat-desc text-xs text-gray-400 mt-1">units total</div>
      </div>

      {/* Date Range */}
      <div className="stat bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="stat-figure text-purple-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="stat-title text-xs font-medium text-gray-400 uppercase tracking-wide">Date Range</div>
        <div className="stat-value text-sm font-bold text-gray-800 mt-1">
          <span className="badge badge-soft badge-primary text-xs">{dateRangeLabel || "All time"}</span>
        </div>
        <div className="stat-desc text-xs text-gray-400 mt-1">{hasActiveFilters ? "Filtered view" : "No date filter"}</div>
      </div>
    </div>
  );
}
