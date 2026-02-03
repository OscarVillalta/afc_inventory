import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import { fetchOrders, type OrderRowItemPayload } from "../api/ordersTable";

export default function OrdersSearchPage() {
  const navigate = useNavigate();
  
  // Search filters
  const [searchId, setSearchId] = useState("");
  const [searchCustomer, setSearchCustomer] = useState("");
  const [filterType, setFilterType] = useState("All");
  
  // Advanced filters (sidebar)
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Product filtering to be implemented later
  // const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  
  // Results
  const [results, setResults] = useState<OrderRowItemPayload[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    
    try {
      const filters: any = {};
      
      if (searchId) filters.order_number = searchId;
      if (searchCustomer) filters.search = searchCustomer;
      if (filterType && filterType !== "All") filters.type = filterType;
      if (dateFrom) filters.created_from = dateFrom;
      if (dateTo) filters.created_to = dateTo;
      
      const response = await fetchOrders(1, 50, filters);
      setResults(response.results || []);
      setTotalResults(response.total || 0);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchId("");
    setSearchCustomer("");
    setFilterType("All");
    setDateFrom("");
    setDateTo("");
    // setSelectedProducts([]);
    setResults([]);
    setTotalResults(0);
    setSearched(false);
  };

  const setPresetDateRange = (preset: string) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    switch (preset) {
      case 'today':
        setDateFrom(todayStr);
        setDateTo(todayStr);
        break;
      case 'last7':
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 7);
        setDateFrom(last7.toISOString().split('T')[0]);
        setDateTo(todayStr);
        break;
      case 'last30':
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 30);
        setDateFrom(last30.toISOString().split('T')[0]);
        setDateTo(todayStr);
        break;
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-US", { 
      timeZone: "UTC",
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <MainLayout>
      <div className="flex h-full gap-6">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Header Search Controls */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">
              Search Orders
            </h1>
            
            <div className="flex gap-4 items-end">
              {/* ID Input */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order ID
                </label>
                <input
                  type="text"
                  placeholder="AFC-000123"
                  className="input input-bordered w-full"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>

              {/* Customer Input */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer
                </label>
                <input
                  type="text"
                  placeholder="Customer name..."
                  className="input input-bordered w-full"
                  value={searchCustomer}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>

              {/* Type Dropdown */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  className="select select-bordered w-full"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option>All</option>
                  <option value="incoming">Incoming</option>
                  <option value="outgoing">Outgoing</option>
                  <option value="contract">Contract</option>
                </select>
              </div>

              {/* Search Button */}
              <button
                className="btn btn-primary px-8"
                onClick={handleSearch}
                disabled={loading}
              >
                {loading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  "Search"
                )}
              </button>
            </div>
          </div>

          {/* Results Summary */}
          {searched && (
            <div className="bg-white rounded-lg shadow-sm px-6 py-4 mb-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Found <span className="font-semibold text-gray-900">{totalResults}</span> result{totalResults !== 1 ? 's' : ''}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleClearSearch}
              >
                Clear Search
              </button>
            </div>
          )}

          {/* Results List */}
          <div className="flex-1 overflow-y-auto space-y-3">
            {loading ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-gray-500 mt-4">Searching...</p>
              </div>
            ) : results.length === 0 && searched ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <p className="text-gray-500 text-lg">No orders found</p>
                <p className="text-gray-400 text-sm mt-2">Try adjusting your search criteria</p>
              </div>
            ) : results.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <p className="text-gray-500 text-lg">Start searching for orders</p>
                <p className="text-gray-400 text-sm mt-2">Use the search filters above to find orders</p>
              </div>
            ) : (
              results.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer p-5 border border-gray-100"
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <div className="flex items-start justify-between">
                    {/* Left section */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Order #{order.id}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            order.type === "outgoing"
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {order.type.charAt(0).toUpperCase() + order.type.slice(1)}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <span className="font-medium">Customer:</span> {order.cs_name}
                        </div>
                        {order.description && (
                          <div className="text-gray-500 truncate">
                            {order.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right section */}
                    <div className="text-right ml-4">
                      <div
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-2 ${
                          order.status === "Completed"
                            ? "bg-green-100 text-green-700"
                            : order.status.includes("Partial")
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {order.status}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(order.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar - Advanced Filters */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm p-6 sticky top-0">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">
              Advanced Filters
            </h2>

            {/* Date Filters */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Date Range
              </h3>
              
              {/* Preset Buttons */}
              <div className="flex gap-2 mb-4">
                <button
                  className="btn btn-sm btn-outline flex-1"
                  onClick={() => setPresetDateRange('today')}
                >
                  Today
                </button>
                <button
                  className="btn btn-sm btn-outline flex-1"
                  onClick={() => setPresetDateRange('last7')}
                >
                  Last 7d
                </button>
                <button
                  className="btn btn-sm btn-outline flex-1"
                  onClick={() => setPresetDateRange('last30')}
                >
                  Last 30d
                </button>
              </div>

              {/* Date Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Products Filter */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Products Included
              </h3>
              <input
                type="text"
                placeholder="Search products..."
                className="input input-bordered input-sm w-full"
                disabled
              />
              <p className="text-xs text-gray-400 mt-2">
                Product filtering coming soon
              </p>
            </div>

            {/* Apply Filters Button */}
            <button
              className="btn btn-primary btn-block"
              onClick={handleSearch}
              disabled={loading}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
