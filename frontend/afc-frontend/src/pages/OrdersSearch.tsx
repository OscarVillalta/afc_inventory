import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import { fetchOrders, type OrderRowItemPayload } from "../api/ordersTable";
import { fetchProducts, type Product } from "../api/products";
import type { Customer } from "../api/customers";
import type { Supplier } from "../api/suppliers";
import { fetchCustomers } from "../api/customers";
import { fetchSuppliers } from "../api/suppliers";
import AutocompleteInput from "../components/AutocompleteInput";
import { usePersistedFilters } from "../hooks/usePersistedFilters";

export default function OrdersSearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  //Customer and supplier list
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  // Type options for autocomplete
  const typeOptions = [
    { id: 1, name: "All" },
    { id: 2, name: "incoming" },
    { id: 3, name: "outgoing" },
    { id: 4, name: "contract" },
  ];
  
  // Search filters (PERSISTED)
  const [filters, setFilter] = usePersistedFilters("filters_orders_search", {
    searchId: "",
    searchCustomer: "",
    searchSupplier: "",
    filterType: "All",
    dateFrom: "",
    dateTo: "",
    dateFilterType: "created" as "created" | "completed",
    selectedProducts: [] as number[],
    productSearch: "",
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  
  // Available products for filtering
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  
  // Results
  const [results, setResults] = useState<OrderRowItemPayload[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  
  // Load products customer and suppliers on mount
  useEffect(() => {
    fetchProducts().then(setAvailableProducts).catch(console.error);
    fetchCustomers().then(setCustomers).catch(console.error);
    fetchSuppliers().then(setSuppliers).catch(console.error);
  }, []);
  
  // Handle URL parameters on mount
  useEffect(() => {
    const typeParam = searchParams.get('type');
    const productIdsParam = searchParams.get('product_ids');
    
    if (typeParam || productIdsParam) {
      // Update filters from URL params
      if (typeParam) {
        setFilter("filterType", typeParam);
      }
      if (productIdsParam) {
        const productIds = productIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        setFilter("selectedProducts", productIds);
      }
      
      // Automatically trigger search if URL params are present
      setTimeout(() => {
        handleSearch(1);
      }, 100);
    }
  }, [searchParams]);

  const handleSearch = async (page = 1) => {
    setLoading(true);
    setSearched(true);
    setCurrentPage(page);
    
    try {
      const apiFilters: Record<string, string> = {};
      
      if (filters.searchId) apiFilters.order_number = filters.searchId;
      if (filters.searchCustomer) apiFilters.customer_name = filters.searchCustomer;
      if (filters.searchSupplier) apiFilters.supplier_name = filters.searchSupplier;
      if (filters.filterType && filters.filterType !== "All") apiFilters.type = filters.filterType;
      
      // Date filters based on selected type
      if (filters.dateFilterType === "created") {
        if (filters.dateFrom) apiFilters.created_from = filters.dateFrom;
        if (filters.dateTo) apiFilters.created_to = filters.dateTo;
      } else {
        if (filters.dateFrom) apiFilters.completed_from = filters.dateFrom;
        if (filters.dateTo) apiFilters.completed_to = filters.dateTo;
      }
      
      // Product filters
      if (filters.selectedProducts.length > 0) {
        apiFilters.product_ids = filters.selectedProducts.join(",");
      }
      
      const response = await fetchOrders(page, pageSize, apiFilters);
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
    setFilter("searchId", "");
    setFilter("searchCustomer", "");
    setFilter("searchSupplier", "");
    setFilter("filterType", "All");
    setFilter("dateFrom", "");
    setFilter("dateTo", "");
    setFilter("dateFilterType", "created");
    setFilter("selectedProducts", []);
    setFilter("productSearch", "");
    setResults([]);
    setTotalResults(0);
    setSearched(false);
    setCurrentPage(1);
  };

  const setPresetDateRange = (preset: string) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    switch (preset) {
      case 'today':
        setFilter("dateFrom", todayStr);
        setFilter("dateTo", todayStr);
        break;
      case 'last7': {
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 7);
        setFilter("dateFrom", last7.toISOString().split('T')[0]);
        setFilter("dateTo", todayStr);
        break;
      }
      case 'last30': {
        const last30 = new Date(today);
        last30.setDate(last30.getDate() - 30);
        setFilter("dateFrom", last30.toISOString().split('T')[0]);
        setFilter("dateTo", todayStr);
        break;
      }
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
                  value={filters.searchId}
                  onChange={(e) => setFilter("searchId", e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>

              {/* Customer Autocomplete */}
              <AutocompleteInput
                label="Customer"
                placeholder="Search customers..."
                options={customers}
                value={filters.searchCustomer}
                onChange={(value) => setFilter("searchCustomer", value)}
                className="flex-1"
              />

              {/* Supplier Autocomplete */}
              <AutocompleteInput
                label="Supplier"
                placeholder="Search suppliers..."
                options={suppliers}
                value={filters.searchSupplier}
                onChange={(value) => setFilter("searchSupplier", value)}
                className="flex-1"
              />

              {/* Type Autocomplete */}
              <AutocompleteInput
                label="Type"
                placeholder="Select type..."
                options={typeOptions}
                value={filters.filterType}
                onChange={(value) => setFilter("filterType", value)}
                className="flex-1"
              />

              {/* Search Button */}
              <button
                className="btn btn-primary px-8"
                onClick={() => handleSearch(1)}
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
              
              {/* Pagination Controls in Center */}
              {totalResults > pageSize && (
                <div className="flex gap-2">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => handleSearch(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                  >
                    Previous
                  </button>
                  <span className="flex items-center px-4 text-sm font-medium text-gray-700">
                    Page {currentPage} of {Math.ceil(totalResults / pageSize)}
                  </span>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => handleSearch(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(totalResults / pageSize) || loading}
                  >
                    Next
                  </button>
                </div>
              )}
              
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
              <>
                {results.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow cursor-pointer p-5 border border-gray-100"
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
                            <span className="font-medium">
                              {order.type === "incoming" ? "Supplier:" : "Customer:"}
                            </span> {order.cs_name}
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
                ))}
              </>
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
              
              {/* Date Filter Type Toggle */}
              <div className="mb-3">
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  <button
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                      filters.dateFilterType === "created"
                        ? "bg-primary text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setFilter("dateFilterType", "created")}
                  >
                    Creation Date
                  </button>
                  <button
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                      filters.dateFilterType === "completed"
                        ? "bg-primary text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setFilter("dateFilterType", "completed")}
                  >
                    Completion Date
                  </button>
                </div>
              </div>
              
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
                    value={filters.dateFrom}
                    onChange={(e) => setFilter("dateFrom", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={filters.dateTo}
                    onChange={(e) => setFilter("dateTo", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Products Filter */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Products Included
              </h3>
              
              {/* Product Search Input */}
              <input
                type="text"
                placeholder="Search products..."
                className="input input-bordered input-sm w-full mb-3"
                value={filters.productSearch}
                onChange={(e) => setFilter("productSearch", e.target.value)}
              />
              
              {/* Selected Products Count */}
              {filters.selectedProducts.length > 0 && (
                <div className="text-xs text-gray-600 mb-2">
                  {filters.selectedProducts.length} product{filters.selectedProducts.length !== 1 ? 's' : ''} selected
                </div>
              )}
              
              {/* Product List */}
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                {(() => {
                  const filteredProducts = availableProducts.filter((product) =>
                    filters.productSearch === "" ||
                    product.part_number.toLowerCase().includes(filters.productSearch.toLowerCase()) ||
                    product.category.toLowerCase().includes(filters.productSearch.toLowerCase())
                  );
                  
                  return filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <label
                        key={product.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary"
                          checked={filters.selectedProducts.includes(product.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilter("selectedProducts", [...filters.selectedProducts, product.id]);
                            } else {
                              setFilter("selectedProducts", 
                                filters.selectedProducts.filter((id) => id !== product.id)
                              );
                            }
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900 truncate">
                            {product.part_number}
                          </div>
                          <div className="text-xs text-gray-500">
                            {product.category}
                          </div>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="p-4 text-xs text-gray-400 text-center">
                      No products found
                    </div>
                  );
                })()}
              </div>
              
              {/* Clear Products Button */}
              {filters.selectedProducts.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm w-full mt-2"
                  onClick={() => setFilter("selectedProducts", [])}
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Apply Filters Button */}
            <button
              className="btn btn-primary btn-block"
              onClick={() => handleSearch(1)}
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
